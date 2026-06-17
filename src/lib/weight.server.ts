import "server-only";
import { addDaysISO, isoWeekdayFromLocalISO, parseLocalISO, weekStartISO } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/tasks";
import {
  isWeightTimeOfDay,
  type WeightDayContext,
  type WeightLog,
  type WeightTimeOfDay,
  type WeightWeekPlan,
} from "@/lib/weight";

interface PlanRow {
  week_start: string;
  enabled: boolean;
  weekday: number | null;
  day_sort_order: number;
}

interface LogRow {
  local_date: string;
  time_of_day: string;
  weight_kg: number;
  logged_at: string;
}

function rowToLog(r: LogRow): WeightLog {
  return {
    localDate: r.local_date,
    timeOfDay: r.time_of_day as WeightTimeOfDay,
    weightKg: Number(r.weight_kg),
    loggedAt: r.logged_at,
  };
}

function localDateForWeekday(weekStart: string, weekday: Weekday): string {
  return addDaysISO(weekStart, weekday - 1);
}

async function fetchLog(
  userId: string,
  localDate: string,
): Promise<WeightLog | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weight_logs")
    .select("local_date, time_of_day, weight_kg, logged_at")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();

  if (!data || !isWeightTimeOfDay(data.time_of_day)) return null;
  return rowToLog(data);
}

export async function getWeightDefaultWeekday(
  userId: string,
): Promise<Weekday | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("default_weight_weekday")
    .eq("id", userId)
    .maybeSingle();
  const n = data?.default_weight_weekday;
  return n != null && n >= 1 && n <= 7 ? (n as Weekday) : null;
}

async function ensurePlanRow(
  userId: string,
  weekStart: string,
): Promise<PlanRow> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("weight_week_plans")
    .select("week_start, enabled, weekday, day_sort_order")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing) return existing;

  const defaultWeekday = await getWeightDefaultWeekday(userId);

  const { data: inserted, error } = await supabase
    .from("weight_week_plans")
    .insert({
      user_id: userId,
      week_start: weekStart,
      enabled: true,
      weekday: defaultWeekday,
    })
    .select("week_start, enabled, weekday, day_sort_order")
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Could not create weight week plan.");
  }

  return inserted;
}

/** Returns the weight plan for a week, creating a default row if missing. */
export async function getWeightWeekPlan(
  userId: string,
  weekStart: string,
): Promise<WeightWeekPlan> {
  const plan = await ensurePlanRow(userId, weekStart);

  let log: WeightLog | null = null;
  if (plan.enabled && plan.weekday != null) {
    const localDate = localDateForWeekday(weekStart, plan.weekday as Weekday);
    log = await fetchLog(userId, localDate);
  }

  const defaultWeekday = await getWeightDefaultWeekday(userId);

  return {
    weekStart,
    enabled: plan.enabled,
    weekday: plan.weekday as Weekday | null,
    daySortOrder: plan.day_sort_order ?? 0,
    defaultWeekday,
    log,
  };
}

/** Weight check scheduled on `localDate`, if any. */
export async function getWeightForDate(
  userId: string,
  localDate: string,
): Promise<WeightDayContext> {
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  const plan = await getWeightWeekPlan(userId, weekStart);

  const scheduled =
    plan.enabled && plan.weekday != null && plan.weekday === weekday;

  const log = scheduled ? await fetchLog(userId, localDate) : null;

  return {
    localDate,
    weekStart,
    weekday,
    scheduled,
    log,
  };
}

/** Weight logs for each day in an ISO week (for progress view). */
export async function getWeightLogsForWeek(
  userId: string,
  weekStart: string,
): Promise<Map<string, WeightLog>> {
  const supabase = await createClient();
  const weekEnd = addDaysISO(weekStart, 6);

  const { data } = await supabase
    .from("weight_logs")
    .select("local_date, time_of_day, weight_kg, logged_at")
    .eq("user_id", userId)
    .gte("local_date", weekStart)
    .lte("local_date", weekEnd);

  const byDate = new Map<string, WeightLog>();
  for (const row of data ?? []) {
    if (!isWeightTimeOfDay(row.time_of_day)) continue;
    byDate.set(row.local_date, rowToLog(row));
  }
  return byDate;
}
