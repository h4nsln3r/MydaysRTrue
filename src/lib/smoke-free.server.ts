import "server-only";
import { addDaysISO } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { HabitStatus } from "@/lib/habits";
import {
  consecutiveYesEndingOn,
  type DailySmokeFreeContext,
  type SmokeFreeStreakBefore,
} from "@/lib/smoke-free";

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

/** Consecutive Ja-days ending the day before `localDate`, per substance. */
export async function getSmokeFreeStreakBefore(
  userId: string,
  localDate: string,
): Promise<SmokeFreeStreakBefore> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("smoke_free_daily_logs")
    .select("local_date, nicotine_status, cannabis_status")
    .eq("user_id", userId)
    .lt("local_date", localDate)
    .order("local_date", { ascending: false })
    .limit(4000);

  const nicotine = new Map<string, HabitStatus | null>();
  const cannabis = new Map<string, HabitStatus | null>();
  for (const row of data ?? []) {
    const date = row.local_date.slice(0, 10);
    nicotine.set(date, parseStatus(row.nicotine_status));
    cannabis.set(date, parseStatus(row.cannabis_status));
  }

  const end = addDaysISO(localDate, -1);
  return {
    nicotine: consecutiveYesEndingOn(nicotine, end),
    cannabis: consecutiveYesEndingOn(cannabis, end),
  };
}
