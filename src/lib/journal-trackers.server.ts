import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/date";
import type { HabitStatus, MealCookedBy, MealKey } from "@/lib/habits";
import {
  MEAL_COOKED_BY_LABEL,
  MEAL_ICON,
  mealHasCookingMeta,
  type SnackSlot,
} from "@/lib/habits";
import {
  INTAKE_ICON,
  INTAKE_LABEL,
  applicableIntakeKinds,
  type IntakeKind,
} from "@/lib/intake";
import { MEDIA_KIND_LABEL, type MediaKind } from "@/lib/media";
import { MOBILE_GAME_STEPS } from "@/lib/mobile-games";

const MEAL_LABEL_SV: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
};

const INTAKE_LABEL_SV: Record<IntakeKind, string> = {
  fruit: "Frukt",
  creatine: "Kreatin",
  vitamin: "Vitaminer",
  shake: "Shake",
};

export interface JournalDailyTrackers {
  meals: {
    id: string;
    meal: MealKey;
    description: string;
    waterMl: number;
    cookedBy: MealCookedBy | null;
    mealBoxes: number | null;
    loggedAt: string;
  }[];
  snacks: {
    slot: SnackSlot;
    description: string;
    loggedAt: string;
  }[];
  intake: {
    id: string;
    kind: IntakeKind;
    description: string;
    loggedAt: string;
  }[];
  waterLogs: {
    id: string;
    amountMl: number;
    note: string | null;
    loggedAt: string;
  }[];
  habits: {
    id: string;
    label: string;
    icon: string;
    status: HabitStatus;
    note: string | null;
    loggedAt: string;
  }[];
  activity: {
    steps: number | null;
    activityHours: number | null;
    loggedAt: string | null;
  };
  media: {
    title: string;
    kind: MediaKind;
    detail: string;
    loggedAt: string;
  } | null;
  mobileGames: {
    labels: string[];
    loggedAt: string;
  } | null;
}

function emptyTrackers(): Omit<JournalDailyTrackers, never> {
  return {
    meals: [],
    snacks: [],
    intake: [],
    waterLogs: [],
    habits: [],
    activity: { steps: null, activityHours: null, loggedAt: null },
    media: null,
    mobileGames: null,
  };
}

export async function getJournalTrackersForDate(
  userId: string,
  localDate: string,
): Promise<JournalDailyTrackers> {
  const map = await getJournalTrackersForWeek(userId, localDate, localDate);
  return map.get(localDate) ?? { ...emptyTrackers() };
}

export async function getJournalTrackersForWeek(
  userId: string,
  weekStart: string,
  weekEnd: string = weekStart,
): Promise<Map<string, JournalDailyTrackers>> {
  const supabase = await createClient();
  const result = new Map<string, JournalDailyTrackers>();

  for (let d = weekStart; d <= weekEnd; d = addDaysISO(d, 1)) {
    result.set(d, { ...emptyTrackers() });
  }

  const [
    mealsRes,
    snacksRes,
    intakeRes,
    waterRes,
    habitsRes,
    checksRes,
    activityRes,
    mediaRes,
    gamesRes,
  ] = await Promise.all([
    supabase
      .from("meal_entries")
      .select("id, local_date, meal, description, water_log_id, cooked_by, meal_boxes, created_at")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("snack_checks")
      .select("local_date, slot, description, done_at")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("intake_entries")
      .select("id, local_date, kind, description, water_log_id, created_at")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("water_logs")
      .select("id, local_date, amount_ml, note, logged_at")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd)
      .not("note", "is", null),
    supabase
      .from("habits")
      .select("id, label, icon, kind")
      .eq("user_id", userId)
      .eq("kind", "tri_state")
      .is("archived_at", null),
    supabase
      .from("habit_checks")
      .select("id, habit_id, local_date, status, note, updated_at")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd)
      .in("status", ["yes", "half"]),
    supabase
      .from("daily_activity_logs")
      .select("local_date, steps, activity_hours, updated_at")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("media_daily_logs")
      .select("local_date, media_item_id, position, did_consume, updated_at")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("mobile_game_daily_logs")
      .select(
        "local_date, chess_done, duolingo_done, pokemon_go_done, updated_at",
      )
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
  ]);

  const waterLogIds = (mealsRes.data ?? [])
    .map((m) => m.water_log_id)
    .filter((v): v is string => Boolean(v));
  const waterMap = new Map<string, number>();
  if (waterLogIds.length > 0) {
    const { data: mealWater } = await supabase
      .from("water_logs")
      .select("id, amount_ml")
      .in("id", waterLogIds);
    for (const w of mealWater ?? []) waterMap.set(w.id, w.amount_ml);
  }

  const habitById = new Map(
    (habitsRes.data ?? []).map((h) => [h.id, h]),
  );
  const mediaItemIds = new Set<string>();
  const mediaRows: {
    local_date: string;
    media_item_id: string;
    position: number;
    did_consume: boolean;
    updated_at: string;
  }[] = [];

  for (const row of mealsRes.data ?? []) {
    const day = result.get(row.local_date);
    if (!day) continue;
    day.meals.push({
      id: row.id,
      meal: row.meal as MealKey,
      description: row.description,
      waterMl: row.water_log_id ? waterMap.get(row.water_log_id) ?? 0 : 0,
      cookedBy: (row.cooked_by as MealCookedBy | null) ?? null,
      mealBoxes: row.meal_boxes,
      loggedAt: row.created_at,
    });
  }

  for (const row of snacksRes.data ?? []) {
    const day = result.get(row.local_date);
    if (!day || (row.slot !== 1 && row.slot !== 2)) continue;
    day.snacks.push({
      slot: row.slot as SnackSlot,
      description: row.description ?? "",
      loggedAt: row.done_at,
    });
  }

  for (const row of intakeRes.data ?? []) {
    const day = result.get(row.local_date);
    if (!day) continue;
    const kind = row.kind as IntakeKind;
    if (!applicableIntakeKinds(row.local_date).includes(kind)) continue;
    day.intake.push({
      id: row.id,
      kind,
      description:
        kind === "creatine" || kind === "shake"
          ? ""
          : row.description,
      loggedAt: row.created_at,
    });
  }

  const linkedWaterIds = new Set<string>();
  for (const row of mealsRes.data ?? []) {
    if (row.water_log_id) linkedWaterIds.add(row.water_log_id);
  }
  for (const row of intakeRes.data ?? []) {
    if (row.water_log_id) linkedWaterIds.add(row.water_log_id);
  }

  for (const row of waterRes.data ?? []) {
    const day = result.get(row.local_date);
    if (!day || !row.note?.trim() || linkedWaterIds.has(row.id)) continue;
    day.waterLogs.push({
      id: row.id,
      amountMl: row.amount_ml,
      note: row.note,
      loggedAt: row.logged_at,
    });
  }

  for (const row of checksRes.data ?? []) {
    const habit = habitById.get(row.habit_id);
    const day = result.get(row.local_date);
    if (!habit || !day) continue;
    day.habits.push({
      id: row.id,
      label: habit.label,
      icon: habit.icon,
      status: row.status as HabitStatus,
      note: row.note,
      loggedAt: row.updated_at,
    });
  }

  for (const row of activityRes.data ?? []) {
    const day = result.get(row.local_date);
    if (!day) continue;
    if (row.steps == null && row.activity_hours == null) continue;
    day.activity = {
      steps: row.steps,
      activityHours:
        row.activity_hours != null ? Number(row.activity_hours) : null,
      loggedAt: row.updated_at,
    };
  }

  for (const row of mediaRes.data ?? []) {
    const day = result.get(row.local_date);
    if (!day) continue;
    mediaItemIds.add(row.media_item_id);
    mediaRows.push(row);
  }

  const mediaItemMap = new Map<string, { title: string; kind: MediaKind }>();
  if (mediaItemIds.size > 0) {
    const { data: items } = await supabase
      .from("media_items")
      .select("id, title, kind")
      .in("id", [...mediaItemIds]);
    for (const item of items ?? []) {
      mediaItemMap.set(item.id, {
        title: item.title,
        kind: item.kind as MediaKind,
      });
    }
  }

  for (const row of mediaRows) {
    const day = result.get(row.local_date);
    const item = mediaItemMap.get(row.media_item_id);
    if (!day || !item) continue;
    const kind = item.kind;
    let detail = "";
    if (kind === "movie") {
      detail = row.did_consume ? "såg filmen" : `position ${row.position}`;
    } else if (kind === "book") {
      detail = `sida ${row.position}`;
    } else {
      detail = `avsnitt ${row.position}`;
    }
    day.media = {
      title: item.title,
      kind: item.kind,
      detail,
      loggedAt: row.updated_at,
    };
  }

  for (const row of gamesRes.data ?? []) {
    const day = result.get(row.local_date);
    if (!day) continue;
    const labels = MOBILE_GAME_STEPS.filter((g) => {
      if (g.key === "chess") return row.chess_done;
      if (g.key === "duolingo") return row.duolingo_done;
      return row.pokemon_go_done;
    }).map((g) => g.label);
    if (labels.length === 0) continue;
    day.mobileGames = { labels, loggedAt: row.updated_at };
  }

  return result;
}

export function mealJournalBody(
  meal: MealKey,
  description: string,
  _waterMl: number,
  cookedBy: MealCookedBy | null = null,
  mealBoxes: number | null = null,
): string {
  const parts = [description.trim()];
  if (mealHasCookingMeta(meal) && cookedBy) {
    parts.push(MEAL_COOKED_BY_LABEL[cookedBy]);
  }
  if (mealHasCookingMeta(meal) && mealBoxes != null && mealBoxes > 0) {
    parts.push(`${mealBoxes} matlåd${mealBoxes === 1 ? "a" : "or"}`);
  }
  return parts.join(" · ");
}

export function mealJournalTitle(meal: MealKey): string {
  return MEAL_LABEL_SV[meal];
}

export function mealJournalIcon(meal: MealKey): string {
  return MEAL_ICON[meal];
}

export function intakeJournalTitle(kind: IntakeKind): string {
  return INTAKE_LABEL_SV[kind] ?? INTAKE_LABEL[kind];
}

export function intakeJournalIcon(kind: IntakeKind): string {
  return INTAKE_ICON[kind];
}
