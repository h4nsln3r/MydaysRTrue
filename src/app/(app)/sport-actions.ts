"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureSportTemplate } from "@/lib/sport.server";
import type { Weekday } from "@/lib/tasks";
import { nextWeekDaySortOrder } from "@/lib/week-plan-order.server";

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

/** Add a new sport instance from the backlog onto a weekday. */
export async function addSportPlacementAction(input: {
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

  const daySortOrder = await nextWeekDaySortOrder(
    user.id,
    input.weekStart,
    input.weekday,
  );

  const { data: template } = await supabase
    .from("sport_session_templates")
    .select("id")
    .eq("id", input.templateId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!template) return { ok: false, error: "Passet hittades inte." };

  const { error } = await supabase.from("sport_week_placements").insert({
    user_id: user.id,
    template_id: input.templateId,
    week_start: input.weekStart,
    weekday: input.weekday,
    day_sort_order: daySortOrder,
  });

  if (error) {
    // Legacy DBs may still have unique (user, template, week) — move existing row.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("sport_week_placements")
        .select("id")
        .eq("user_id", user.id)
        .eq("template_id", input.templateId)
        .eq("week_start", input.weekStart)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("sport_week_placements")
          .update({ weekday: input.weekday, day_sort_order: daySortOrder })
          .eq("id", existing.id)
          .eq("user_id", user.id);
        if (updateError) return { ok: false, error: updateError.message };
        revalidatePath("/", "layout");
        return { ok: true };
      }
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Move an existing sport instance to another weekday. */
export async function moveSportPlacementAction(input: {
  placementId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  if (!input.placementId) return { ok: false, error: "Saknar placering." };
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
    .from("sport_week_placements")
    .select("weekday, day_sort_order")
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  const movingDay = existing?.weekday !== input.weekday;
  const daySortOrder = movingDay
    ? await nextWeekDaySortOrder(user.id, input.weekStart, input.weekday)
    : (existing?.day_sort_order ?? 0);

  const { error } = await supabase
    .from("sport_week_placements")
    .update({ weekday: input.weekday, day_sort_order: daySortOrder })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** @deprecated Prefer addSportPlacementAction / moveSportPlacementAction. */
export async function moveSportSessionAction(input: {
  templateId: string;
  weekStart: string;
  weekday: Weekday;
  placementId?: string;
}): Promise<ActionResult> {
  if (input.placementId) {
    return moveSportPlacementAction({
      placementId: input.placementId,
      weekStart: input.weekStart,
      weekday: input.weekday,
    });
  }
  return addSportPlacementAction(input);
}

/** Remove a sport instance from the week (backlog source stays). */
export async function deleteSportPlacementAction(input: {
  placementId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.placementId) return { ok: false, error: "Saknar placering." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("sport_week_placements")
    .delete()
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** @deprecated Prefer deleteSportPlacementAction. */
export async function unplaceSportSessionAction(input: {
  templateId: string;
  weekStart: string;
  placementId?: string;
}): Promise<ActionResult> {
  if (input.placementId) {
    return deleteSportPlacementAction({
      placementId: input.placementId,
      weekStart: input.weekStart,
    });
  }
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
    .from("sport_week_placements")
    .delete()
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateSportDefaultWeekdayAction(input: {
  templateId: string;
  defaultWeekday: Weekday;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Saknar pass-id." };
  if (input.defaultWeekday < 1 || input.defaultWeekday > 7) {
    return { ok: false, error: "Ogiltig veckodag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("sport_session_templates")
    .update({ default_weekday: input.defaultWeekday })
    .eq("id", input.templateId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateSportPlanAction(input: {
  placementId: string;
  weekStart: string;
  planSport: string;
}): Promise<ActionResult> {
  if (!input.placementId) return { ok: false, error: "Saknar placering." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const planSport = (input.planSport ?? "").trim();
  if (!planSport) {
    return { ok: false, error: "Skriv vilken sport du planerar." };
  }
  if (planSport.length > 80) {
    return { ok: false, error: "Håll sporten under 80 tecken." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("sport_week_placements")
    .update({ plan_sport: planSport })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeSportSessionAction(input: {
  placementId: string;
  weekStart: string;
  actualSport: string;
  note: string;
  companions: string;
}): Promise<ActionResult> {
  if (!input.placementId) return { ok: false, error: "Saknar placering." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const actualSport = (input.actualSport ?? "").trim();
  if (!actualSport) {
    return { ok: false, error: "Skriv vilken sport det blev." };
  }
  if (actualSport.length > 80) {
    return { ok: false, error: "Håll sporten under 80 tecken." };
  }

  const note = (input.note ?? "").trim();
  const companions = (input.companions ?? "").trim();
  if (note.length > 280) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }
  if (companions.length > 120) {
    return { ok: false, error: "Håll med-spelare under 120 tecken." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("sport_week_placements")
    .select("id, weekday")
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (!existing?.weekday) {
    return { ok: false, error: "Passet är inte placerat den här veckan." };
  }

  const { error } = await supabase
    .from("sport_week_placements")
    .update({
      done_at: new Date().toISOString(),
      actual_sport: actualSport,
      note: note || null,
      companions: companions || null,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uncompleteSportSessionAction(input: {
  placementId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.placementId) return { ok: false, error: "Saknar placering." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("sport_week_placements")
    .update({
      done_at: null,
      actual_sport: null,
      note: null,
      companions: null,
    })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetSportWeekToDefaultsAction(
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

  await ensureSportTemplate(supabase, user.id);

  const { error } = await supabase
    .from("sport_week_placements")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
