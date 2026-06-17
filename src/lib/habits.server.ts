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
  mealStatusFor,
  numericGoalStatus,
  snackStatusFor,
  waterStatusFor,
} from "@/lib/habits";
import { applicableIntakeKinds, intakeStatusFor } from "@/lib/intake";
import { mobileGamesStatusFor } from "@/lib/mobile-games";
import { mediaStatusFor, type MediaDayLog } from "@/lib/media";
import { isMoodKey, moodStatusFor, type MoodKey } from "@/lib/mood";

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
    categoryId: r.category_id,
    enabled: r.enabled ?? true,
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
      .select(
        "id, key, label, kind, icon, accent, sort_order, category_id, enabled",
      )
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
    .select(
      "id, key, label, kind, icon, accent, sort_order, category_id, enabled",
    )
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
  ] = await Promise.all([
    supabase
      .from("habits")
      .select(
        "id, key, label, kind, icon, accent, sort_order, category_id, enabled",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .eq("enabled", true)
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
      .eq("local_date", localDate)
      .maybeSingle(),
    supabase
      .from("mobile_game_daily_logs")
      .select("chess_done, duolingo_done, pokemon_go_done")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .maybeSingle(),
    supabase
      .from("mood_daily_logs")
      .select("mood")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .maybeSingle(),
  ]);

  const habits = habitsRes.data ?? [];
  const checks = checksRes.data ?? [];
  const goalMl = profileRes.data?.daily_water_goal_ml ?? 2500;
  const stepsGoal = profileRes.data?.daily_steps_goal ?? 8000;
  const activityHoursGoal = Number(
    profileRes.data?.daily_activity_hours_goal ?? 12,
  );
  const waterMl = (waterRes.data ?? []).reduce((acc, l) => acc + l.amount_ml, 0);
  const mealsLogged = (mealsRes.data ?? []).length;
  const snacksDone = (snacksRes.data ?? []).length;
  const intakeKinds = applicableIntakeKinds(localDate);
  const intakeTotal = intakeKinds.length;
  const intakeLogged = (intakeRes.data ?? []).filter((r) =>
    intakeKinds.includes(r.kind),
  ).length;
  const steps = activityRes.data?.steps ?? 0;
  const activityHours =
    activityRes.data?.activity_hours != null
      ? Number(activityRes.data.activity_hours)
      : 0;

  const checkByHabit = new Map<string, { status: HabitStatus; note: string | null }>();
  for (const c of checks) {
    checkByHabit.set(c.habit_id, { status: c.status, note: c.note });
  }

  const mediaDayLog = mediaLogRes.data
    ? {
        mediaItemId: mediaLogRes.data.media_item_id,
        position: mediaLogRes.data.position,
        didConsume: mediaLogRes.data.did_consume,
      }
    : null;
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
  const moodCtx = { localDate, mood: moodKey };

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
    if (habit.kind === "snack") {
      return {
        ...habit,
        status: isFuture ? null : snackStatusFor(snacksDone),
        note: null,
        snacksDone,
      };
    }
    if (habit.kind === "intake") {
      return {
        ...habit,
        status: isFuture ? null : intakeStatusFor(intakeLogged, intakeTotal),
        note: null,
        intakeLogged,
        intakeTotal,
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
        status: isFuture ? null : mediaStatusFor(mediaDayLog, isFuture),
        note: null,
      };
    }
    if (habit.kind === "mobile_games") {
      return {
        ...habit,
        status: isFuture
          ? null
          : mobileGamesStatusFor(mobileGamesCtx, isFuture),
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
  ] = await Promise.all([
    supabase
      .from("habits")
      .select(
        "id, key, label, kind, icon, accent, sort_order, category_id, enabled",
      )
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
      .select("local_date")
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
  ]);

  const habits = (habitsRes.data ?? []).map(rowToHabit);
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

  // date -> count of meal entries
  const mealsByDate = new Map<string, number>();
  for (const m of mealsRes.data ?? []) {
    mealsByDate.set(m.local_date, (mealsByDate.get(m.local_date) ?? 0) + 1);
  }

  const stepsByDate = new Map<string, number>();
  const activityHoursByDate = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    if (a.steps != null) stepsByDate.set(a.local_date, a.steps);
    if (a.activity_hours != null) {
      activityHoursByDate.set(a.local_date, Number(a.activity_hours));
    }
  }

  const snacksByDate = new Map<string, number>();
  for (const s of snacksRes.data ?? []) {
    snacksByDate.set(s.local_date, (snacksByDate.get(s.local_date) ?? 0) + 1);
  }

  const intakeByDate = new Map<string, Set<string>>();
  for (const i of intakeRes.data ?? []) {
    const set = intakeByDate.get(i.local_date) ?? new Set<string>();
    set.add(i.kind);
    intakeByDate.set(i.local_date, set);
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

  const moodByDate = new Map<string, MoodKey>();
  for (const r of moodRes.data ?? []) {
    if (isMoodKey(r.mood)) moodByDate.set(r.local_date, r.mood);
  }

  const mediaLogByDate = new Map<string, MediaDayLog>();
  for (const r of mediaLogRes.data ?? []) {
    mediaLogByDate.set(r.local_date, {
      mediaItemId: r.media_item_id,
      position: r.position,
      didConsume: r.did_consume,
    });
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
        } else if (h.kind === "snack") {
          status = snackStatusFor(snacksByDate.get(date) ?? 0);
        } else if (h.kind === "intake") {
          const kinds = applicableIntakeKinds(date);
          const applicableLogged = kinds.filter((k) =>
            intakeByDate.get(date)?.has(k),
          ).length;
          status = intakeStatusFor(applicableLogged, kinds.length);
        } else if (h.kind === "steps") {
          status = numericGoalStatus(stepsByDate.get(date) ?? 0, stepsGoal);
        } else if (h.kind === "activity_hours") {
          status = numericGoalStatus(
            activityHoursByDate.get(date) ?? 0,
            activityHoursGoal,
          );
        } else if (h.kind === "mobile_games") {
          const games = mobileGamesByDate.get(date);
          status = games
            ? mobileGamesStatusFor({ localDate: date, ...games }, false)
            : null;
        } else if (h.kind === "mood") {
          status = moodStatusFor(
            { localDate: date, mood: moodByDate.get(date) ?? null },
            false,
          );
        } else if (h.kind === "media") {
          status = mediaStatusFor(mediaLogByDate.get(date) ?? null, false);
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

// ============================================================================
// Week habit aggregation (progress view)
// ============================================================================

/** Habit keys shown in the week "Hur det går" progress board. */
export const WEEK_PROGRESS_HABIT_KEYS = [
  "meals",
  "intake",
  "steps",
  "activity_hours",
  "smoke_free",
  "sugar_free",
  "mobile_games",
  "mood",
] as const;

export interface WeekHabitDay {
  date: string;
  isFuture: boolean;
  isToday: boolean;
  weekday: number;
  statuses: Record<string, HabitStatus | null>;
  /** Selected mood for the day, when logged. */
  mood: MoodKey | null;
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
  ] = await Promise.all([
    supabase
      .from("habits")
      .select(
        "id, key, label, kind, icon, accent, sort_order, category_id, enabled",
      )
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
      .select("local_date")
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
      .select("local_date, mood")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("media_daily_logs")
      .select("local_date, media_item_id, position, did_consume")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
  ]);

  const allHabits = (habitsRes.data ?? []).map(rowToHabit);
  const habits = filterWeekProgressHabits(allHabits);
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

  const mealsByDate = new Map<string, number>();
  for (const m of mealsRes.data ?? []) {
    mealsByDate.set(m.local_date, (mealsByDate.get(m.local_date) ?? 0) + 1);
  }

  const stepsByDate = new Map<string, number>();
  const activityHoursByDate = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    if (a.steps != null) stepsByDate.set(a.local_date, a.steps);
    if (a.activity_hours != null) {
      activityHoursByDate.set(a.local_date, Number(a.activity_hours));
    }
  }

  const snacksByDate = new Map<string, number>();
  for (const s of snacksRes.data ?? []) {
    snacksByDate.set(s.local_date, (snacksByDate.get(s.local_date) ?? 0) + 1);
  }

  const intakeByDate = new Map<string, Set<string>>();
  for (const i of intakeRes.data ?? []) {
    const set = intakeByDate.get(i.local_date) ?? new Set<string>();
    set.add(i.kind);
    intakeByDate.set(i.local_date, set);
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

  const moodByDate = new Map<string, MoodKey>();
  for (const r of moodRes.data ?? []) {
    if (isMoodKey(r.mood)) moodByDate.set(r.local_date, r.mood);
  }

  const mediaLogByDate = new Map<string, MediaDayLog>();
  for (const r of mediaLogRes.data ?? []) {
    mediaLogByDate.set(r.local_date, {
      mediaItemId: r.media_item_id,
      position: r.position,
      didConsume: r.did_consume,
    });
  }

  const today = todayLocalISO();
  const days: WeekHabitDay[] = [];
  const yesByHabit: Record<string, number> = Object.fromEntries(
    habits.map((h) => [h.id, 0]),
  );

  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(weekStart, i);
    const isFuture = date > today;
    const statuses: Record<string, HabitStatus | null> = {};

    for (const h of habits) {
      let status: HabitStatus | null = null;
      if (!isFuture) {
        if (h.kind === "water") {
          status = waterStatusFor(waterByDate.get(date) ?? 0, goalMl);
        } else if (h.kind === "meal") {
          status = mealStatusFor(mealsByDate.get(date) ?? 0);
        } else if (h.kind === "snack") {
          status = snackStatusFor(snacksByDate.get(date) ?? 0);
        } else if (h.kind === "intake") {
          const kinds = applicableIntakeKinds(date);
          const applicableLogged = kinds.filter((k) =>
            intakeByDate.get(date)?.has(k),
          ).length;
          status = intakeStatusFor(applicableLogged, kinds.length);
        } else if (h.kind === "steps") {
          status = numericGoalStatus(stepsByDate.get(date) ?? 0, stepsGoal);
        } else if (h.kind === "activity_hours") {
          status = numericGoalStatus(
            activityHoursByDate.get(date) ?? 0,
            activityHoursGoal,
          );
        } else if (h.kind === "mobile_games") {
          const games = mobileGamesByDate.get(date);
          status = games
            ? mobileGamesStatusFor({ localDate: date, ...games }, false)
            : null;
        } else if (h.kind === "mood") {
          status = moodStatusFor(
            { localDate: date, mood: moodByDate.get(date) ?? null },
            false,
          );
        } else if (h.kind === "media") {
          status = mediaStatusFor(mediaLogByDate.get(date) ?? null, false);
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
      weekday: isoWeekdayFromLocalISO(date),
      statuses,
      mood: isFuture ? null : (moodByDate.get(date) ?? null),
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
