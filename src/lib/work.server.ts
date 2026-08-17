import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/date";
import { emptyWorkLog, isWorkKind, type WorkDailyLog } from "@/lib/work";

interface WorkRow {
  local_date: string;
  started_at: string | null;
  start_note: string | null;
  ended_at: string | null;
  end_note: string | null;
  work_kind: string | null;
}

const WORK_COLUMNS =
  "local_date, started_at, start_note, ended_at, end_note, work_kind";

function rowToWork(r: WorkRow): WorkDailyLog {
  return {
    localDate: r.local_date,
    startedAt: r.started_at,
    startNote: r.start_note,
    endedAt: r.ended_at,
    endNote: r.end_note,
    kind: isWorkKind(r.work_kind) ? r.work_kind : null,
  };
}

export async function getWorkDailyLog(
  userId: string,
  localDate: string,
): Promise<WorkDailyLog> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_daily_logs")
    .select(WORK_COLUMNS)
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();
  return data ? rowToWork(data) : emptyWorkLog(localDate);
}

export async function getWorkLogsForWeek(
  userId: string,
  weekStart: string,
): Promise<Map<string, WorkDailyLog>> {
  return getWorkLogsInRange(userId, weekStart, addDaysISO(weekStart, 6));
}

export async function getWorkLogsInRange(
  userId: string,
  start: string,
  end: string,
): Promise<Map<string, WorkDailyLog>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_daily_logs")
    .select(WORK_COLUMNS)
    .eq("user_id", userId)
    .gte("local_date", start)
    .lte("local_date", end);

  const map = new Map<string, WorkDailyLog>();
  for (const row of data ?? []) {
    map.set(row.local_date, rowToWork(row));
  }
  return map;
}
