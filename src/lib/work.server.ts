import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/date";
import { emptyWorkLog, type WorkDailyLog } from "@/lib/work";

interface WorkRow {
  local_date: string;
  started_at: string | null;
  start_note: string | null;
  ended_at: string | null;
  end_note: string | null;
}

function rowToWork(r: WorkRow): WorkDailyLog {
  return {
    localDate: r.local_date,
    startedAt: r.started_at,
    startNote: r.start_note,
    endedAt: r.ended_at,
    endNote: r.end_note,
  };
}

export async function getWorkDailyLog(
  userId: string,
  localDate: string,
): Promise<WorkDailyLog> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_daily_logs")
    .select("local_date, started_at, start_note, ended_at, end_note")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();
  return data ? rowToWork(data) : emptyWorkLog(localDate);
}

export async function getWorkLogsForWeek(
  userId: string,
  weekStart: string,
): Promise<Map<string, WorkDailyLog>> {
  const weekEnd = addDaysISO(weekStart, 6);
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_daily_logs")
    .select("local_date, started_at, start_note, ended_at, end_note")
    .eq("user_id", userId)
    .gte("local_date", weekStart)
    .lte("local_date", weekEnd);

  const map = new Map<string, WorkDailyLog>();
  for (const row of data ?? []) {
    map.set(row.local_date, rowToWork(row));
  }
  return map;
}
