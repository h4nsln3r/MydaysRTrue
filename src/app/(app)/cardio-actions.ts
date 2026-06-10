"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/tasks";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isMonday(localDate: string): boolean {
  if (!ISO_DATE_RE.test(localDate)) return false;
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getDay() === 1;
}

export async function moveCardioSessionAction(input: {
  templateId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Saknar pass-id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }
  if (input.weekday < 1 || input.weekday > 7) {
    return { ok: false, error: "Ogiltig veckodag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("cardio_week_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("cardio_week_placements")
      .update({ weekday: input.weekday })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: template } = await supabase
      .from("cardio_session_templates")
      .select("default_weekday")
      .eq("id", input.templateId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!template) return { ok: false, error: "Passet hittades inte." };

    const { error } = await supabase.from("cardio_week_placements").insert({
      user_id: user.id,
      template_id: input.templateId,
      week_start: input.weekStart,
      weekday: input.weekday,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeCardioSessionAction(input: {
  templateId: string;
  weekStart: string;
  note: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Saknar pass-id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const note = (input.note ?? "").trim();
  if (!note) {
    return { ok: false, error: "Skriv en kommentar om passet." };
  }
  if (note.length > 280) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("cardio_week_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Passet är inte placerat den här veckan." };
  }

  const { error } = await supabase
    .from("cardio_week_placements")
    .update({
      done_at: new Date().toISOString(),
      note,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uncompleteCardioSessionAction(input: {
  templateId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Saknar pass-id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("cardio_week_placements")
    .update({
      done_at: null,
      note: null,
    })
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetCardioWeekToDefaultsAction(
  weekStart: string,
): Promise<ActionResult> {
  if (!isMonday(weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: templates } = await supabase
    .from("cardio_session_templates")
    .select("id, default_weekday")
    .eq("user_id", user.id)
    .is("archived_at", null);

  if (!templates?.length) return { ok: true };

  for (const t of templates) {
    const { data: existing } = await supabase
      .from("cardio_week_placements")
      .select("id")
      .eq("user_id", user.id)
      .eq("template_id", t.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("cardio_week_placements")
        .update({ weekday: t.default_weekday })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("cardio_week_placements").insert({
        user_id: user.id,
        template_id: t.id,
        week_start: weekStart,
        weekday: t.default_weekday,
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
