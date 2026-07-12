import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  yearFromLocalISO,
  type Gig,
  type MonthGigsContext,
  type MusicBand,
  type YearGigsContext,
} from "@/lib/gigs";

interface Row {
  id: string;
  year: number;
  band: string;
  title: string;
  event_date: string;
  venue: string | null;
  note: string | null;
  rating: number | null;
  played_at: string | null;
  sort_order: number;
}

function rowToGig(r: Row): Gig {
  return {
    id: r.id,
    year: r.year,
    band: r.band as MusicBand,
    title: r.title,
    eventDate: r.event_date,
    venue: r.venue,
    note: r.note,
    rating: r.rating,
    playedAt: r.played_at,
    sortOrder: r.sort_order,
  };
}

function monthEndFromStart(monthStart: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  const lastDay = new Date(y, m, 0).getDate();
  return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
}

export async function getYearGigs(
  userId: string,
  year: number,
): Promise<YearGigsContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gigs")
    .select(
      "id, year, band, title, event_date, venue, note, rating, played_at, sort_order",
    )
    .eq("user_id", userId)
    .eq("year", year)
    .is("archived_at", null)
    .order("event_date", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    year,
    gigs: (data ?? []).map(rowToGig),
  };
}

export async function getMonthGigs(
  userId: string,
  monthStart: string,
): Promise<MonthGigsContext> {
  const monthEnd = monthEndFromStart(monthStart);
  const supabase = await createClient();
  const { data } = await supabase
    .from("gigs")
    .select(
      "id, year, band, title, event_date, venue, note, rating, played_at, sort_order",
    )
    .eq("user_id", userId)
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .is("archived_at", null)
    .order("event_date", { ascending: true });

  return {
    monthStart,
    gigs: (data ?? []).map(rowToGig),
  };
}
