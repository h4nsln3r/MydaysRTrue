import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  expandLeaveDates,
  isDateOnLeave,
  leaveForDate,
  toTripDayContext,
  travelPeriodForDate,
  type LeaveKind,
  type LeavePeriod,
  type TripDayContext,
  type YearLeaveContext,
} from "@/lib/leave";

interface Row {
  id: string;
  kind: string;
  start_date: string;
  end_date: string;
  title: string | null;
  note: string | null;
}

interface NoteRow {
  leave_period_id: string;
  local_date: string;
  body: string;
  done_at: string | null;
}

function rowToPeriod(r: Row): LeavePeriod {
  return {
    id: r.id,
    kind: r.kind as LeaveKind,
    startDate: r.start_date,
    endDate: r.end_date,
    title: r.title,
    note: r.note,
  };
}

const PERIOD_COLS = "id, kind, start_date, end_date, title, note";

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
    .select(PERIOD_COLS)
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
    .select(PERIOD_COLS)
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

export async function getLeaveDayContext(
  userId: string,
  localDate: string,
): Promise<{ onLeave: boolean; tripDay: TripDayContext | null }> {
  const periods = await getLeavePeriodsInRange(userId, localDate, localDate);
  const onLeave = isDateOnLeave(localDate, periods);
  const travel = travelPeriodForDate(localDate, periods);
  if (!travel) return { onLeave, tripDay: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_day_notes")
    .select("body, done_at")
    .eq("user_id", userId)
    .eq("leave_period_id", travel.id)
    .eq("local_date", localDate)
    .maybeSingle();

  return {
    onLeave,
    tripDay: toTripDayContext(
      travel,
      localDate,
      data
        ? { body: data.body ?? "", doneAt: data.done_at }
        : null,
    ),
  };
}

/** Travel days in [startISO, endISO] inclusive, keyed by local date. */
export async function getTripDaysInRange(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<Map<string, TripDayContext>> {
  const periods = await getLeavePeriodsInRange(userId, startISO, endISO);
  const travelPeriods = periods.filter((p) => p.kind === "travel");
  const map = new Map<string, TripDayContext>();
  if (travelPeriods.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_day_notes")
    .select("leave_period_id, local_date, body, done_at")
    .eq("user_id", userId)
    .in(
      "leave_period_id",
      travelPeriods.map((p) => p.id),
    )
    .gte("local_date", startISO)
    .lte("local_date", endISO);

  const notes = new Map<string, NoteRow>();
  for (const row of data ?? []) {
    notes.set(`${row.leave_period_id}|${row.local_date}`, row);
  }

  for (const period of travelPeriods) {
    for (const date of expandLeaveDates(period)) {
      if (date < startISO || date > endISO) continue;
      const note = notes.get(`${period.id}|${date}`);
      map.set(
        date,
        toTripDayContext(
          period,
          date,
          note ? { body: note.body, doneAt: note.done_at } : null,
        ),
      );
    }
  }

  return map;
}
