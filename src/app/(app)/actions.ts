"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HabitStatus, MealKey } from "@/lib/habits";
import { MEAL_LABEL } from "@/lib/habits";

export interface LogWaterResult {
  ok: boolean;
  error?: string;
  totalMl?: number;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function logWaterAction(input: {
  amountMl: number;
  localDate: string;
  note?: string;
}): Promise<LogWaterResult> {
  const amount = Math.round(Number(input.amountMl));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a positive amount." };
  }
  if (amount > 5000) {
    return { ok: false, error: "That's a lot. Max 5000 ml per entry." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Invalid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("water_logs").insert({
    user_id: user.id,
    amount_ml: amount,
    local_date: input.localDate,
    note: input.note?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateWaterLogAction(input: {
  id: string;
  amountMl: number;
  note?: string;
}): Promise<LogWaterResult> {
  const amount = Math.round(Number(input.amountMl));

  if (!input.id) return { ok: false, error: "Missing entry id." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a positive amount." };
  }
  if (amount > 5000) {
    return { ok: false, error: "That's a lot. Max 5000 ml per entry." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("water_logs")
    .update({
      amount_ml: amount,
      note: input.note?.trim() || null,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteWaterLogAction(id: string): Promise<LogWaterResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("water_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ============================================================================
// Habits
// ============================================================================

/**
 * Set the tri-state status for a habit on a given local date. Passing
 * `status: null` clears the entry (deletes the row), which the UI uses when
 * the user taps the currently-active state again.
 */
export async function setHabitStatusAction(input: {
  habitId: string;
  localDate: string;
  status: HabitStatus | null;
  note?: string | null;
}): Promise<ActionResult> {
  if (!input.habitId) return { ok: false, error: "Missing habit id." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Invalid date." };
  }
  if (
    input.status !== null &&
    input.status !== "yes" &&
    input.status !== "half" &&
    input.status !== "no"
  ) {
    return { ok: false, error: "Invalid status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Make sure the habit belongs to the current user and is not a water habit
  // (water status is derived from water_logs, not stored as a check).
  const { data: habit, error: lookupErr } = await supabase
    .from("habits")
    .select("id, kind, user_id")
    .eq("id", input.habitId)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };
  if (!habit || habit.user_id !== user.id) {
    return { ok: false, error: "Habit not found." };
  }
  if (habit.kind === "water") {
    return { ok: false, error: "Water status is computed from your logs." };
  }

  if (input.status === null) {
    const { error } = await supabase
      .from("habit_checks")
      .delete()
      .eq("user_id", user.id)
      .eq("habit_id", input.habitId)
      .eq("local_date", input.localDate);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("habit_checks").upsert(
      {
        user_id: user.id,
        habit_id: input.habitId,
        local_date: input.localDate,
        status: input.status,
        note: input.note?.trim() || null,
      },
      { onConflict: "user_id,habit_id,local_date" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

const HABIT_KEY_RE = /^[a-z0-9_]+$/;

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

export async function createHabitAction(input: {
  label: string;
  icon?: string;
  accent?: string;
  categoryId?: string | null;
}): Promise<ActionResult> {
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Give your habit a name." };
  if (label.length > 32) {
    return { ok: false, error: "Keep the name under 32 characters." };
  }
  const icon = (input.icon ?? "✓").trim().slice(0, 4) || "✓";
  const accent = input.accent && /^#[0-9a-fA-F]{6}$/.test(input.accent)
    ? input.accent
    : "#ff7a1a";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Build a unique slug. If `name` collides, suffix with -2, -3 …
  let base = slugify(label);
  if (!HABIT_KEY_RE.test(base)) base = `habit_${Date.now()}`;

  const { data: existing } = await supabase
    .from("habits")
    .select("key")
    .eq("user_id", user.id);
  const used = new Set((existing ?? []).map((h) => h.key));

  let key = base;
  let n = 2;
  while (used.has(key)) {
    key = `${base}_${n++}`;
  }

  // Place at the end.
  const { data: maxRow } = await supabase
    .from("habits")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  if (input.categoryId) {
    const { data: cat } = await supabase
      .from("task_categories")
      .select("scope, user_id")
      .eq("id", input.categoryId)
      .maybeSingle();
    if (!cat || cat.user_id !== user.id || cat.scope !== "daily") {
      return { ok: false, error: "Invalid category." };
    }
  }

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    key,
    label,
    kind: "tri_state",
    icon,
    accent,
    sort_order: nextOrder,
    category_id: input.categoryId ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveHabitAction(habitId: string): Promise<ActionResult> {
  if (!habitId) return { ok: false, error: "Missing habit id." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("habits")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", habitId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Persist a new sort order for daily trackers (Planera drag-and-drop). */
export async function reorderHabitsAction(
  orderedIds: string[],
): Promise<ActionResult> {
  if (!orderedIds.length) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: owned } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", user.id)
    .is("archived_at", null);

  const ownedIds = new Set((owned ?? []).map((h) => h.id));
  if (orderedIds.some((id) => !ownedIds.has(id))) {
    return { ok: false, error: "Ogiltig spårare." };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("habits")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Toggle a snack slot (1 or 2) for a day. */
export async function toggleSnackAction(input: {
  localDate: string;
  slot: 1 | 2;
  checked: boolean;
}): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (input.slot !== 1 && input.slot !== 2) {
    return { ok: false, error: "Ogiltigt mellanmål." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.checked) {
    const { error } = await supabase.from("snack_checks").upsert(
      {
        user_id: user.id,
        local_date: input.localDate,
        slot: input.slot,
        done_at: new Date().toISOString(),
      },
      { onConflict: "user_id,local_date,slot" },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("snack_checks")
      .delete()
      .eq("user_id", user.id)
      .eq("local_date", input.localDate)
      .eq("slot", input.slot);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Turn a daily tracker on or off without archiving it. */
export async function setHabitEnabledAction(input: {
  habitId: string;
  enabled: boolean;
}): Promise<ActionResult> {
  if (!input.habitId) return { ok: false, error: "Missing habit id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("habits")
    .update({ enabled: input.enabled })
    .eq("id", input.habitId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Update daily goals for water, steps and activity hours. */
export async function updateDailyTrackerGoalsAction(input: {
  waterGoalMl?: number;
  stepsGoal?: number;
  activityHoursGoal?: number;
}): Promise<ActionResult> {
  const patch: {
    daily_water_goal_ml?: number;
    daily_steps_goal?: number;
    daily_activity_hours_goal?: number;
  } = {};

  if (input.waterGoalMl !== undefined) {
    const n = Math.round(Number(input.waterGoalMl));
    if (!Number.isFinite(n) || n < 250 || n > 20000) {
      return { ok: false, error: "Vattenmål måste vara 250–20000 ml." };
    }
    patch.daily_water_goal_ml = n;
  }

  if (input.stepsGoal !== undefined) {
    const n = Math.round(Number(input.stepsGoal));
    if (!Number.isFinite(n) || n < 100 || n > 100000) {
      return { ok: false, error: "Stegmål måste vara 100–100000." };
    }
    patch.daily_steps_goal = n;
  }

  if (input.activityHoursGoal !== undefined) {
    const n = Number(input.activityHoursGoal);
    if (!Number.isFinite(n) || n < 0 || n > 24) {
      return { ok: false, error: "Aktivitetsmål måste vara 0–24 timmar." };
    }
    patch.daily_activity_hours_goal = Math.round(n * 10) / 10;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Log steps and/or activity hours for a single day. */
export async function saveDailyActivityAction(input: {
  localDate: string;
  steps?: number | null;
  activityHours?: number | null;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  let steps: number | null = null;
  if (input.steps !== undefined && input.steps !== null) {
    const n = Math.round(Number(input.steps));
    if (!Number.isFinite(n) || n < 0 || n > 200000) {
      return { ok: false, error: "Steg måste vara 0–200000." };
    }
    steps = n;
  }

  let activityHours: number | null = null;
  if (input.activityHours !== undefined && input.activityHours !== null) {
    const n = Number(input.activityHours);
    if (!Number.isFinite(n) || n < 0 || n > 24) {
      return { ok: false, error: "Aktivitetstimmar måste vara 0–24." };
    }
    activityHours = Math.round(n * 10) / 10;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("daily_activity_logs")
    .select("steps, activity_hours")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .maybeSingle();

  const nextSteps =
    input.steps !== undefined ? steps : (existing?.steps ?? null);
  const nextHours =
    input.activityHours !== undefined
      ? activityHours
      : existing?.activity_hours != null
        ? Number(existing.activity_hours)
        : null;

  if (nextSteps === null && nextHours === null) {
    await supabase
      .from("daily_activity_logs")
      .delete()
      .eq("user_id", user.id)
      .eq("local_date", input.localDate);
  } else if (existing) {
    const { error } = await supabase
      .from("daily_activity_logs")
      .update({ steps: nextSteps, activity_hours: nextHours })
      .eq("user_id", user.id)
      .eq("local_date", input.localDate);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("daily_activity_logs").insert({
      user_id: user.id,
      local_date: input.localDate,
      steps: nextSteps,
      activity_hours: nextHours,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function restoreHabitAction(habitId: string): Promise<ActionResult> {
  if (!habitId) return { ok: false, error: "Missing habit id." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("habits")
    .update({ archived_at: null })
    .eq("id", habitId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ============================================================================
// Meals
// ============================================================================

const VALID_MEAL_KEYS: ReadonlySet<MealKey> = new Set([
  "breakfast",
  "lunch",
  "dinner",
]);

/**
 * Upsert a meal entry for a given (date, meal). When `waterMl > 0` the action
 * also keeps a linked `water_logs` row in sync — creating, updating, or
 * deleting it as needed — so the same liquid only has to be typed once.
 */
export async function saveMealAction(input: {
  meal: MealKey;
  localDate: string;
  description: string;
  waterMl?: number;
}): Promise<ActionResult> {
  if (!VALID_MEAL_KEYS.has(input.meal)) {
    return { ok: false, error: "Invalid meal." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Invalid date." };
  }
  const description = (input.description ?? "").trim();
  if (!description) {
    return { ok: false, error: "Write what you ate." };
  }
  if (description.length > 280) {
    return { ok: false, error: "Keep it under 280 characters." };
  }

  const waterMlRaw = input.waterMl ?? 0;
  if (!Number.isFinite(waterMlRaw) || waterMlRaw < 0) {
    return { ok: false, error: "Water can't be negative." };
  }
  const waterMl = Math.round(waterMlRaw);
  if (waterMl > 5000) {
    return { ok: false, error: "Max 5000 ml per entry." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Find existing meal (if any) so we can update its linked water_log in place.
  const { data: existing, error: lookupErr } = await supabase
    .from("meal_entries")
    .select("id, water_log_id")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .eq("meal", input.meal)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };

  // Resolve the water_log row.
  let waterLogId: string | null = existing?.water_log_id ?? null;
  if (waterMl > 0) {
    if (waterLogId) {
      const { error } = await supabase
        .from("water_logs")
        .update({
          amount_ml: waterMl,
          note: MEAL_LABEL[input.meal],
          local_date: input.localDate,
        })
        .eq("id", waterLogId)
        .eq("user_id", user.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: inserted, error } = await supabase
        .from("water_logs")
        .insert({
          user_id: user.id,
          amount_ml: waterMl,
          local_date: input.localDate,
          note: MEAL_LABEL[input.meal],
        })
        .select("id")
        .single();
      if (error || !inserted) {
        return { ok: false, error: error?.message ?? "Could not save water." };
      }
      waterLogId = inserted.id;
    }
  } else if (waterLogId) {
    // User cleared the water on the meal — remove the linked log too.
    await supabase
      .from("water_logs")
      .delete()
      .eq("id", waterLogId)
      .eq("user_id", user.id);
    waterLogId = null;
  }

  if (existing) {
    const { error } = await supabase
      .from("meal_entries")
      .update({
        description,
        water_log_id: waterLogId,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("meal_entries").insert({
      user_id: user.id,
      local_date: input.localDate,
      meal: input.meal,
      description,
      water_log_id: waterLogId,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Remove a logged meal. Any linked `water_logs` row is removed too, since
 * the user implicitly logged that liquid as part of the meal.
 */
export async function clearMealAction(input: {
  meal: MealKey;
  localDate: string;
}): Promise<ActionResult> {
  if (!VALID_MEAL_KEYS.has(input.meal)) {
    return { ok: false, error: "Invalid meal." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Invalid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("meal_entries")
    .select("id, water_log_id")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .eq("meal", input.meal)
    .maybeSingle();

  if (!existing) {
    return { ok: true };
  }

  if (existing.water_log_id) {
    await supabase
      .from("water_logs")
      .delete()
      .eq("id", existing.water_log_id)
      .eq("user_id", user.id);
  }

  const { error } = await supabase
    .from("meal_entries")
    .delete()
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
