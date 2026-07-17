import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  yearFromLocalISO,
  type DailyLiveEventsContext,
  type LiveEvent,
  type LiveEventKind,
  type MonthLiveEventsContext,
  type YearLiveEventsContext,
} from "@/lib/live-events";

interface Row {
  id: string;
  year: number;
  kind: string;
  title: string;
  event_date: string;
  location: string | null;
  note: string | null;
  rating: number | null;
  attended_at: string | null;
  sort_order: number;
}

function rowToEvent(r: Row): LiveEvent {
  return {
    id: r.id,
    year: r.year,
    kind: r.kind as LiveEventKind,
    title: r.title,
    eventDate: r.event_date,
    location: r.location,
    note: r.note,
    rating: r.rating,
    attendedAt: r.attended_at,
    sortOrder: r.sort_order,
  };
}

function monthEndFromStart(monthStart: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  const lastDay = new Date(y, m, 0).getDate();
  return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
}

export async function getYearLiveEvents(
  userId: string,
  year: number,
): Promise<YearLiveEventsContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_events")
    .select(
      "id, year, kind, title, event_date, location, note, rating, attended_at, sort_order",
    )
    .eq("user_id", userId)
    .eq("year", year)
    .is("archived_at", null)
    .order("event_date", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    year,
    events: (data ?? []).map(rowToEvent),
  };
}

export async function getDailyLiveEvents(
  userId: string,
  localDate: string,
): Promise<DailyLiveEventsContext> {
  const year = yearFromLocalISO(localDate);
  const { events } = await getYearLiveEvents(userId, year);
  const dueEvents = events.filter((e) => e.eventDate === localDate);

  return { localDate, year, dueEvents };
}

export async function getMonthLiveEvents(
  userId: string,
  monthStart: string,
): Promise<MonthLiveEventsContext> {
  const monthEnd = monthEndFromStart(monthStart);
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_events")
    .select(
      "id, year, kind, title, event_date, location, note, rating, attended_at, sort_order",
    )
    .eq("user_id", userId)
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .is("archived_at", null)
    .order("event_date", { ascending: true });

  return {
    monthStart,
    events: (data ?? []).map(rowToEvent),
  };
}

/** Event dates (YYYY-MM-DD) when user attended at least one live event. */
export async function getLiveAttendanceDates(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_events")
    .select("event_date")
    .eq("user_id", userId)
    .not("attended_at", "is", null)
    .gte("event_date", startISO)
    .lte("event_date", endISO);

  const dates = new Set<string>();
  for (const row of data ?? []) {
    dates.add(row.event_date);
  }
  return dates;
}
