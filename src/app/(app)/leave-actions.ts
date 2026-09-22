"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isLeaveKind, LEAVE_TITLE_MAX, type LeaveKind } from "@/lib/leave";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX = 280;

function trimNote(note?: string): string | null {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > NOTE_MAX) return null;
  return trimmed;
}

function trimTitle(kind: LeaveKind, title?: string): {
  title: string | null;
  error?: string;
} {
  const trimmed = title?.trim() ?? "";
  if (kind !== "travel") return { title: null };
  if (!trimmed) return { title: null, error: "Skriv resans namn, t.ex. Japan." };
  if (trimmed.length > LEAVE_TITLE_MAX) {
    return { title: null, error: `Max ${LEAVE_TITLE_MAX} tecken.` };
  }
  return { title: trimmed };
}

function normalizeRange(startDate: string, endDate: string): {
  startDate: string;
  endDate: string;
} {
  if (endDate < startDate) {
    return { startDate: endDate, endDate: startDate };
  }
  return { startDate, endDate };
}

export async function createLeavePeriodAction(input: {
  kind: LeaveKind;
  startDate: string;
  endDate: string;
  title?: string;
  note?: string;
}): Promise<ActionResult> {
  if (!isLeaveKind(input.kind)) {
    return { ok: false, error: "Ogiltig typ." };
  }
  if (!ISO_DATE_RE.test(input.startDate) || !ISO_DATE_RE.test(input.endDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const { startDate, endDate } = normalizeRange(input.startDate, input.endDate);
  const { title, error: titleError } = trimTitle(input.kind, input.title);
  if (titleError) return { ok: false, error: titleError };
  const note = trimNote(input.note);
  if (input.note?.trim() && !note) {
    return { ok: false, error: `Max ${NOTE_MAX} tecken.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase.from("leave_periods").insert({
    user_id: user.id,
    kind: input.kind,
    start_date: startDate,
    end_date: endDate,
    title,
    note,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function updateLeavePeriodAction(input: {
  id: string;
  kind: LeaveKind;
  startDate: string;
  endDate: string;
  title?: string;
  note?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar id." };
  if (!isLeaveKind(input.kind)) {
    return { ok: false, error: "Ogiltig typ." };
  }
  if (!ISO_DATE_RE.test(input.startDate) || !ISO_DATE_RE.test(input.endDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const { startDate, endDate } = normalizeRange(input.startDate, input.endDate);
  const { title, error: titleError } = trimTitle(input.kind, input.title);
  if (titleError) return { ok: false, error: titleError };
  const note = trimNote(input.note);
  if (input.note?.trim() && !note) {
    return { ok: false, error: `Max ${NOTE_MAX} tecken.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("leave_periods")
    .update({
      kind: input.kind,
      start_date: startDate,
      end_date: endDate,
      title,
      note,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function archiveLeavePeriodAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("leave_periods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}
