import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HabitStatus } from "@/lib/habits";
import type { DailySmokeFreeContext } from "@/lib/smoke-free";

function parseStatus(value: string | null): HabitStatus | null {
  if (value === "yes" || value === "half" || value === "no") return value;
  return null;
}

export async function getDailySmokeFree(
  userId: string,
  localDate: string,
): Promise<DailySmokeFreeContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("smoke_free_daily_logs")
    .select("nicotine_status, cannabis_status")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();

  const nicotine = parseStatus(data?.nicotine_status ?? null);
  const cannabis = parseStatus(data?.cannabis_status ?? null);

  return {
    localDate,
    nicotine,
    cannabis,
    hasLog: Boolean(data) && (nicotine !== null || cannabis !== null),
  };
}
