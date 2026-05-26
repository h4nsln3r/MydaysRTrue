import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayLocalISO } from "@/lib/date";
import type { WaterSummary } from "@/lib/water";

export async function getDailySummary(
  userId: string,
  localDate: string = todayLocalISO(),
): Promise<WaterSummary> {
  const supabase = await createClient();

  const [{ data: profile }, { data: logs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_water_goal_ml")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("water_logs")
      .select("id, amount_ml, logged_at, note")
      .eq("user_id", userId)
      .eq("local_date", localDate)
      .order("logged_at", { ascending: false }),
  ]);

  const goalMl = profile?.daily_water_goal_ml ?? 2500;
  const totalMl = (logs ?? []).reduce((acc, l) => acc + l.amount_ml, 0);
  const progress = goalMl > 0 ? totalMl / goalMl : 0;

  return {
    date: localDate,
    goalMl,
    totalMl,
    progress,
    goalMet: totalMl >= goalMl,
    logs: logs ?? [],
  };
}

export interface WeekDay {
  date: string;
  goalMl: number;
  totalMl: number;
  progress: number;
  goalMet: boolean;
  isFuture: boolean;
  isToday: boolean;
}

export interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  goalMl: number;
  totalMl: number;
  daysHit: number;
  days: WeekDay[];
}

/**
 * Aggregates the 7 days starting at `weekStart` (must be a Monday YYYY-MM-DD).
 * Future days are flagged so the UI can grey them out instead of pretending
 * the user simply hasn't drunk anything yet.
 */
export async function getWeeklySummary(
  userId: string,
  weekStart: string,
): Promise<WeekSummary> {
  const supabase = await createClient();
  const weekEnd = addDaysISO(weekStart, 6);

  const [{ data: profile }, { data: logs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_water_goal_ml")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("water_logs")
      .select("amount_ml, local_date")
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
  ]);

  const goalMl = profile?.daily_water_goal_ml ?? 2500;
  const today = todayLocalISO();

  const byDate = new Map<string, number>();
  for (const row of logs ?? []) {
    byDate.set(row.local_date, (byDate.get(row.local_date) ?? 0) + row.amount_ml);
  }

  const days: WeekDay[] = [];
  let totalMl = 0;
  let daysHit = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(weekStart, i);
    const dayTotal = byDate.get(date) ?? 0;
    const isFuture = date > today;
    const goalMet = !isFuture && goalMl > 0 && dayTotal >= goalMl;
    if (goalMet) daysHit += 1;
    totalMl += dayTotal;
    days.push({
      date,
      goalMl,
      totalMl: dayTotal,
      progress: goalMl > 0 ? dayTotal / goalMl : 0,
      goalMet,
      isFuture,
      isToday: date === today,
    });
  }

  return { weekStart, weekEnd, goalMl, totalMl, daysHit, days };
}
