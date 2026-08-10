import "server-only";
import { addDaysISO } from "@/lib/date";
import { getCodingProjects } from "@/lib/coding.server";
import { createClient } from "@/lib/supabase/server";
import {
  buildCodingCompletions,
  buildGigCompletions,
  buildMediaCompletions,
  completionsInDateRange,
  type DayCompletion,
} from "@/lib/completions";
import {
  isMediaCompleted,
  type MediaItem,
  type MediaKind,
} from "@/lib/media";
import type { Gig, MusicBand } from "@/lib/gigs";
import { MUSIC_BANDS } from "@/lib/tasks";

function isMusicBand(value: string): value is MusicBand {
  return (MUSIC_BANDS as readonly string[]).includes(value);
}

/** Completions that landed in this ISO week (Mon–Sun). */
export async function getWeekCompletions(
  userId: string,
  weekStart: string,
): Promise<DayCompletion[]> {
  const weekEnd = addDaysISO(weekStart, 6);
  const supabase = await createClient();

  const [{ data: mediaRows }, { data: gigRows }, projects] = await Promise.all([
    supabase
      .from("media_items")
      .select(
        "id, year, kind, title, author, director, actors, note, rating, total_length, sort_order, completed_on",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .not("completed_on", "is", null)
      .gte("completed_on", weekStart)
      .lte("completed_on", weekEnd),
    supabase
      .from("gigs")
      .select(
        "id, year, band, title, event_date, venue, note, rating, played_at, sort_order",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .not("played_at", "is", null)
      .gte("event_date", weekStart)
      .lte("event_date", weekEnd),
    getCodingProjects(userId),
  ]);

  const mediaItems: MediaItem[] = (mediaRows ?? []).map((r) => {
    const item: MediaItem = {
      id: r.id,
      year: r.year,
      kind: r.kind as MediaKind,
      title: r.title,
      author: r.author,
      director: r.director,
      actors: r.actors,
      note: r.note,
      rating: r.rating,
      totalLength: r.total_length,
      sortOrder: r.sort_order,
      bestPosition: 0,
      completed: true,
      lastActivityDate: r.completed_on,
      completedOn: r.completed_on,
    };
    // Treat as completed when we have completed_on (progress already hit finish).
    if (!isMediaCompleted({ ...item, bestPosition: item.totalLength ?? 1 })) {
      item.completed = true;
    }
    return item;
  });

  const gigs: Gig[] = (gigRows ?? []).map((r) => ({
    id: r.id,
    year: r.year,
    band: isMusicBand(r.band) ? r.band : "Totes",
    title: r.title,
    eventDate: r.event_date,
    venue: r.venue,
    note: r.note,
    rating: r.rating,
    playedAt: r.played_at,
    sortOrder: r.sort_order,
  }));

  const all: DayCompletion[] = [
    ...buildMediaCompletions(mediaItems),
    ...buildGigCompletions(gigs),
    ...completionsInDateRange(buildCodingCompletions(projects), weekStart, weekEnd),
  ].sort((a, b) =>
    a.date === b.date
      ? a.title.localeCompare(b.title, "sv")
      : a.date.localeCompare(b.date),
  );

  return all;
}
