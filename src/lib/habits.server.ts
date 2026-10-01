import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, isoWeekdayFromLocalISO, todayLocalISO } from "@/lib/date";
import {
  type DailyHabit,
  type DailySnacks,
  type Habit,
  type HabitKind,
  type HabitStatus,
  type MealEntry,
  type MealKey,
  type SnackSlot,
  habitDayContext,
  habitOccursOnDate,
  habitStatusPoints,
  habitVisibleOnDay,
  parseHabitWeekdays,
  type HabitDayContext,
  numericGoalStatus,
  statusOrMissedOnPastDay,
  waterStatusFor,
  WEEK_PROGRESS_HABIT_KEYS,
  type WeekHabitDayDetails,
} from "@/lib/habits";
import type { Weekday } from "@/lib/tasks";
import { parseShakeQuantity, type ShakeBatch } from "@/lib/shake-schedule";
import { applicableIntakeKinds } from "@/lib/intake";
import {
  hiddenPartKeys,
  habitVisibilityParts,
  intakeStatusForVisible,
  isMealKey,
  mealStatusForVisible,
  mobileGamesStatusForVisible,
  parsePartVisibility,
  smokeStatusForVisible,
  snackStatusForVisible,
} from "@/lib/habit-parts";
import { MOBILE_GAME_STEPS } from "@/lib/mobile-games";
import {
  SMOKE_FREE_SUBSTANCES,
  type DailySmokeFreeContext,
} from "@/lib/smoke-free";
import { mediaStatusFor, type MediaDayLog } from "@/lib/media";
import { liveStatusFor } from "@/lib/live-events";
import { isMoodKey, moodStatusFor, type MoodKey } from "@/lib/mood";
import { leaveKindByDate } from "@/lib/leave";
import { getLeavePeriodsInRange } from "@/lib/leave.server";
import { getWorkLogsInRange } from "@/lib/work.server";
import {
  journalTrackedItemDescription,
  snackSlotFromJournalEntryId,
} from "@/lib/journal";

function addLoggedKey(
  map: Map<string, Set<string>>,
  date: string,
  key: string,
) {
  const set = map.get(date) ?? new Set<string>();
  set.add(key);
  map.set(date, set);
}

function smokeFreeContextFromRow(
  localDate: string,
  nicotineRaw: string | null | undefined,
  cannabisRaw: string | null | undefined,
  hasRow: boolean,
): DailySmokeFreeContext {
  const nicotine =
    nicotineRaw === "yes" || nicotineRaw === "half" || nicotineRaw === "no"
      ? nicotineRaw
      : null;
  const cannabis =
    cannabisRaw === "yes" || cannabisRaw === "half" || cannabisRaw === "no"
      ? cannabisRaw
      : null;
  return {
    localDate,
    nicotine,
    cannabis,
    hasLog: hasRow && (nicotine !== null || cannabis !== null),
  };
}

interface HabitRow {
  id: string;
  key: string;
  label: string;
  kind: HabitKind;
  icon: string;
  accent: string;
  sort_order: number;
  category_id: string | null;
  enabled: boolean;
  show_on_vacation: boolean | null;
  show_on_day_off: boolean | null;
  show_on_sick: boolean | null;
  show_on_weekend: boolean | null;
  part_visibility: unknown;
  interval_days: number | null;
  interval_anchor_date: string | null;
  weekdays: number[] | null;
  shake_reset_on: string | null;
  shake_skipped_on: string | null;
}

const HABIT_COLUMNS =
  "id, key, label, kind, icon, accent, sort_order, category_id, enabled, show_on_vacation, show_on_day_off, show_on_sick, show_on_weekend, part_visibility, interval_days, interval_anchor_date, weekdays, shake_reset_on, shake_skipped_on";

function rowToHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    kind: r.kind,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    categoryId: r.category_id,
    enabled: r.enabled ?? true,
    showOnVacation: r.show_on_vacation ?? true,
    showOnDayOff: r.show_on_day_off ?? true,
    showOnSick: r.show_on_sick ?? true,
    showOnWeekend: r.show_on_weekend ?? true,
    partVisibility: parsePartVisibility(r.part_visibility),
    intervalDays: Math.max(1, r.interval_days ?? 1),
    intervalAnchorDate: r.interval_anchor_date,
    weekdays: parseHabitWeekdays(r.weekdays),
    shakeResetOn: r.shake_reset_on,
    shakeSkippedOn: r.shake_skipped_on,
  };
}

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return dates;
}

async function habitContextsForRange(
  userId: string,
  start: string,
  end: string,
): Promise<Map<string, HabitDayContext>> {
  const [periods, work] = await Promise.all([
    getLeavePeriodsInRange(userId, start, end),
    getWorkLogsInRange(userId, start, end),
  ]);
  const leaveByDate = leaveKindByDate(periods);
  const map = new Map<string, HabitDayContext>();
  for (const date of eachDate(start, end)) {
    map.set(
      date,
      habitDayContext({
        localDate: date,
        leaveKind: leaveByDate.get(date) ?? null,
        workKind: work.get(date)?.kind ?? null,
      }),
    );
  }
  return map;
}

async function getGorShakeBatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  habits: { id: string; key: string }[],
  throughDate?: string,
): Promise<ShakeBatch[]> {
  const habit = habits.find((h) => h.key === "gor_shake");
  if (!habit) return [];
  let query = supabase
    .from("habit_checks")
    .select("local_date, quantity")
    .eq("user_id", userId)
    .eq("habit_id", habit.id)
    .eq("status", "yes")
    .not("quantity", "is", null)
    .order("local_date", { ascending: true });
  if (throughDate) query = query.lte("local_date", throughDate);
  const { data } = await query;
  const batches: ShakeBatch[] = [];
  for (const row of data ?? []) {
    const quantity = parseShakeQuantity(row.quantity);
    if (quantity == null) continue;
    batches.push({ madeOn: row.local_date, quantity });
  }
  return batches;
}

export interface GorShakeWeekPlan {
  habitId: string;
  label: string;
  icon: string;
  accent: string;
  weekday: Weekday | null;
  done: boolean;
}

/** Week-plan chip for Gör shake: on the due day this week, otherwise leftover. */
export async function getGorShakeWeekPlan(
  userId: string,
  weekStart: string,
): Promise<GorShakeWeekPlan | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("habits")
    .select(HABIT_COLUMNS)
    .eq("user_id", userId)
    .eq("key", "gor_shake")
    .is("archived_at", null)
    .eq("enabled", true)
    .maybeSingle();
  if (!row) return null;

  const habit = rowToHabit(row);
  const batches = await getGorShakeBatches(supabase, userId, [habit]);
  const weekEnd = addDaysISO(weekStart, 6);
  const { data: checks } = await supabase
    .from("habit_checks")
    .select("local_date, status")
    .eq("user_id", userId)
    .eq("habit_id", habit.id)
    .gte("local_date", weekStart)
    .lte("local_date", weekEnd);

  const checkByDate = new Map<string, HabitStatus>();
  for (const c of checks ?? []) {
    checkByDate.set(c.local_date, c.status);
  }

  const today = todayLocalISO();
  const dayContexts = await habitContextsForRange(userId, weekStart, weekEnd);
  let weekday: Weekday | null = null;
  let done = false;
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(weekStart, i);
    const status = checkByDate.get(date) ?? null;
    const occurs = habitOccursOnDate(habit, date, {
      shakeCompleted: status != null,
      shakeBatches: batches,
    });
    const ctx = dayContexts.get(date);
    if (!occurs || (ctx && !habitVisibleOnDay(habit, ctx))) continue;
    const isoDow = isoWeekdayFromLocalISO(date) as Weekday;
    if (weekday == null || date === today) {
      weekday = isoDow;
      done = status === "yes";
    }
    if (date === today) break;
  }

  return {
    habitId: habit.id,
    label: habit.label,
    icon: habit.icon,
    accent: habit.accent,
    weekday,
    done,
  };
}

export interface DailyTrackerGoals {
  waterGoalMl: number;
  stepsGoal: number;
  activityHoursGoal: number;
}

export interface DayPlanSettings {
  habits: Habit[];
  goals: DailyTrackerGoals;
}

export interface DailyActivityLog {
  localDate: string;
  steps: number | null;
  activityHours: number | null;
}

/** All non-archived habits + profile goals for the day plan screen. */
export async function getDayPlanSettings(userId: string): Promise<DayPlanSettings> {
  const supabase = await createClient();
  const [habitsRes, profileRes] = await Promise.all([
    supabase
      .from("habits")
      .select(HABIT_COLUMNS)
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("profiles")
      .select(
        "daily_water_goal_ml, daily_steps_goal, daily_activity_hours_goal",
      )
      .eq("id", userId)
      .maybeSingle(),
  ]);

  return {
    habits: (habitsRes.data ?? []).map(rowToHabit),
    goals: {
      waterGoalMl: profileRes.data?.daily_water_goal_ml ?? 2500,
      stepsGoal: profileRes.data?.daily_steps_goal ?? 8000,
      activityHoursGoal: Number(
        profileRes.data?.daily_activity_hours_goal ?? 12,
      ),
    },
  };
}

export async function getDailySnacks(
  userId: string,
  localDate: string,
): Promise<DailySnacks> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("snack_checks")
    .select("slot, description")
    .eq("user_id", userId)
    .eq("local_date", localDate);

  const out: DailySnacks = { 1: null, 2: null };
  for (const r of data ?? []) {
    const slot = r.slot as SnackSlot;
    if (slot === 1 || slot === 2) {
      out[slot] = {
        id: `${localDate}-${slot}`,
        slot,
        description: r.description ?? "",
      };
    }
  }

  const { data: edits } = await supabase
    .from("journal_entry_edits")
    .select("entry_id, body")
    .eq("user_id", userId)
    .eq("local_date", localDate);
  for (const edit of edits ?? []) {
    const slot = snackSlotFromJournalEntryId(edit.entry_id);
    const entry = slot ? out[slot] : null;
    const description = journalTrackedItemDescription(edit.body);
    if (!entry || !description) continue;
    entry.description = description;
  }

  return out;
}

export async function getDailyActivityLog(
  userId: string,
  localDate: string,
): Promise<DailyActivityLog> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_activity_logs")
    .select("steps, activity_hours")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();

  return {
    localDate,
    steps: data?.steps ?? null,
    activityHours:
      data?.activity_hours != null ? Number(data.activity_hours) : null,
  };
}

/** All active habits for the user, ordered for display. */
export async function getHabits(userId: string): Promise<Habit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habits")
    .select(HABIT_COLUMNS)
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

  const [
    habitsRes,
    checksRes,
    waterRes,
    profileRes,
    mealsRes,
    activityRes,
    snacksRes,
    intakeRes,
    mediaLogRes,
    mobileGamesRes,
    moodRes,
    liveAttendedRes,
    smokeFreeRes,
  ] = await Promise.all([
    supabase
      .from("habits")
      .select(HABIT_COLUMNS)
      .eq("user_id", userId)
      .is("archived_at", null)
      .eq("enabled", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habit_checks")
      .select("habit_id, status, note, quantity")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("water_logs")
      .select("amount_ml")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("profiles")
      .select(
        "daily_water_goal_ml, daily_steps_goal, daily_activity_hours_goal",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("meal_entries")
      .select("meal")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("daily_activity_logs")
      .select("steps, activity_hours")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .maybeSingle(),
    supabase
      .from("snack_checks")
      .select("slot")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("intake_entries")
      .select("kind")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("media_daily_logs")
      .select("media_item_id, position, did_consume")
      .eq("user_id", userId)
      .eq("local_date", localDate),
    supabase
      .from("mobile_game_daily_logs")
      .select("chess_done, duolingo_done, pokemon_go_done")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .maybeSingle(),
    supabase
      .from("mood_daily_logs")
      .select("mood, note, created_at")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .maybeSingle(),
    supabase
      .from("live_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_date", localDate)
      .not("attended_at", "is", null),
    supabase
      .from("smoke_free_daily_logs")
      .select("nicotine_status, cannabis_status")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .maybeSingle(),
  ]);

  const habits = habitsRes.data ?? [];
  const checks = checksRes.data ?? [];
  const shakeBatches = await getGorShakeBatches(
    supabase,
    userId,
    habits,
    localDate,
  );
  const goalMl = profileRes.data?.daily_water_goal_ml ?? 2500;
  const stepsGoal = profileRes.data?.daily_steps_goal ?? 8000;
  const activityHoursGoal = Number(
    profileRes.data?.daily_activity_hours_goal ?? 12,
  );
  const waterMl = (waterRes.data ?? []).reduce((acc, l) => acc + l.amount_ml, 0);
  const mealLoggedKeys = new Set(
    (mealsRes.data ?? [])
      .map((row) => row.meal)
      .filter((meal): meal is MealKey => isMealKey(meal)),
  );
  const snackLoggedKeys = new Set(
    (snacksRes.data ?? []).map((row) => String(row.slot)),
  );
  const intakeLoggedKeys = new Set(
    (intakeRes.data ?? []).map((row) => row.kind),
  );
  const visibility = (
    await habitContextsForRange(userId, localDate, localDate)
  ).get(localDate);
  const steps = activityRes.data?.steps ?? 0;
  const activityHours =
    activityRes.data?.activity_hours != null
      ? Number(activityRes.data.activity_hours)
      : 0;

  const checkByHabit = new Map<
    string,
    { status: HabitStatus; note: string | null; quantity: number | null }
  >();
  for (const c of checks) {
    checkByHabit.set(c.habit_id, {
      status: c.status,
      note: c.note,
      quantity: parseShakeQuantity(c.quantity),
    });
  }

  const mediaDayLogs: MediaDayLog[] = (mediaLogRes.data ?? []).map((row) => ({
    mediaItemId: row.media_item_id,
    position: row.position,
    didConsume: row.did_consume,
  }));
  const mobileGamesCtx = {
    localDate,
    chess: mobileGamesRes.data?.chess_done ?? false,
    duolingo: mobileGamesRes.data?.duolingo_done ?? false,
    pokemonGo: mobileGamesRes.data?.pokemon_go_done ?? false,
    hasLog: Boolean(mobileGamesRes.data),
  };
  const moodKey =
    moodRes.data?.mood && isMoodKey(moodRes.data.mood)
      ? (moodRes.data.mood as MoodKey)
      : null;
  const moodCtx = {
    localDate,
    mood: moodKey,
    note: moodKey ? (moodRes.data?.note?.trim() || null) : null,
    loggedAt: moodKey ? (moodRes.data?.created_at ?? null) : null,
  };
  const smokeFreeCtx = smokeFreeContextFromRow(
    localDate,
    smokeFreeRes.data?.nicotine_status,
    smokeFreeRes.data?.cannabis_status,
    Boolean(smokeFreeRes.data),
  );

  return habits
    .map((row): DailyHabit => {
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
    const hidden = visibility ? hiddenPartKeys(habit, visibility) : [];
    if (habit.kind === "meal") {
      const mealsLogged = [...mealLoggedKeys].filter(
        (key) => !hidden.includes(key),
      ).length;
      return {
        ...habit,
        status: isFuture ? null : mealStatusForVisible(mealLoggedKeys, hidden),
        note: null,
        mealsLogged,
      };
    }
    if (habit.kind === "snack") {
      const snacksDone = [...snackLoggedKeys].filter(
        (key) => !hidden.includes(key),
      ).length;
      return {
        ...habit,
        status: isFuture ? null : snackStatusForVisible(snackLoggedKeys, hidden),
        note: null,
        snacksDone,
      };
    }
    if (habit.kind === "intake") {
      const intakeKinds = applicableIntakeKinds(localDate).filter(
        (kind) => !hidden.includes(kind),
      );
      return {
        ...habit,
        status: isFuture
          ? null
          : intakeStatusForVisible(intakeLoggedKeys, intakeKinds),
        note: null,
        intakeLogged: intakeKinds.filter((kind) => intakeLoggedKeys.has(kind))
          .length,
        intakeTotal: intakeKinds.length,
      };
    }
    if (habit.kind === "steps") {
      const progress = stepsGoal > 0 ? steps / stepsGoal : 0;
      return {
        ...habit,
        status: isFuture ? null : numericGoalStatus(steps, stepsGoal),
        note: null,
        metricValue: steps,
        metricGoal: stepsGoal,
        progress,
      };
    }
    if (habit.kind === "activity_hours") {
      const progress =
        activityHoursGoal > 0 ? activityHours / activityHoursGoal : 0;
      return {
        ...habit,
        status: isFuture
          ? null
          : numericGoalStatus(activityHours, activityHoursGoal),
        note: null,
        metricValue: activityHours,
        metricGoal: activityHoursGoal,
        progress,
      };
    }
    if (habit.kind === "media") {
      return {
        ...habit,
        status: isFuture ? null : mediaStatusFor(mediaDayLogs, isFuture),
        note: null,
      };
    }
    if (habit.kind === "live") {
      const attendedToday = (liveAttendedRes.data ?? []).length > 0;
      return {
        ...habit,
        status: isFuture ? null : liveStatusFor(attendedToday, isFuture),
        note: null,
      };
    }
    if (habit.kind === "mobile_games") {
      const visibleGames = MOBILE_GAME_STEPS.map((step) => step.key).filter(
        (key) => !hidden.includes(key),
      );
      return {
        ...habit,
        status: isFuture
          ? null
          : mobileGamesStatusForVisible(mobileGamesCtx, visibleGames),
        note: null,
      };
    }
    if (habit.kind === "smoke_free") {
      const visibleSmoke = SMOKE_FREE_SUBSTANCES.map((item) => item.key).filter(
        (key) => !hidden.includes(key),
      );
      return {
        ...habit,
        status: isFuture
          ? null
          : smokeStatusForVisible(smokeFreeCtx, visibleSmoke),
        note: null,
      };
    }
    if (habit.kind === "mood") {
      return {
        ...habit,
        status: isFuture ? null : moodStatusFor(moodCtx, isFuture),
        note: null,
        moodKey,
      };
    }
    const c = checkByHabit.get(habit.id);
    return {
      ...habit,
      status: c?.status ?? null,
      note: c?.note ?? null,
      quantity: c?.quantity ?? null,
      shakeBatches: habit.key === "gor_shake" ? shakeBatches : undefined,
    };
  })
    .filter((habit) =>
      habitOccursOnDate(habit, localDate, {
        shakeCompleted: habit.status != null,
        shakeBatches: habit.shakeBatches,
      }),
    );
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
    .select(
      "id, meal, description, water_log_id, cooked_by, meal_boxes, restaurant_id, cooked_by_name, from_meal_box, meal_box_stock_id, meal_restaurants(name)",
    )
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
    const restaurant = r.meal_restaurants as { name: string } | null;
    out[r.meal as MealKey] = {
      id: r.id,
      meal: r.meal as MealKey,
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
  }

  const { data: edits } = await supabase
    .from("journal_entry_edits")
    .select("entry_id, body")
    .eq("user_id", userId)
    .eq("local_date", localDate);
  for (const edit of edits ?? []) {
    if (!edit.entry_id.startsWith("meal-")) continue;
    const mealId = edit.entry_id.slice("meal-".length);
    const description = journalTrackedItemDescription(edit.body);
    if (!description) continue;
    for (const meal of Object.values(out)) {
      if (meal && meal.id === mealId) {
        meal.description = description;
      }
    }
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
  /** Habits hidden by semester, ledig, sjuk or helg settings. */
  hiddenHabitIds: string[];
  /** Habit id → part keys hidden that day (shake, breakfast, …). */
  hiddenParts: Record<string, string[]>;
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

  const [
    habitsRes,
    checksRes,
    waterRes,
    profileRes,
    mealsRes,
    activityRes,
    snacksRes,
    intakeRes,
    mobileGamesRes,
    moodRes,
    mediaLogRes,
    liveAttendedRes,
    smokeFreeRes,
  ] = await Promise.all([
    supabase
      .from("habits")
      .select(HABIT_COLUMNS)
      .eq("user_id", userId)
      .is("archived_at", null)
      .eq("enabled", true)
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
      .select(
        "daily_water_goal_ml, daily_steps_goal, daily_activity_hours_goal",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("meal_entries")
      .select("local_date, meal")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("daily_activity_logs")
      .select("local_date, steps, activity_hours")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("snack_checks")
      .select("local_date, slot")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("intake_entries")
      .select("local_date, kind")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("mobile_game_daily_logs")
      .select("local_date, chess_done, duolingo_done, pokemon_go_done")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("mood_daily_logs")
      .select("local_date, mood")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("media_daily_logs")
      .select("local_date, media_item_id, position, did_consume")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
    supabase
      .from("live_events")
      .select("event_date")
      .eq("user_id", userId)
      .not("attended_at", "is", null)
      .gte("event_date", startISO)
      .lte("event_date", endISO),
    supabase
      .from("smoke_free_daily_logs")
      .select("local_date, nicotine_status, cannabis_status")
      .eq("user_id", userId)
      .gte("local_date", startISO)
      .lte("local_date", endISO),
  ]);

  const habits = (habitsRes.data ?? []).map(rowToHabit);
  const shakeBatches = await getGorShakeBatches(
    supabase,
    userId,
    habits,
    endISO,
  );
  const goalMl = profileRes.data?.daily_water_goal_ml ?? 2500;
  const stepsGoal = profileRes.data?.daily_steps_goal ?? 8000;
  const activityHoursGoal = Number(
    profileRes.data?.daily_activity_hours_goal ?? 12,
  );

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

  const mealsByDate = new Map<string, Set<string>>();
  for (const m of mealsRes.data ?? []) {
    if (isMealKey(m.meal)) addLoggedKey(mealsByDate, m.local_date, m.meal);
  }

  const stepsByDate = new Map<string, number>();
  const activityHoursByDate = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    if (a.steps != null) stepsByDate.set(a.local_date, a.steps);
    if (a.activity_hours != null) {
      activityHoursByDate.set(a.local_date, Number(a.activity_hours));
    }
  }

  const snacksByDate = new Map<string, Set<string>>();
  for (const s of snacksRes.data ?? []) {
    addLoggedKey(snacksByDate, s.local_date, String(s.slot));
  }

  const intakeByDate = new Map<string, Set<string>>();
  for (const i of intakeRes.data ?? []) {
    addLoggedKey(intakeByDate, i.local_date, i.kind);
  }

  const mobileGamesByDate = new Map<
    string,
    {
      chess: boolean;
      duolingo: boolean;
      pokemonGo: boolean;
      hasLog: boolean;
    }
  >();
  for (const r of mobileGamesRes.data ?? []) {
    mobileGamesByDate.set(r.local_date, {
      chess: r.chess_done ?? false,
      duolingo: r.duolingo_done ?? false,
      pokemonGo: r.pokemon_go_done ?? false,
      hasLog: true,
    });
  }

  const smokeFreeByDate = new Map<string, DailySmokeFreeContext>();
  for (const r of smokeFreeRes.data ?? []) {
    smokeFreeByDate.set(
      r.local_date,
      smokeFreeContextFromRow(
        r.local_date,
        r.nicotine_status,
        r.cannabis_status,
        true,
      ),
    );
  }

  const moodByDate = new Map<string, MoodKey>();
  for (const r of moodRes.data ?? []) {
    if (isMoodKey(r.mood)) moodByDate.set(r.local_date, r.mood);
  }

  const mediaLogByDate = new Map<string, MediaDayLog[]>();
  for (const r of mediaLogRes.data ?? []) {
    const prev = mediaLogByDate.get(r.local_date) ?? [];
    prev.push({
      mediaItemId: r.media_item_id,
      position: r.position,
      didConsume: r.did_consume,
    });
    mediaLogByDate.set(r.local_date, prev);
  }

  const liveAttendedByDate = new Set<string>();
  for (const r of liveAttendedRes.data ?? []) {
    liveAttendedByDate.add(r.event_date);
  }

  const today = todayLocalISO();
  const dayContexts = await habitContextsForRange(userId, startISO, endISO);
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
    const hiddenHabitIds: string[] = [];
    const hiddenParts: Record<string, string[]> = {};
    const visibility = dayContexts.get(date);

    for (const h of habits) {
      if (visibility && !habitVisibleOnDay(h, visibility)) {
        hiddenHabitIds.push(h.id);
        statuses[h.id] = null;
        continue;
      }
      if (
        !habitOccursOnDate(h, date, {
          shakeCompleted: checkMap.has(`${h.id}|${date}`),
          shakeBatches,
        })
      ) {
        statuses[h.id] = null;
        continue;
      }
      const hidden = visibility ? hiddenPartKeys(h, visibility) : [];
      if (
        hidden.length > 0 &&
        hidden.length === habitVisibilityParts(h).length
      ) {
        hiddenHabitIds.push(h.id);
        statuses[h.id] = null;
        continue;
      }
      if (hidden.length > 0) hiddenParts[h.id] = hidden;
      if (
        h.kind === "intake" &&
        applicableIntakeKinds(date).filter((kind) => !hidden.includes(kind))
          .length === 0
      ) {
        hiddenHabitIds.push(h.id);
        statuses[h.id] = null;
        continue;
      }
      let status: HabitStatus | null = null;
      if (!isFuture) {
        if (h.kind === "water") {
          status = waterStatusFor(waterByDate.get(date) ?? 0, goalMl);
        } else if (h.kind === "meal") {
          status = mealStatusForVisible(mealsByDate.get(date) ?? new Set(), hidden);
        } else if (h.kind === "snack") {
          status = snackStatusForVisible(snacksByDate.get(date) ?? new Set(), hidden);
        } else if (h.kind === "intake") {
          const kinds = applicableIntakeKinds(date).filter(
            (kind) => !hidden.includes(kind),
          );
          status = intakeStatusForVisible(
            intakeByDate.get(date) ?? new Set(),
            kinds,
          );
        } else if (h.kind === "steps") {
          status = numericGoalStatus(stepsByDate.get(date) ?? 0, stepsGoal);
        } else if (h.kind === "activity_hours") {
          status = numericGoalStatus(
            activityHoursByDate.get(date) ?? 0,
            activityHoursGoal,
          );
        } else if (h.kind === "mobile_games") {
          const games = mobileGamesByDate.get(date);
          const visibleGames = MOBILE_GAME_STEPS.map((step) => step.key).filter(
            (key) => !hidden.includes(key),
          );
          status = games
            ? mobileGamesStatusForVisible(
                { localDate: date, ...games },
                visibleGames,
              )
            : null;
        } else if (h.kind === "smoke_free") {
          const smoke = smokeFreeByDate.get(date);
          const visibleSmoke = SMOKE_FREE_SUBSTANCES.map((item) => item.key).filter(
            (key) => !hidden.includes(key),
          );
          status = smoke ? smokeStatusForVisible(smoke, visibleSmoke) : null;
        } else if (h.kind === "mood") {
          status = moodStatusFor(
            {
              localDate: date,
              mood: moodByDate.get(date) ?? null,
              note: null,
            },
            false,
          );
        } else if (h.kind === "media") {
          status = mediaStatusFor(mediaLogByDate.get(date) ?? [], false);
        } else if (h.kind === "live") {
          status = liveStatusFor(liveAttendedByDate.has(date), false);
        } else {
          status = checkMap.get(`${h.id}|${date}`) ?? null;
        }
        if (status) yesByHabit[h.id] += habitStatusPoints(status);
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
      hiddenHabitIds,
      hiddenParts,
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

// ============================================================================
// Week habit aggregation (progress view)
// ============================================================================

/** Habit keys shown in the week "Hur det går" progress board. */
export { WEEK_PROGRESS_HABIT_KEYS } from "@/lib/habits";

export interface WeekHabitDay {
  date: string;
  isFuture: boolean;
  isToday: boolean;
  weekday: number;
  statuses: Record<string, HabitStatus | null>;
  /** Habits hidden by semester, ledig, sjuk or helg settings. */
  hiddenHabitIds: string[];
  /** Habit id → part keys hidden that day (shake, breakfast, …). */
  hiddenParts: Record<string, string[]>;
  /** Water row hidden for the same reason. Water is not in `habits`. */
  hideWater: boolean;
  /** Selected mood for the day, when logged. */
  mood: MoodKey | null;
  /** Optional comment on the day's mood. */
  moodNote: string | null;
  /** Sub-item breakdown for expandable week rows. */
  details: WeekHabitDayDetails;
}

export interface WeekHabitSummary {
  weekStart: string;
  weekEnd: string;
  habits: Habit[];
  days: WeekHabitDay[];
  yesByHabit: Record<string, number>;
}

function filterWeekProgressHabits(habits: Habit[]): Habit[] {
  const keys = new Set<string>(WEEK_PROGRESS_HABIT_KEYS);
  return habits.filter((h) => keys.has(h.key));
}

/** Per-day habit status for the week progress board (Mon–Sun). */
export async function getWeekHabitSummary(
  userId: string,
  weekStart: string,
): Promise<WeekHabitSummary> {
  const supabase = await createClient();
  const weekEnd = addDaysISO(weekStart, 6);

  const [
    habitsRes,
    checksRes,
    waterRes,
    profileRes,
    mealsRes,
    activityRes,
    snacksRes,
    intakeRes,
    mobileGamesRes,
    moodRes,
    mediaLogRes,
    liveAttendedWeekRes,
    smokeFreeRes,
  ] = await Promise.all([
    supabase
      .from("habits")
      .select(HABIT_COLUMNS)
      .eq("user_id", userId)
      .is("archived_at", null)
      .eq("enabled", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habit_checks")
      .select("habit_id, local_date, status")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("water_logs")
      .select("amount_ml, local_date")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("profiles")
      .select(
        "daily_water_goal_ml, daily_steps_goal, daily_activity_hours_goal",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("meal_entries")
      .select("local_date, meal")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("daily_activity_logs")
      .select("local_date, steps, activity_hours")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("snack_checks")
      .select("local_date, slot")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("intake_entries")
      .select("local_date, kind")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("mobile_game_daily_logs")
      .select("local_date, chess_done, duolingo_done, pokemon_go_done")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("mood_daily_logs")
      .select("local_date, mood, note")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("media_daily_logs")
      .select("local_date, media_item_id, position, did_consume")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("live_events")
      .select("event_date")
      .eq("user_id", userId)
      .not("attended_at", "is", null)
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd),
    supabase
      .from("smoke_free_daily_logs")
      .select("local_date, nicotine_status, cannabis_status")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
  ]);

  const allHabits = (habitsRes.data ?? []).map(rowToHabit);
  const habits = filterWeekProgressHabits(allHabits);
  const shakeBatches = await getGorShakeBatches(
    supabase,
    userId,
    allHabits,
    weekEnd,
  );
  const goalMl = profileRes.data?.daily_water_goal_ml ?? 2500;
  const stepsGoal = profileRes.data?.daily_steps_goal ?? 8000;
  const activityHoursGoal = Number(
    profileRes.data?.daily_activity_hours_goal ?? 12,
  );

  const checkMap = new Map<string, HabitStatus>();
  for (const c of checksRes.data ?? []) {
    checkMap.set(`${c.habit_id}|${c.local_date}`, c.status);
  }

  const waterByDate = new Map<string, number>();
  for (const w of waterRes.data ?? []) {
    waterByDate.set(w.local_date, (waterByDate.get(w.local_date) ?? 0) + w.amount_ml);
  }

  const mealsByDate = new Map<string, Set<string>>();
  for (const m of mealsRes.data ?? []) {
    if (isMealKey(m.meal)) addLoggedKey(mealsByDate, m.local_date, m.meal);
  }

  const stepsByDate = new Map<string, number>();
  const activityHoursByDate = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    if (a.steps != null) stepsByDate.set(a.local_date, a.steps);
    if (a.activity_hours != null) {
      activityHoursByDate.set(a.local_date, Number(a.activity_hours));
    }
  }

  const snacksByDate = new Map<string, Set<string>>();
  for (const s of snacksRes.data ?? []) {
    addLoggedKey(snacksByDate, s.local_date, String(s.slot));
  }

  const intakeByDate = new Map<string, Set<string>>();
  for (const i of intakeRes.data ?? []) {
    addLoggedKey(intakeByDate, i.local_date, i.kind);
  }

  const mobileGamesByDate = new Map<
    string,
    {
      chess: boolean;
      duolingo: boolean;
      pokemonGo: boolean;
      hasLog: boolean;
    }
  >();
  for (const r of mobileGamesRes.data ?? []) {
    mobileGamesByDate.set(r.local_date, {
      chess: r.chess_done ?? false,
      duolingo: r.duolingo_done ?? false,
      pokemonGo: r.pokemon_go_done ?? false,
      hasLog: true,
    });
  }

  const smokeFreeByDate = new Map<string, DailySmokeFreeContext>();
  for (const r of smokeFreeRes.data ?? []) {
    smokeFreeByDate.set(
      r.local_date,
      smokeFreeContextFromRow(
        r.local_date,
        r.nicotine_status,
        r.cannabis_status,
        true,
      ),
    );
  }

  const moodByDate = new Map<string, MoodKey>();
  const moodNoteByDate = new Map<string, string | null>();
  for (const r of moodRes.data ?? []) {
    if (isMoodKey(r.mood)) {
      moodByDate.set(r.local_date, r.mood);
      moodNoteByDate.set(r.local_date, r.note?.trim() || null);
    }
  }

  const mediaLogByDate = new Map<string, MediaDayLog[]>();
  for (const r of mediaLogRes.data ?? []) {
    const prev = mediaLogByDate.get(r.local_date) ?? [];
    prev.push({
      mediaItemId: r.media_item_id,
      position: r.position,
      didConsume: r.did_consume,
    });
    mediaLogByDate.set(r.local_date, prev);
  }

  const liveAttendedByDate = new Set<string>();
  for (const r of liveAttendedWeekRes.data ?? []) {
    liveAttendedByDate.add(r.event_date);
  }

  const today = todayLocalISO();
  const dayContexts = await habitContextsForRange(userId, weekStart, weekEnd);
  const waterHabit = allHabits.find((h) => h.key === "water");
  const days: WeekHabitDay[] = [];
  const yesByHabit: Record<string, number> = Object.fromEntries(
    habits.map((h) => [h.id, 0]),
  );

  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(weekStart, i);
    const isFuture = date > today;
    const isToday = date === today;
    const dayCtx = { isFuture, isToday };
    const statuses: Record<string, HabitStatus | null> = {};
    const hiddenHabitIds: string[] = [];
    const hiddenParts: Record<string, string[]> = {};
    const visibility = dayContexts.get(date);

    for (const h of habits) {
      if (visibility && !habitVisibleOnDay(h, visibility)) {
        hiddenHabitIds.push(h.id);
        statuses[h.id] = null;
        continue;
      }
      if (
        !habitOccursOnDate(h, date, {
          shakeCompleted: checkMap.has(`${h.id}|${date}`),
          shakeBatches,
        })
      ) {
        statuses[h.id] = null;
        continue;
      }
      const hidden = visibility ? hiddenPartKeys(h, visibility) : [];
      if (
        hidden.length > 0 &&
        hidden.length === habitVisibilityParts(h).length
      ) {
        hiddenHabitIds.push(h.id);
        statuses[h.id] = null;
        continue;
      }
      if (hidden.length > 0) hiddenParts[h.id] = hidden;
      if (
        h.kind === "intake" &&
        applicableIntakeKinds(date).filter((kind) => !hidden.includes(kind))
          .length === 0
      ) {
        hiddenHabitIds.push(h.id);
        statuses[h.id] = null;
        continue;
      }
      let status: HabitStatus | null = null;
      if (!isFuture) {
        if (h.kind === "water") {
          status = waterStatusFor(waterByDate.get(date) ?? 0, goalMl);
        } else if (h.kind === "meal") {
          status = mealStatusForVisible(mealsByDate.get(date) ?? new Set(), hidden);
        } else if (h.kind === "snack") {
          status = snackStatusForVisible(snacksByDate.get(date) ?? new Set(), hidden);
        } else if (h.kind === "intake") {
          const kinds = applicableIntakeKinds(date).filter(
            (kind) => !hidden.includes(kind),
          );
          status = intakeStatusForVisible(
            intakeByDate.get(date) ?? new Set(),
            kinds,
          );
        } else if (h.kind === "steps") {
          status = numericGoalStatus(stepsByDate.get(date) ?? 0, stepsGoal);
        } else if (h.kind === "activity_hours") {
          status = numericGoalStatus(
            activityHoursByDate.get(date) ?? 0,
            activityHoursGoal,
          );
        } else if (h.kind === "mobile_games") {
          const games = mobileGamesByDate.get(date);
          const visibleGames = MOBILE_GAME_STEPS.map((step) => step.key).filter(
            (key) => !hidden.includes(key),
          );
          status = games
            ? mobileGamesStatusForVisible(
                { localDate: date, ...games },
                visibleGames,
              )
            : null;
        } else if (h.kind === "smoke_free") {
          const smoke = smokeFreeByDate.get(date);
          const visibleSmoke = SMOKE_FREE_SUBSTANCES.map((item) => item.key).filter(
            (key) => !hidden.includes(key),
          );
          status = smoke ? smokeStatusForVisible(smoke, visibleSmoke) : null;
        } else if (h.kind === "mood") {
          status = moodStatusFor(
            {
              localDate: date,
              mood: moodByDate.get(date) ?? null,
              note: null,
            },
            false,
          );
        } else if (h.kind === "media") {
          status = mediaStatusFor(mediaLogByDate.get(date) ?? [], false);
        } else if (h.kind === "live") {
          status = liveStatusFor(liveAttendedByDate.has(date), false);
        } else {
          status = checkMap.get(`${h.id}|${date}`) ?? null;
        }
        if (status) yesByHabit[h.id] += habitStatusPoints(status);
      }
      // Meals/snacks: empty (nothing logged) stays empty; 1 meal is "no".
      statuses[h.id] =
        h.kind === "meal" || h.kind === "snack"
          ? status
          : statusOrMissedOnPastDay(status, dayCtx);
    }

    const smokeCtx = smokeFreeByDate.get(date);
    const gamesCtx = mobileGamesByDate.get(date);
    const sugarFreeHabit = habits.find((h) => h.key === "sugar_free");

    days.push({
      date,
      isFuture,
      isToday,
      weekday: isoWeekdayFromLocalISO(date),
      statuses,
      hiddenHabitIds,
      hiddenParts,
      hideWater: Boolean(
        waterHabit && visibility && !habitVisibleOnDay(waterHabit, visibility),
      ),
      mood: isFuture ? null : (moodByDate.get(date) ?? null),
      moodNote: isFuture ? null : (moodNoteByDate.get(date) ?? null),
      details: {
        water: { totalMl: waterByDate.get(date) ?? 0, goalMl: goalMl },
        intake: Object.fromEntries(
          applicableIntakeKinds(date).map((k) => [
            k,
            intakeByDate.get(date)?.has(k) ?? false,
          ]),
        ),
        mobileGames: gamesCtx
          ? {
              chess: gamesCtx.chess,
              duolingo: gamesCtx.duolingo,
              pokemonGo: gamesCtx.pokemonGo,
            }
          : undefined,
        smokeFree: smokeCtx
          ? {
              nicotine: smokeCtx.nicotine,
              cannabis: smokeCtx.cannabis,
            }
          : undefined,
        steps: { value: stepsByDate.get(date) ?? 0, goal: stepsGoal },
        activity: {
          value: activityHoursByDate.get(date) ?? 0,
          goal: activityHoursGoal,
        },
        sugarFree:
          sugarFreeHabit && !isFuture
            ? statusOrMissedOnPastDay(
                checkMap.get(`${sugarFreeHabit.id}|${date}`) ?? null,
                dayCtx,
              )
            : null,
      },
    });
  }

  return { weekStart, weekEnd, habits, days, yesByHabit };
}

/** Quick helper for navigation: the (year, month) one step earlier/later. */
export function shiftMonth(year: number, month: number, delta: number) {
  const m0 = month - 1 + delta; // 0-indexed
  const y = year + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12;
  return { year: y, month: m + 1 };
}
