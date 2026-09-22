"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BODY_MAX = 2000;

function revalidateTrip() {
  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
}

export async function saveTripDayNoteAction(input: {
  periodId: string;
  localDate: string;
  body: string;
}): Promise<ActionResult> {
  if (!input.periodId) return { ok: false, error: "Saknar resa." };
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Skriv en anteckning om dagen." };
  if (body.length > BODY_MAX) {
    return { ok: false, error: `Max ${BODY_MAX} tecken.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: period, error: periodError } = await supabase
    .from("leave_periods")
    .select("id, kind, start_date, end_date")
    .eq("id", input.periodId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (periodError) return { ok: false, error: periodError.message };
  if (!period || period.kind !== "travel") {
    return { ok: false, error: "Resan hittades inte." };
  }
  if (input.localDate < period.start_date || input.localDate > period.end_date) {
    return { ok: false, error: "Datumet ligger inte på resan." };
  }

  const { data: existing } = await supabase
    .from("trip_day_notes")
    .select("id, done_at")
    .eq("user_id", user.id)
    .eq("leave_period_id", period.id)
    .eq("local_date", input.localDate)
    .maybeSingle();

  const doneAt = existing?.done_at ?? new Date().toISOString();

  const { error } = existing
    ? await supabase
        .from("trip_day_notes")
        .update({ body, done_at: doneAt })
        .eq("id", existing.id)
        .eq("user_id", user.id)
    : await supabase.from("trip_day_notes").insert({
        user_id: user.id,
        leave_period_id: period.id,
        local_date: input.localDate,
        body,
        done_at: doneAt,
      });
  if (error) return { ok: false, error: error.message };

  revalidateTrip();
  return { ok: true };
}

export async function resetTripDayNoteAction(input: {
  periodId: string;
  localDate: string;
}): Promise<ActionResult> {
  if (!input.periodId) return { ok: false, error: "Saknar resa." };
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("trip_day_notes")
    .update({ done_at: null })
    .eq("user_id", user.id)
    .eq("leave_period_id", input.periodId)
    .eq("local_date", input.localDate);
  if (error) return { ok: false, error: error.message };

  revalidateTrip();
  return { ok: true };
}
