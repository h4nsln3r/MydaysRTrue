"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  GIG_RATING_MAX,
  GIG_RATING_MIN,
  MUSIC_BANDS,
  yearFromLocalISO,
  type MusicBand,
} from "@/lib/gigs";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX = 280;

function parseBand(
  value: string,
): { ok: true; band: MusicBand } | { ok: false; error: string } {
  if (!MUSIC_BANDS.includes(value as MusicBand)) {
    return { ok: false, error: "Välj band." };
  }
  return { ok: true, band: value as MusicBand };
}

function parseRating(
  value: number | null | undefined,
): { ok: true; rating: number | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, rating: null };
  if (
    !Number.isInteger(value) ||
    value < GIG_RATING_MIN ||
    value > GIG_RATING_MAX
  ) {
    return { ok: false, error: "Betyget måste vara 1–10." };
  }
  return { ok: true, rating: value };
}

export async function createGigAction(input: {
  year: number;
  band: string;
  title: string;
  eventDate: string;
  venue?: string;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv en titel." };
  if (!ISO_DATE_RE.test(input.eventDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (!Number.isInteger(input.year) || input.year < 1970 || input.year > 2100) {
    return { ok: false, error: "Ogiltigt år." };
  }
  if (yearFromLocalISO(input.eventDate) !== input.year) {
    return { ok: false, error: "Datumet måste ligga i samma år." };
  }

  const bandResult = parseBand(input.band);
  if (!bandResult.ok) return bandResult;

  const venue = input.venue?.trim().slice(0, 120) || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: last } = await supabase
    .from("gigs")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("year", input.year)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("gigs").insert({
    user_id: user.id,
    year: input.year,
    band: bandResult.band,
    title,
    event_date: input.eventDate,
    venue,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
  return { ok: true };
}

export async function updateGigAction(input: {
  id: string;
  band: string;
  title: string;
  eventDate: string;
  venue?: string;
  note?: string;
  rating?: number | null;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar id." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv en titel." };
  if (!ISO_DATE_RE.test(input.eventDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const bandResult = parseBand(input.band);
  if (!bandResult.ok) return bandResult;

  const note = (input.note ?? "").trim();
  if (note.length > NOTE_MAX) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }

  const ratingResult = parseRating(input.rating);
  if (!ratingResult.ok) return ratingResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const year = yearFromLocalISO(input.eventDate);
  const { error } = await supabase
    .from("gigs")
    .update({
      title,
      band: bandResult.band,
      event_date: input.eventDate,
      year,
      venue: input.venue?.trim().slice(0, 120) || null,
      note: note || null,
      rating: ratingResult.rating,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
  return { ok: true };
}

export async function markGigPlayedAction(input: {
  id: string;
  note?: string;
  rating?: number | null;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar id." };

  const note = (input.note ?? "").trim();
  if (note.length > NOTE_MAX) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }

  const ratingResult = parseRating(input.rating);
  if (!ratingResult.ok) return ratingResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("gigs")
    .update({
      played_at: new Date().toISOString(),
      note: note || null,
      rating: ratingResult.rating,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .is("played_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
  return { ok: true };
}

export async function resetGigPlayedAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("gigs")
    .update({ played_at: null, note: null, rating: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
  return { ok: true };
}

export async function archiveGigAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("gigs")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
  return { ok: true };
}
