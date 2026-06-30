import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayLocalISO } from "@/lib/date";
import type { Database } from "@/lib/supabase/database.types";
import type { MealEntry, MealKey } from "@/lib/habits";
import { MEAL_ORDER } from "@/lib/habits";

type DbClient = SupabaseClient<Database>;

export interface MealBoxStockItem {
  id: string;
  description: string;
  remaining: number;
}

export interface WeekMealDay {
  date: string;
  isFuture: boolean;
  isToday: boolean;
  meals: Record<MealKey, MealEntry | null>;
  /** Sum of meal_boxes produced this day (from cooking logs). */
  boxesProduced: number;
}

export interface WeekMealsSummary {
  weekStart: string;
  weekEnd: string;
  days: WeekMealDay[];
  stock: MealBoxStockItem[];
  /** Total matlådor produced during the week. */
  boxesProducedWeek: number;
}

function descriptionKey(description: string): string {
  return description.trim().toLowerCase();
}

async function findStockByDescription(
  supabase: DbClient,
  userId: string,
  description: string,
): Promise<MealBoxStockItem | null> {
  const key = descriptionKey(description);
  if (!key) return null;

  const { data } = await supabase
    .from("meal_box_stock")
    .select("id, description, remaining")
    .eq("user_id", userId);

  const row = (data ?? []).find(
    (r) => descriptionKey(r.description) === key,
  );
  return row
    ? { id: row.id, description: row.description, remaining: row.remaining }
    : null;
}

/** Add or subtract matlådor for a dish name. */
export async function adjustMealBoxStock(
  supabase: DbClient,
  userId: string,
  description: string,
  delta: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (delta === 0) return { ok: true };

  const trimmed = description.trim();
  if (!trimmed) return { ok: true };

  const existing = await findStockByDescription(supabase, userId, trimmed);
  const next = (existing?.remaining ?? 0) + delta;

  if (next < 0) {
    return {
      ok: false,
      error: `Inte tillräckligt många matlådor kvar av «${existing?.description ?? trimmed}».`,
    };
  }

  if (existing) {
    if (next === 0) {
      const { error } = await supabase
        .from("meal_box_stock")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("meal_box_stock")
        .update({ remaining: next, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  if (delta < 0) {
    return { ok: false, error: "Ingen matlåda att dra av." };
  }

  const { error } = await supabase.from("meal_box_stock").insert({
    user_id: userId,
    description: trimmed,
    remaining: delta,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface MealEntryStockSnapshot {
  description: string;
  mealBoxes: number | null;
  fromMealBox: boolean;
  mealBoxStockId: string | null;
}

/** Keep inventory in sync when a meal entry is saved or updated. */
export async function syncMealBoxStockOnMealSave(
  supabase: DbClient,
  userId: string,
  previous: MealEntryStockSnapshot | null,
  next: MealEntryStockSnapshot,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (next.fromMealBox) return { ok: true };

  if (previous && !previous.fromMealBox && (previous.mealBoxes ?? 0) > 0) {
    const res = await adjustMealBoxStock(
      supabase,
      userId,
      previous.description,
      -(previous.mealBoxes ?? 0),
    );
    if (!res.ok) return res;
  }

  if ((next.mealBoxes ?? 0) > 0) {
    const res = await adjustMealBoxStock(
      supabase,
      userId,
      next.description,
      next.mealBoxes ?? 0,
    );
    if (!res.ok) return res;
  }

  return { ok: true };
}

/** Restore inventory when a meal entry is removed. */
export async function syncMealBoxStockOnMealClear(
  supabase: DbClient,
  userId: string,
  entry: MealEntryStockSnapshot,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (entry.fromMealBox) {
    if (entry.mealBoxStockId) {
      const { data: stock } = await supabase
        .from("meal_box_stock")
        .select("id, description, remaining")
        .eq("id", entry.mealBoxStockId)
        .eq("user_id", userId)
        .maybeSingle();
      if (stock) {
        return adjustMealBoxStock(
          supabase,
          userId,
          stock.description,
          1,
        );
      }
    }
    return adjustMealBoxStock(supabase, userId, entry.description, 1);
  }

  if ((entry.mealBoxes ?? 0) > 0) {
    return adjustMealBoxStock(
      supabase,
      userId,
      entry.description,
      -(entry.mealBoxes ?? 0),
    );
  }

  return { ok: true };
}

export async function getMealBoxStock(userId: string): Promise<MealBoxStockItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_box_stock")
    .select("id, description, remaining")
    .eq("user_id", userId)
    .gt("remaining", 0)
    .order("description", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    remaining: row.remaining,
  }));
}

export async function getWeekMealsSummary(
  userId: string,
  weekStart: string,
): Promise<WeekMealsSummary> {
  const supabase = await createClient();
  const weekEnd = addDaysISO(weekStart, 6);
  const today = todayLocalISO();

  const [rowsRes, stock] = await Promise.all([
    supabase
      .from("meal_entries")
      .select(
        "id, local_date, meal, description, water_log_id, cooked_by, meal_boxes, restaurant_id, cooked_by_name, from_meal_box, meal_box_stock_id, meal_restaurants(name)",
      )
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd)
      .order("local_date", { ascending: true }),
    getMealBoxStock(userId),
  ]);

  const waterLogIds = (rowsRes.data ?? [])
    .map((r) => r.water_log_id)
    .filter((v): v is string => Boolean(v));

  const waterMap = new Map<string, number>();
  if (waterLogIds.length > 0) {
    const { data: logs } = await supabase
      .from("water_logs")
      .select("id, amount_ml")
      .in("id", waterLogIds);
    for (const l of logs ?? []) waterMap.set(l.id, l.amount_ml);
  }

  const byDate = new Map<string, Record<MealKey, MealEntry | null>>();
  let boxesProducedWeek = 0;

  for (const r of rowsRes.data ?? []) {
    const meal = r.meal as MealKey;
    const restaurant = r.meal_restaurants as { name: string } | null;
    const entry: MealEntry = {
      id: r.id,
      meal,
      description: r.description,
      waterMl: r.water_log_id ? waterMap.get(r.water_log_id) ?? 0 : 0,
      waterLogId: r.water_log_id,
      cookedBy: (r.cooked_by as MealEntry["cookedBy"]) ?? null,
      restaurantId: r.restaurant_id,
      restaurantName: restaurant?.name ?? null,
      cookedByName: r.cooked_by_name,
      mealBoxes: r.meal_boxes,
      fromMealBox: r.from_meal_box ?? false,
      mealBoxStockId: r.meal_box_stock_id,
    };

    if (!byDate.has(r.local_date)) {
      byDate.set(r.local_date, {
        breakfast: null,
        lunch: null,
        dinner: null,
      });
    }
    byDate.get(r.local_date)![meal] = entry;

    if (!entry.fromMealBox && (entry.mealBoxes ?? 0) > 0) {
      boxesProducedWeek += entry.mealBoxes ?? 0;
    }
  }

  const days: WeekMealDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysISO(weekStart, i);
    const meals = byDate.get(date) ?? {
      breakfast: null,
      lunch: null,
      dinner: null,
    };
    const boxesProduced = MEAL_ORDER.reduce(
      (sum, key) =>
        sum +
        (meals[key] &&
        !meals[key]!.fromMealBox &&
        (meals[key]!.mealBoxes ?? 0) > 0
          ? meals[key]!.mealBoxes ?? 0
          : 0),
      0,
    );
    days.push({
      date,
      isFuture: date > today,
      isToday: date === today,
      meals,
      boxesProduced,
    });
  }

  return {
    weekStart,
    weekEnd,
    days,
    stock,
    boxesProducedWeek,
  };
}
