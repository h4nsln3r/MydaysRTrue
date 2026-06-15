"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isWorkday } from "@/lib/work";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE_LEN = 500;

function trimNote(note?: string): string | null {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > MAX_NOTE_LEN) return null;
  return trimmed;
}

export async function logWorkStartAction(input: {
  localDate: string;
  note?: string;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (!isWorkday(input.localDate)) {
    return { ok: false, error: "Jobb loggas vardagar (mån–fre)." };
  }

  const note = trimNote(input.note);
  if (input.note?.trim() && !note) {
    return { ok: false, error: `Max ${MAX_NOTE_LEN} tecken.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("work_daily_logs")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .maybeSingle();

  if (existing?.started_at) {
    return { ok: false, error: "Jobbstart är redan loggad." };
  }

  const { error } = await supabase.from("work_daily_logs").upsert(
    {
      user_id: user.id,
      local_date: input.localDate,
      started_at: new Date().toISOString(),
      start_note: note,
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logWorkEndAction(input: {
  localDate: string;
  note?: string;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (!isWorkday(input.localDate)) {
    return { ok: false, error: "Jobb loggas vardagar (mån–fre)." };
  }

  const note = trimNote(input.note);
  if (input.note?.trim() && !note) {
    return { ok: false, error: `Max ${MAX_NOTE_LEN} tecken.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("work_daily_logs")
    .select("started_at, ended_at")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .maybeSingle();

  if (!existing?.started_at) {
    return { ok: false, error: "Logga jobbstart först." };
  }
  if (existing.ended_at) {
    return { ok: false, error: "Jobbslut är redan loggat." };
  }

  const { error } = await supabase
    .from("work_daily_logs")
    .update({
      ended_at: new Date().toISOString(),
      end_note: note,
    })
    .eq("user_id", user.id)
    .eq("local_date", input.localDate);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateWorkNotesAction(input: {
  localDate: string;
  startNote?: string;
  endNote?: string;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const startNote =
    input.startNote !== undefined ? trimNote(input.startNote) : undefined;
  const endNote =
    input.endNote !== undefined ? trimNote(input.endNote) : undefined;

  if (input.startNote?.trim() && startNote === null) {
    return { ok: false, error: `Max ${MAX_NOTE_LEN} tecken.` };
  }
  if (input.endNote?.trim() && endNote === null) {
    return { ok: false, error: `Max ${MAX_NOTE_LEN} tecken.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const patch: {
    start_note?: string | null;
    end_note?: string | null;
  } = {};
  if (startNote !== undefined) patch.start_note = startNote;
  if (endNote !== undefined) patch.end_note = endNote;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("work_daily_logs")
    .update(patch)
    .eq("user_id", user.id)
    .eq("local_date", input.localDate);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
