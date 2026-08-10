"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  completionJournalBody,
  type CompletionDomain,
} from "@/lib/completions";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** True when a journal note was inserted for the comment. */
  journalAdded?: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX = 280;
const JOURNAL_MAX = 2000;

function parseDate(
  value: string,
): { ok: true; date: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) {
    return { ok: false, error: "Ange ett giltigt datum." };
  }
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return { ok: false, error: "Ange ett giltigt datum." };
  }
  if (y < 1970 || y > 2100) {
    return { ok: false, error: "Datumet känns orimligt." };
  }
  return { ok: true, date: trimmed };
}

function parseNote(
  value: string | null | undefined,
): { ok: true; note: string | null } | { ok: false; error: string } {
  const trimmed = (value ?? "").trim();
  if (trimmed.length > NOTE_MAX) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }
  return { ok: true, note: trimmed || null };
}

/** Update completion date + comment; new/changed comments go into the journal. */
export async function updateDayCompletionAction(input: {
  domain: CompletionDomain;
  entityId: string;
  date: string;
  note?: string | null;
  title: string;
  subtitle: string;
}): Promise<ActionResult> {
  if (!input.entityId) return { ok: false, error: "Saknar id." };
  if (
    input.domain !== "media" &&
    input.domain !== "gig" &&
    input.domain !== "coding"
  ) {
    return { ok: false, error: "Ogiltig typ." };
  }

  const dateResult = parseDate(input.date);
  if (!dateResult.ok) return dateResult;

  const noteResult = parseNote(input.note);
  if (!noteResult.ok) return noteResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  let previousNote: string | null = null;
  let updateError: string | null = null;

  if (input.domain === "media") {
    const { data: existing } = await supabase
      .from("media_items")
      .select("id, note")
      .eq("id", input.entityId)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Hittade inte titeln." };
    previousNote = existing.note;

    const { error } = await supabase
      .from("media_items")
      .update({
        completed_on: dateResult.date,
        note: noteResult.note,
      })
      .eq("id", input.entityId)
      .eq("user_id", user.id);
    if (error) updateError = error.message;
  } else if (input.domain === "gig") {
    const { data: existing } = await supabase
      .from("gigs")
      .select("id, note, year")
      .eq("id", input.entityId)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Hittade inte spelningen." };
    previousNote = existing.note;

    const year = Number(dateResult.date.slice(0, 4));
    const { error } = await supabase
      .from("gigs")
      .update({
        event_date: dateResult.date,
        year,
        note: noteResult.note,
      })
      .eq("id", input.entityId)
      .eq("user_id", user.id);
    if (error) updateError = error.message;
  } else {
    const { data: existing } = await supabase
      .from("coding_project_versions")
      .select("id, note")
      .eq("id", input.entityId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Hittade inte versionen." };
    previousNote = existing.note ?? null;

    const { error } = await supabase
      .from("coding_project_versions")
      .update({
        completed_on: dateResult.date,
        note: noteResult.note,
      })
      .eq("id", input.entityId)
      .eq("user_id", user.id);
    if (error) updateError = error.message;
  }

  if (updateError) return { ok: false, error: updateError };

  const prev = (previousNote ?? "").trim();
  const next = (noteResult.note ?? "").trim();
  let journalAdded = false;

  if (next && next !== prev) {
    const body = completionJournalBody({
      title: input.title.trim() || "Klart",
      subtitle: input.subtitle.trim() || "Anteckning",
      note: next,
    }).slice(0, JOURNAL_MAX);

    const { error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        user_id: user.id,
        local_date: dateResult.date,
        body,
      });
    if (journalError) {
      return {
        ok: false,
        error: `Sparades, men dagboken: ${journalError.message}`,
      };
    }
    journalAdded = true;
  }

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  revalidatePath("/week", "page");
  revalidatePath("/month", "page");
  return { ok: true, journalAdded };
}
