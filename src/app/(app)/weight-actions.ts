"use server";

import { revalidatePath } from "next/cache";
import { addDaysISO } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/tasks";
import { nextWeekDaySortOrder } from "@/lib/week-plan-order.server";
import { isWeightTimeOfDay, type WeightTimeOfDay } from "@/lib/weight";

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

async function ensurePlan(
  userId: string,
  weekStart: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weight_week_plans")
    .select("week_start")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (data) return { ok: true };

  const { error } = await supabase.from("weight_week_plans").insert({
    user_id: userId,
    week_start: weekStart,
    enabled: true,
    weekday: null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Set the default weigh-in weekday on the user profile. */
export async function updateWeightDefaultWeekdayAction(
  defaultWeekday: Weekday | null,
): Promise<ActionResult> {
  if (
    defaultWeekday != null &&
    (defaultWeekday < 1 || defaultWeekday > 7)
  ) {
    return { ok: false, error: "Ogiltig standarddag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("profiles")
    .update({ default_weight_weekday: defaultWeekday })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Toggle weight tracking on/off for a specific week. */
export async function setWeightWeekEnabledAction(input: {
  weekStart: string;
  enabled: boolean;
}): Promise<ActionResult> {
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const ensured = await ensurePlan(user.id, input.weekStart);
  if (!ensured.ok) return ensured;

  const { error } = await supabase
    .from("weight_week_plans")
    .update({ enabled: input.enabled })
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

async function clearWeightLogsForWeek(
  userId: string,
  weekStart: string,
): Promise<void> {
  const supabase = await createClient();
  const weekEnd = addDaysISO(weekStart, 6);
  await supabase
    .from("weight_logs")
    .delete()
    .eq("user_id", userId)
    .gte("local_date", weekStart)
    .lte("local_date", weekEnd);
}

/** Place the weekly weight check on a weekday. */
export async function placeWeightWeekAction(input: {
  weekStart: string;
  weekday: Weekday;
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

  const ensured = await ensurePlan(user.id, input.weekStart);
  if (!ensured.ok) return ensured;

  const { data: current } = await supabase
    .from("weight_week_plans")
    .select("weekday, day_sort_order")
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (current?.weekday !== input.weekday) {
    await clearWeightLogsForWeek(user.id, input.weekStart);
  }

  const daySortOrder =
    current?.weekday !== input.weekday
      ? await nextWeekDaySortOrder(user.id, input.weekStart, input.weekday)
      : (current?.day_sort_order ?? 0);

  const { error } = await supabase
    .from("weight_week_plans")
    .update({
      weekday: input.weekday,
      enabled: true,
      day_sort_order: daySortOrder,
    })
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Move weight check back to the unplaced backlog. */
export async function unplaceWeightWeekAction(
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

  await clearWeightLogsForWeek(user.id, weekStart);

  const { error } = await supabase
    .from("weight_week_plans")
    .update({ weekday: null })
    .eq("user_id", user.id)
    .eq("week_start", weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Log weight for a calendar day. */
export async function saveWeightLogAction(input: {
  localDate: string;
  timeOfDay: WeightTimeOfDay;
  weightKg: number;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (!isWeightTimeOfDay(input.timeOfDay)) {
    return { ok: false, error: "Välj morgon, dag eller kväll." };
  }
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0 || input.weightKg >= 500) {
    return { ok: false, error: "Ange en giltig vikt i kg." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const rounded = Math.round(input.weightKg * 100) / 100;

  const { error } = await supabase.from("weight_logs").upsert(
    {
      user_id: user.id,
      local_date: input.localDate,
      time_of_day: input.timeOfDay,
      weight_kg: rounded,
      logged_at: new Date().toISOString(),
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove a weight log for a calendar day. */
export async function clearWeightLogAction(
  localDate: string,
): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("weight_logs")
    .delete()
    .eq("user_id", user.id)
    .eq("local_date", localDate);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
