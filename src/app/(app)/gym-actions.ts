"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGymWarmup, type GymWarmup } from "@/lib/gym";
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

/** Move a gym pass to another weekday for this week only. */
export async function moveGymSessionAction(input: {
  templateId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Missing pass id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }
  if (input.weekday < 1 || input.weekday > 7) {
    return { ok: false, error: "Invalid weekday." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("gym_week_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("gym_week_placements")
      .update({ weekday: input.weekday })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: template } = await supabase
      .from("gym_session_templates")
      .select("default_weekday")
      .eq("id", input.templateId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!template) return { ok: false, error: "Pass not found." };

    const { error } = await supabase.from("gym_week_placements").insert({
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

/** Move a gym pass back to the week backlog. */
export async function unplaceGymSessionAction(input: {
  templateId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Missing pass id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("gym_week_placements")
    .update({ weekday: null })
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Update a gym template's default weekday. */
export async function updateGymDefaultWeekdayAction(input: {
  templateId: string;
  defaultWeekday: Weekday;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Missing pass id." };
  if (input.defaultWeekday < 1 || input.defaultWeekday > 7) {
    return { ok: false, error: "Invalid weekday." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("gym_session_templates")
    .update({ default_weekday: input.defaultWeekday })
    .eq("id", input.templateId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Mark a gym pass as done with the chosen warmup. */
export async function completeGymSessionAction(input: {
  templateId: string;
  weekStart: string;
  warmup: GymWarmup;
  note?: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Missing pass id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }
  if (!isGymWarmup(input.warmup)) {
    return { ok: false, error: "Choose a warmup." };
  }

  const note = input.note?.trim() || null;
  if (note && note.length > 280) {
    return { ok: false, error: "Keep notes under 280 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("gym_week_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Pass is not placed this week." };
  }

  const { error } = await supabase
    .from("gym_week_placements")
    .update({
      warmup: input.warmup,
      done_at: new Date().toISOString(),
      note,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Clear completion (keeps the day placement). */
export async function uncompleteGymSessionAction(input: {
  templateId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Missing pass id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("gym_week_placements")
    .update({
      warmup: null,
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

/** Reset this week's placements to each template's default weekdays. */
export async function resetGymWeekToDefaultsAction(
  weekStart: string,
): Promise<ActionResult> {
  if (!isMonday(weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: templates } = await supabase
    .from("gym_session_templates")
    .select("id, default_weekday")
    .eq("user_id", user.id)
    .is("archived_at", null);

  if (!templates?.length) return { ok: true };

  for (const t of templates) {
    const { data: existing } = await supabase
      .from("gym_week_placements")
      .select("id")
      .eq("user_id", user.id)
      .eq("template_id", t.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("gym_week_placements")
        .update({ weekday: t.default_weekday })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("gym_week_placements").insert({
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
