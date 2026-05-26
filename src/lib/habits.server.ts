import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayLocalISO } from "@/lib/date";
import {
  type DailyHabit,
  type Habit,
  type HabitStatus,
  type MealEntry,
  type MealKey,
  mealStatusFor,
  waterStatusFor,
} from "@/lib/habits";

interface HabitRow {
  id: string;
  key: string;
  label: string;
  kind: "tri_state" | "water";
  icon: string;
  accent: string;
  sort_order: number;
}

function rowToHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    kind: r.kind,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
  };
}

/** All active habits for the user, ordered for display. */
export async function getHabits(userId: string): Promise<Habit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habits")
    .select("id, key, label, kind, icon, accent, sort_order")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToHabit);
}

/**
 * Returns the day's status for every active habit. Water status is derived
 * from `water_logs`, meals from `meal_entries`, tri-state from `habit_checks`.
 *
 * For "today" or past days, meal status is computed from the count of logged
 * meals (3 yes / 2 half / 0-1 no). For future days status is always null.
 */
export async function getDailyHabits(
  userId: string,
  localDate: string,
): Promise<DailyHabit[]> {
  const supabase = await createClient();
  const today = todayLocalISO();
  const isFuture = localDate > today;

  const [habitsRes, checksRes, waterRes, profileRes, mealsRes] = await Promise.all([
    supabase
      .from("habits")
      .select("id, key, label, kind, icon, accent, sort_order")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habit_checks")
      .select("habit_id, status, note")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("water_logs")
      .select("amount_ml")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("profiles")
      .select("daily_water_goal_ml")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("meal_entries")
      .select("meal")
      .eq("user_id", userId)
      .eq("local_date", localDate),
  ]);

  const habits = habitsRes.data ?? [];
  const checks = checksRes.data ?? [];
  const goalMl = profileRes.data?.daily_water_goal_ml ?? 2500;
  const waterMl = (waterRes.data ?? []).reduce((acc, l) => acc + l.amount_ml, 0);
  const mealsLogged = (mealsRes.data ?? []).length;

  const checkByHabit = new Map<string, { status: HabitStatus; note: string | null }>();
  for (const c of checks) {
    checkByHabit.set(c.habit_id, { status: c.status, note: c.note });
  }

  return habits.map((row): DailyHabit => {
    const habit = rowToHabit(row);
    if (habit.kind === "water") {
      const progress = goalMl > 0 ? waterMl / goalMl : 0;
      return {
        ...habit,
        status: waterStatusFor(waterMl, goalMl),
        note: null,
        waterMl,
        goalMl,
        progress,
      };
    }
    if (habit.kind === "meal") {
      return {
        ...habit,
        status: isFuture ? null : mealStatusFor(mealsLogged),
        note: null,
        mealsLogged,
      };
    }
    const c = checkByHabit.get(habit.id);
    return {
      ...habit,
      status: c?.status ?? null,
      note: c?.note ?? null,
    };
  });
}

/**
 * Fetch the user's meal entries for a single day, normalised to the three
 * fixed slots. Missing meals are returned as null so the UI can render a
 * "tap to log" placeholder.
 */
export async function getDailyMeals(
  userId: string,
  localDate: string,
): Promise<Record<MealKey, MealEntry | null>> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("meal_entries")
    .select("id, meal, description, water_log_id")
    .eq("user_id", userId)
    .eq("local_date", localDate);

  const waterLogIds = (rows ?? [])
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

  const out: Record<MealKey, MealEntry | null> = {
    breakfast: null,
    lunch: null,
    dinner: null,
  };
  for (const r of rows ?? []) {
    out[r.meal as MealKey] = {
      id: r.id,
      meal: r.meal as MealKey,
      description: r.description,
      waterMl: r.water_log_id ? waterMap.get(r.water_log_id) ?? 0 : 0,
      waterLogId: r.water_log_id,
    };
  }
  return out;
}

// ============================================================================
// Month aggregation
// ============================================================================

export interface MonthDay {
  date: string;
  /** 'YYYY-MM-DD' >  todayLocalISO() */
  isFuture: boolean;
  isToday: boolean;
  /** Day of month — 1..31 */
  dayOfMonth: number;
  /** ISO weekday: 1 = Mon … 7 = Sun */
  weekday: number;
  /** Habit id → status (or null = no entry / not applicable). */
  statuses: Record<string, HabitStatus | null>;
}

export interface MonthSummary {
  year: number;
  /** 1..12 */
  month: number;
  monthStart: string;
  monthEnd: string;
  habits: Habit[];
  days: MonthDay[];
  /** Habit id → number of days with status === 'yes'. */
  yesByHabit: Record<string, number>;
}

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // last day of `month`
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return { startISO, endISO, daysInMonth: end.getDate() };
}

/**
 * Build a full month grid: every day → status per habit. Water status is
 * derived from per-day water totals against the user's goal; tri-state
 * habits use `habit_checks` directly.
 */
export async function getMonthSummary(
  userId: string,
  year: number,
  month: number,
): Promise<MonthSummary> {
  const supabase = await createClient();
  const { startISO, endISO, daysInMonth } = monthBounds(year, month);

  const [habitsRes, checksRes, waterRes, profileRes, mealsRes] = await Promise.all([
    supabase
      .from("habits")
      .select("id, key, label, kind, icon, accent, sort_order")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habit_checks")
      .select("habit_id, local_date, status")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("water_logs")
      .select("amount_ml, local_date")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("profiles")
      .select("daily_water_goal_ml")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("meal_entries")
      .select("local_date")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
  ]);

  const habits = (habitsRes.data ?? []).map(rowToHabit);
  const goalMl = profileRes.data?.daily_water_goal_ml ?? 2500;

  // (habit_id, date) -> status
  const checkMap = new Map<string, HabitStatus>();
  for (const c of checksRes.data ?? []) {
    checkMap.set(`${c.habit_id}|${c.local_date}`, c.status);
  }

  // date -> total ml
  const waterByDate = new Map<string, number>();
  for (const w of waterRes.data ?? []) {
    waterByDate.set(w.local_date, (waterByDate.get(w.local_date) ?? 0) + w.amount_ml);
  }

  // date -> count of meal entries
  const mealsByDate = new Map<string, number>();
  for (const m of mealsRes.data ?? []) {
    mealsByDate.set(m.local_date, (mealsByDate.get(m.local_date) ?? 0) + 1);
  }

  const today = todayLocalISO();
  const days: MonthDay[] = [];
  const yesByHabit: Record<string, number> = Object.fromEntries(
    habits.map((h) => [h.id, 0]),
  );

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${startISO.slice(0, 7)}-${String(day).padStart(2, "0")}`;
    const dt = new Date(year, month - 1, day);
    const jsDow = dt.getDay(); // 0 = Sun
    const isoDow = ((jsDow + 6) % 7) + 1; // 1 = Mon … 7 = Sun

    const isFuture = date > today;
    const statuses: Record<string, HabitStatus | null> = {};

    for (const h of habits) {
      let status: HabitStatus | null = null;
      if (!isFuture) {
        if (h.kind === "water") {
          status = waterStatusFor(waterByDate.get(date) ?? 0, goalMl);
        } else if (h.kind === "meal") {
          status = mealStatusFor(mealsByDate.get(date) ?? 0);
        } else {
          status = checkMap.get(`${h.id}|${date}`) ?? null;
        }
        if (status === "yes") yesByHabit[h.id] += 1;
      }
      statuses[h.id] = status;
    }

    days.push({
      date,
      isFuture,
      isToday: date === today,
      dayOfMonth: day,
      weekday: isoDow,
      statuses,
    });
  }

  return {
    year,
    month,
    monthStart: startISO,
    monthEnd: endISO,
    habits,
    days,
    yesByHabit,
  };
}

/** Quick helper for navigation: the (year, month) one step earlier/later. */
export function shiftMonth(year: number, month: number, delta: number) {
  const m0 = month - 1 + delta; // 0-indexed
  const y = year + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12;
  return { year: y, month: m + 1 };
}
