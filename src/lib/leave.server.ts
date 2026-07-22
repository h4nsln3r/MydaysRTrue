import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isDateOnLeave,
  leaveForDate,
  type LeaveKind,
  type LeavePeriod,
  type YearLeaveContext,
} from "@/lib/leave";

interface Row {
  id: string;
  kind: string;
  start_date: string;
  end_date: string;
  note: string | null;
}

function rowToPeriod(r: Row): LeavePeriod {
  return {
    id: r.id,
    kind: r.kind as LeaveKind,
    startDate: r.start_date,
    endDate: r.end_date,
    note: r.note,
  };
}

/** Periods that overlap the given calendar year. */
export async function getYearLeave(
  userId: string,
  year: number,
): Promise<YearLeaveContext> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_periods")
    .select("id, kind, start_date, end_date, note")
    .eq("user_id", userId)
    .is("archived_at", null)
    .lte("start_date", yearEnd)
    .gte("end_date", yearStart)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    year,
    periods: (data ?? []).map(rowToPeriod),
  };
}

/** Periods overlapping [startISO, endISO] inclusive. */
export async function getLeavePeriodsInRange(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<LeavePeriod[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_periods")
    .select("id, kind, start_date, end_date, note")
    .eq("user_id", userId)
    .is("archived_at", null)
    .lte("start_date", endISO)
    .gte("end_date", startISO)
    .order("start_date", { ascending: true });

  return (data ?? []).map(rowToPeriod);
}

export async function getLeaveForDate(
  userId: string,
  localDate: string,
): Promise<LeavePeriod | null> {
  const periods = await getLeavePeriodsInRange(userId, localDate, localDate);
  return leaveForDate(localDate, periods);
}

export async function isUserOnLeave(
  userId: string,
  localDate: string,
): Promise<boolean> {
  const periods = await getLeavePeriodsInRange(userId, localDate, localDate);
  return isDateOnLeave(localDate, periods);
}
