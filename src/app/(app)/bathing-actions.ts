"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bathingRequiresWaterTemp, type BathingKey } from "@/lib/bathing";
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

function validateWaterTemp(key: BathingKey | string, waterTempC: number | undefined): string | null {
  if (!bathingRequiresWaterTemp(key)) return null;

  if (waterTempC == null || !Number.isFinite(waterTempC)) {
    return "Ange vattentemperaturen i °C.";
  }
  if (waterTempC < -5 || waterTempC > 30) {
    return "Vattentemperaturen ska vara mellan -5 och 30 °C.";
  }
  return null;
}

/** Add a new bathing instance from the backlog onto a weekday. */
export async function addBathingPlacementAction(input: {
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
    .from("bathing_session_templates")
    .select("id, key")
    .eq("id", input.templateId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!template) return { ok: false, error: "Passet hittades inte." };

  // "bad" is repeatable — any number of baths per week. Other templates
  // (bastu) keep their one-per-week behaviour and reuse an orphan/existing row.
  const repeatable = template.key === "bad";

  if (!repeatable) {
    const { count: placedCount } = await supabase
      .from("bathing_week_placements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("template_id", input.templateId)
      .eq("week_start", input.weekStart)
      .not("weekday", "is", null);

    if (placedCount && placedCount > 0) {
      return {
        ok: false,
        error: "Det här passet är redan placerat den här veckan.",
      };
    }
  }

  // Invisible orphan rows (weekday null) block insert under the legacy unique
  // index — reuse one for non-repeatable templates.
  const { data: orphan } = repeatable
    ? { data: null }
    : await supabase
        .from("bathing_week_placements")
        .select("id")
        .eq("user_id", user.id)
        .eq("template_id", input.templateId)
        .eq("week_start", input.weekStart)
        .is("weekday", null)
        .maybeSingle();

  if (orphan) {
    const { error } = await supabase
      .from("bathing_week_placements")
      .update({ weekday: input.weekday, day_sort_order: daySortOrder })
      .eq("id", orphan.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const { error } = await supabase.from("bathing_week_placements").insert({
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
        .from("bathing_week_placements")
        .select("id")
        .eq("user_id", user.id)
        .eq("template_id", input.templateId)
        .eq("week_start", input.weekStart)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("bathing_week_placements")
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

/**
 * Log an extra, ad-hoc bath on a weekday: creates a NEW placement for the
 * repeatable "bad" template and immediately marks it done with the water temp.
 */
export async function logExtraBathAction(input: {
  weekStart: string;
  weekday: Weekday;
  waterTempC?: number;
  note?: string;
}): Promise<ActionResult> {
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

  const { data: template } = await supabase
    .from("bathing_session_templates")
    .select("id")
    .eq("user_id", user.id)
    .eq("key", "bad")
    .is("archived_at", null)
    .maybeSingle();
  if (!template) return { ok: false, error: "Badpasset hittades inte." };

  const tempError = validateWaterTemp("bad", input.waterTempC);
  if (tempError) return { ok: false, error: tempError };

  const daySortOrder = await nextWeekDaySortOrder(
    user.id,
    input.weekStart,
    input.weekday,
  );

  const { error } = await supabase.from("bathing_week_placements").insert({
    user_id: user.id,
    template_id: template.id,
    week_start: input.weekStart,
    weekday: input.weekday,
    day_sort_order: daySortOrder,
    done_at: new Date().toISOString(),
    water_temp_c:
      input.waterTempC != null && Number.isFinite(input.waterTempC)
        ? input.waterTempC
        : null,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Move an existing bathing instance to another weekday. */
export async function moveBathingPlacementAction(input: {
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
    .from("bathing_week_placements")
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
    .from("bathing_week_placements")
    .update({ weekday: input.weekday, day_sort_order: daySortOrder })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** @deprecated Use addBathingPlacementAction or moveBathingPlacementAction. */
export async function moveBathingSessionAction(input: {
  templateId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  return addBathingPlacementAction(input);
}

/** Remove a bathing instance from the week (backlog source stays). */
export async function deleteBathingPlacementAction(input: {
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
    .from("bathing_week_placements")
    .delete()
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** @deprecated Use deleteBathingPlacementAction. */
export async function unplaceBathingSessionAction(input: {
  templateId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Saknar pass-id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("bathing_week_placements")
    .delete()
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBathingDefaultWeekdayAction(input: {
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
    .from("bathing_session_templates")
    .update({ default_weekday: input.defaultWeekday })
    .eq("id", input.templateId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeBathingSessionAction(input: {
  placementId: string;
  weekStart: string;
  waterTempC?: number;
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

  const { data: placement } = await supabase
    .from("bathing_week_placements")
    .select("id, template_id, weekday")
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart)
    .maybeSingle();
  if (!placement?.weekday) {
    return { ok: false, error: "Passet är inte placerat den här veckan." };
  }

  const { data: template } = await supabase
    .from("bathing_session_templates")
    .select("key")
    .eq("id", placement.template_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!template) return { ok: false, error: "Passet hittades inte." };

  const tempError = validateWaterTemp(
    template.key as BathingKey,
    input.waterTempC,
  );
  if (tempError) return { ok: false, error: tempError };

  const { error } = await supabase
    .from("bathing_week_placements")
    .update({
      done_at: new Date().toISOString(),
      water_temp_c:
        input.waterTempC != null && Number.isFinite(input.waterTempC)
          ? input.waterTempC
          : null,
      note: input.note?.trim() || null,
    })
    .eq("id", placement.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uncompleteBathingSessionAction(input: {
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
    .from("bathing_week_placements")
    .update({
      done_at: null,
      water_temp_c: null,
      note: null,
    })
    .eq("id", input.placementId)
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetBathingWeekToDefaultsAction(
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

  const { error } = await supabase
    .from("bathing_week_placements")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

