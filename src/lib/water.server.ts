import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayLocalISO } from "@/lib/date";
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
