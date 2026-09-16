"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCardioTemplate } from "@/lib/cardio.server";
import { isCardioKind, type CardioKind } from "@/lib/cardio";
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

function parseKind(
  value: string | null | undefined,
): CardioKind | null {
  const trimmed = value?.trim() || null;
  return isCardioKind(trimmed) ? trimmed : null;
}

/** Add a new cardio instance from the backlog onto a weekday. */
export async function addCardioPlacementAction(input: {
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
    .from("cardio_session_templates")
    .select("id")
    .eq("id", input.templateId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!template) return { ok: false, error: "Passet hittades inte." };

  const { error } = await supabase.from("cardio_week_placements").insert({
    user_id: user.id,
    template_id: input.templateId,
    week_start: input.weekStart,
    weekday: input.weekday,
    day_sort_order: daySortOrder,
  });

  if (error) {
    if (error.code === "23505") {
      const { data: orphan } = await supabase
        .from("cardio_week_placements")
        .select("id")
        .eq("user_id", user.id)
        .eq("template_id", input.templateId)
        .eq("week_start", input.weekStart)
        .is("weekday", null)
        .maybeSingle();

      if (orphan) {
        const { error: updateError } = await supabase
          .from("cardio_week_placements")
          .update({ weekday: input.weekday, day_sort_order: daySortOrder })
          .eq("id", orphan.id)
          .eq("user_id", user.id);
        if (updateError) return { ok: false, error: updateError.message };
        revalidatePath("/", "layout");
        return { ok: true };
      }

      return {
        ok: false,
        error:
          "Kunde inte lägga till ett till cardiopass. Databasen tillåter bara ett per vecka — kör senaste SQL-migreringen.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Move an existing cardio instance to another weekday. */
export async function moveCardioPlacementAction(input: {
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
    .from("cardio_week_placements")
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
    .from("cardio_week_placements")
    .update({ weekday: input.weekday, day_sort_order: daySortOrder })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** @deprecated Prefer addCardioPlacementAction / moveCardioPlacementAction. */
export async function moveCardioSessionAction(input: {
  templateId: string;
  weekStart: string;
  weekday: Weekday;
  placementId?: string;
}): Promise<ActionResult> {
  if (input.placementId) {
    return moveCardioPlacementAction({
      placementId: input.placementId,
      weekStart: input.weekStart,
      weekday: input.weekday,
    });
  }
  return addCardioPlacementAction(input);
}

export async function deleteCardioPlacementAction(input: {
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
    .from("cardio_week_placements")
    .delete()
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** @deprecated Prefer deleteCardioPlacementAction. */
export async function unplaceCardioSessionAction(input: {
  templateId: string;
  weekStart: string;
  placementId?: string;
}): Promise<ActionResult> {
  if (input.placementId) {
    return deleteCardioPlacementAction({
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
    .from("cardio_week_placements")
    .delete()
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCardioDefaultWeekdayAction(input: {
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
    .from("cardio_session_templates")
    .update({ default_weekday: input.defaultWeekday })
    .eq("id", input.templateId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCardioPlanAction(input: {
  placementId: string;
  weekStart: string;
  planKind: string | null;
}): Promise<ActionResult> {
  if (!input.placementId) return { ok: false, error: "Saknar placering." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const kind = parseKind(input.planKind);
  if (!kind) return { ok: false, error: "Välj löpning, cykling eller simning." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("cardio_week_placements")
    .update({ plan_kind: kind })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeCardioSessionAction(input: {
  placementId: string;
  weekStart: string;
  actualKind?: string | null;
  note?: string;
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

  const { data: existing } = await supabase
    .from("cardio_week_placements")
    .select("id, weekday, plan_kind")
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (!existing?.weekday) {
    return { ok: false, error: "Passet är inte placerat den här veckan." };
  }

  const kind = parseKind(input.actualKind) ?? parseKind(existing.plan_kind);
  if (!kind) {
    return { ok: false, error: "Välj löpning, cykling eller simning." };
  }

  const note = (input.note ?? "").trim();
  if (note.length > 280) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }

  const { error } = await supabase
    .from("cardio_week_placements")
    .update({
      done_at: new Date().toISOString(),
      actual_kind: kind,
      plan_kind: existing.plan_kind || kind,
      note: note || null,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uncompleteCardioSessionAction(input: {
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
    .from("cardio_week_placements")
    .update({
      done_at: null,
      actual_kind: null,
      note: null,
    })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
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

  await ensureCardioTemplate(supabase, user.id);

  const { error } = await supabase
    .from("cardio_week_placements")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
