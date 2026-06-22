"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

export async function moveSportSessionAction(input: {
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
    .from("sport_week_placements")
    .select("id, weekday, day_sort_order")
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  const movingDay = existing?.weekday !== input.weekday;
  const daySortOrder = movingDay
    ? await nextWeekDaySortOrder(user.id, input.weekStart, input.weekday)
    : (existing?.day_sort_order ?? 0);

  if (existing) {
    const { error } = await supabase
      .from("sport_week_placements")
      .update({ weekday: input.weekday, day_sort_order: daySortOrder })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: template } = await supabase
      .from("sport_session_templates")
      .select("default_weekday")
      .eq("id", input.templateId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!template) return { ok: false, error: "Passet hittades inte." };

    const { error } = await supabase.from("sport_week_placements").insert({
      user_id: user.id,
      template_id: input.templateId,
      week_start: input.weekStart,
      weekday: input.weekday,
      day_sort_order: daySortOrder,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unplaceSportSessionAction(input: {
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
    .from("sport_week_placements")
    .update({ weekday: null })
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
  templateId: string;
  weekStart: string;
  planSport: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Saknar pass-id." };
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

  const { data: existing } = await supabase
    .from("sport_week_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Passet är inte placerat den här veckan." };
  }

  const { error } = await supabase
    .from("sport_week_placements")
    .update({ plan_sport: planSport })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function completeSportSessionAction(input: {
  templateId: string;
  weekStart: string;
  actualSport: string;
  note: string;
  companions: string;
}): Promise<ActionResult> {
  if (!input.templateId) return { ok: false, error: "Saknar pass-id." };
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
    .select("id")
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (!existing) {
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
    .from("sport_week_placements")
    .update({
      done_at: null,
      actual_sport: null,
      note: null,
      companions: null,
    })
    .eq("user_id", user.id)
    .eq("template_id", input.templateId)
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

  const { data: templates } = await supabase
    .from("sport_session_templates")
    .select("id, default_weekday")
    .eq("user_id", user.id)
    .is("archived_at", null);

  if (!templates?.length) return { ok: true };

  for (const t of templates) {
    const { data: existing } = await supabase
      .from("sport_week_placements")
      .select("id")
      .eq("user_id", user.id)
      .eq("template_id", t.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("sport_week_placements")
        .update({ weekday: t.default_weekday })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("sport_week_placements").insert({
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
