"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MEDIA_RATING_MAX,
  MEDIA_RATING_MIN,
  isMediaCompleted,
  yearFromLocalISO,
  type MediaKind,
} from "@/lib/media";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SaveMediaDailyLogResult extends ActionResult {
  justCompleted?: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MEDIA_NOTE_MAX = 280;

function parseMediaNote(
  value: string | undefined,
): { ok: true; note: string | null } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length > MEDIA_NOTE_MAX) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }
  return { ok: true, note: trimmed || null };
}

function parseMediaRating(
  value: number | null | undefined,
): { ok: true; rating: number | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, rating: null };
  if (
    !Number.isInteger(value) ||
    value < MEDIA_RATING_MIN ||
    value > MEDIA_RATING_MAX
  ) {
    return { ok: false, error: "Betyget måste vara 1–10." };
  }
  return { ok: true, rating: value };
}

export async function createMediaItemAction(input: {
  year: number;
  kind: MediaKind;
  title: string;
  totalLength?: number | null;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv en titel." };
  if (!Number.isInteger(input.year) || input.year < 1970 || input.year > 2100) {
    return { ok: false, error: "Ogiltigt år." };
  }

  if (input.kind === "book" || input.kind === "series") {
    const len = input.totalLength;
    if (len == null || !Number.isInteger(len) || len < 1 || len > 50_000) {
      return {
        ok: false,
        error:
          input.kind === "book"
            ? "Ange antal sidor."
            : "Ange antal avsnitt.",
      };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: last } = await supabase
    .from("media_items")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("year", input.year)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("media_items").insert({
    user_id: user.id,
    year: input.year,
    kind: input.kind,
    title,
    note: null,
    rating: null,
    total_length:
      input.kind === "movie" ? null : (input.totalLength ?? null),
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function updateMediaItemAction(input: {
  id: string;
  title: string;
  note?: string;
  rating?: number | null;
  totalLength?: number | null;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar id." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv en titel." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("media_items")
    .select("id, kind, total_length")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Hittade inte titeln." };

  const noteResult = parseMediaNote(input.note);
  if (!noteResult.ok) return noteResult;

  const ratingResult = parseMediaRating(input.rating);
  if (!ratingResult.ok) return ratingResult;

  let totalLength: number | null = null;
  if (existing.kind === "book" || existing.kind === "series") {
    const len = input.totalLength;
    if (len == null || !Number.isInteger(len) || len < 1 || len > 50_000) {
      return {
        ok: false,
        error:
          existing.kind === "book"
            ? "Ange antal sidor."
            : "Ange antal avsnitt.",
      };
    }
    totalLength = len;

    const { data: maxLog } = await supabase
      .from("media_daily_logs")
      .select("position")
      .eq("user_id", user.id)
      .eq("media_item_id", input.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxLog && maxLog.position > totalLength) {
      return {
        ok: false,
        error:
          existing.kind === "book"
            ? "Antal sidor kan inte vara lägre än din högsta loggade sida."
            : "Antal avsnitt kan inte vara lägre än ditt högsta loggade avsnitt.",
      };
    }
  }

  const { error } = await supabase
    .from("media_items")
    .update({
      title,
      note: noteResult.note,
      rating: ratingResult.rating,
      total_length: totalLength,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function updateMediaItemReviewAction(input: {
  id: string;
  note?: string;
  rating?: number | null;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar id." };

  const noteResult = parseMediaNote(input.note);
  if (!noteResult.ok) return noteResult;

  const ratingResult = parseMediaRating(input.rating);
  if (!ratingResult.ok) return ratingResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("media_items")
    .update({
      note: noteResult.note,
      rating: ratingResult.rating,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function updateMediaItemRatingAction(input: {
  id: string;
  rating: number | null;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar id." };

  const ratingResult = parseMediaRating(input.rating);
  if (!ratingResult.ok) return ratingResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("media_items")
    .update({ rating: ratingResult.rating })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function archiveMediaItemAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("media_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function saveMediaDailyLogAction(input: {
  localDate: string;
  mediaItemId: string;
  position: number;
  didConsume: boolean;
}): Promise<SaveMediaDailyLogResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (!input.mediaItemId) {
    return { ok: false, error: "Välj vad du läser eller tittar på." };
  }
  if (
    !Number.isInteger(input.position) ||
    input.position < 0 ||
    input.position > 50_000
  ) {
    return { ok: false, error: "Ogiltig position." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const year = yearFromLocalISO(input.localDate);
  const { data: item } = await supabase
    .from("media_items")
    .select("id, kind, total_length")
    .eq("id", input.mediaItemId)
    .eq("user_id", user.id)
    .eq("year", year)
    .is("archived_at", null)
    .maybeSingle();
  if (!item) {
    return { ok: false, error: "Hittade inte titeln det här året." };
  }

  const { data: prevLogs } = await supabase
    .from("media_daily_logs")
    .select("position")
    .eq("user_id", user.id)
    .eq("media_item_id", input.mediaItemId);

  const prevBestPosition = Math.max(
    0,
    ...(prevLogs ?? []).map((row) => row.position),
  );
  const wasComplete = isMediaCompleted({
    id: item.id,
    year,
    kind: item.kind as MediaKind,
    title: "",
    note: null,
    rating: null,
    totalLength: item.total_length,
    sortOrder: 0,
    bestPosition: prevBestPosition,
    completed: false,
    lastActivityDate: null,
  });

  let position = input.position;
  let didConsume = input.didConsume;

  if (item.kind === "movie") {
    position = didConsume ? 1 : 0;
    didConsume = input.didConsume;
  } else if (
    item.total_length != null &&
    position > item.total_length
  ) {
    return { ok: false, error: "Positionen kan inte överstiga totalen." };
  }

  const { error } = await supabase.from("media_daily_logs").upsert(
    {
      user_id: user.id,
      media_item_id: input.mediaItemId,
      local_date: input.localDate,
      position,
      did_consume: didConsume,
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) return { ok: false, error: error.message };

  const newBestPosition = Math.max(prevBestPosition, position);
  const justCompleted = !wasComplete && isMediaCompleted({
    id: item.id,
    year,
    kind: item.kind as MediaKind,
    title: "",
    note: null,
    rating: null,
    totalLength: item.total_length,
    sortOrder: 0,
    bestPosition: newBestPosition,
    completed: false,
    lastActivityDate: null,
  });

  revalidatePath("/", "layout");
  return { ok: true, justCompleted };
}

export async function clearMediaDailyLogAction(
  localDate: string,
): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("media_daily_logs")
    .delete()
    .eq("user_id", user.id)
    .eq("local_date", localDate);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
  return { ok: true };
}
