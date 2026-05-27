"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { isHexColor, type TaskScope, type Weekday } from "@/lib/tasks";

type CategoryUpdate = Database["public"]["Tables"]["task_categories"]["Update"];
type WeeklyTaskUpdate = Database["public"]["Tables"]["weekly_tasks"]["Update"];
type MonthlyTaskUpdate = Database["public"]["Tables"]["monthly_tasks"]["Update"];

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ----------------------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------------------

const VALID_SCOPES: ReadonlySet<TaskScope> = new Set([
  "daily",
  "weekly",
  "monthly",
]);

function cleanTitle(raw: string, max = 80): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (s.length > max) return null;
  return s;
}

function cleanIcon(raw: string | undefined, fallback = "✓"): string {
  return (raw ?? "").trim().slice(0, 4) || fallback;
}

function cleanAccent(raw: string | undefined, fallback = "#ff7a1a"): string {
  return raw && isHexColor(raw) ? raw : fallback;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_START_RE = /^\d{4}-\d{2}-01$/;

function isMonday(localDate: string): boolean {
  if (!ISO_DATE_RE.test(localDate)) return false;
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getDay() === 1; // 1 = Monday
}

// ============================================================================
// Categories
// ============================================================================

export async function createCategoryAction(input: {
  scope: TaskScope;
  name: string;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  if (!VALID_SCOPES.has(input.scope)) {
    return { ok: false, error: "Invalid scope." };
  }
  const name = cleanTitle(input.name, 32);
  if (!name) return { ok: false, error: "Name is required (max 32 chars)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: maxRow } = await supabase
    .from("task_categories")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("scope", input.scope)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("task_categories").insert({
    user_id: user.id,
    scope: input.scope,
    name,
    icon: cleanIcon(input.icon, "📁"),
    accent: cleanAccent(input.accent),
    sort_order: nextOrder,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A category with that name already exists." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCategoryAction(input: {
  id: string;
  name?: string;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Missing category id." };

  const patch: CategoryUpdate = {};
  if (input.name !== undefined) {
    const name = cleanTitle(input.name, 32);
    if (!name) return { ok: false, error: "Name is required (max 32 chars)." };
    patch.name = name;
  }
  if (input.icon !== undefined) patch.icon = cleanIcon(input.icon, "📁");
  if (input.accent !== undefined) patch.accent = cleanAccent(input.accent);

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("task_categories")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A category with that name already exists." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing category id." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Soft-archive instead of hard-delete so any tasks pointing here keep
  // working (the FK is on delete set null, but soft-archive is reversible).
  const { error } = await supabase
    .from("task_categories")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ============================================================================
// Weekly tasks
// ============================================================================

export async function createWeeklyTaskAction(input: {
  title: string;
  categoryId?: string | null;
  notes?: string;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  const title = cleanTitle(input.title, 80);
  if (!title) return { ok: false, error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Resolve next sort_order at the end of the user's list.
  const { data: maxRow } = await supabase
    .from("weekly_tasks")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("weekly_tasks").insert({
    user_id: user.id,
    category_id: input.categoryId ?? null,
    title,
    notes: input.notes?.trim() || null,
    icon: cleanIcon(input.icon),
    accent: cleanAccent(input.accent),
    sort_order: nextOrder,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateWeeklyTaskAction(input: {
  id: string;
  title?: string;
  categoryId?: string | null;
  notes?: string | null;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Missing task id." };

  const patch: WeeklyTaskUpdate = {};
  if (input.title !== undefined) {
    const title = cleanTitle(input.title, 80);
    if (!title) return { ok: false, error: "Title is required." };
    patch.title = title;
  }
  if (input.categoryId !== undefined) patch.category_id = input.categoryId ?? null;
  if (input.notes !== undefined) {
    patch.notes = input.notes ? input.notes.trim() || null : null;
  }
  if (input.icon !== undefined) patch.icon = cleanIcon(input.icon);
  if (input.accent !== undefined) patch.accent = cleanAccent(input.accent);

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("weekly_tasks")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveWeeklyTaskAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing task id." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("weekly_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Place (or move) a weekly task onto a specific weekday for the given week.
 * Creates the placement row if it doesn't exist. Resets `done_at` to null
 * when first placed; subsequent moves keep done state intact.
 */
export async function placeWeeklyTaskAction(input: {
  taskId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
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
    .from("weekly_task_placements")
    .select("id, done_at, note")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("weekly_task_placements")
      .update({ weekday: input.weekday })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("weekly_task_placements").insert({
      user_id: user.id,
      task_id: input.taskId,
      week_start: input.weekStart,
      weekday: input.weekday,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/week", "page");
  return { ok: true };
}

/** Removes the placement for this week — task returns to the backlog. */
export async function unplaceWeeklyTaskAction(input: {
  taskId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("weekly_task_placements")
    .delete()
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/week", "page");
  return { ok: true };
}

/** Toggle the done state for a weekly task placement on a given week. */
export async function toggleWeeklyTaskDoneAction(input: {
  taskId: string;
  weekStart: string;
  done: boolean;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Must be placed first.
  const { data: existing } = await supabase
    .from("weekly_task_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();
  if (!existing) {
    return { ok: false, error: "Place the task on a day first." };
  }

  const { error } = await supabase
    .from("weekly_task_placements")
    .update({ done_at: input.done ? new Date().toISOString() : null })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/week", "page");
  return { ok: true };
}

// ============================================================================
// Monthly tasks
// ============================================================================

export async function createMonthlyTaskAction(input: {
  title: string;
  categoryId?: string | null;
  dayOfMonth?: number | null;
  notes?: string;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  const title = cleanTitle(input.title, 80);
  if (!title) return { ok: false, error: "Title is required." };

  let dayOfMonth: number | null = null;
  if (input.dayOfMonth !== null && input.dayOfMonth !== undefined) {
    const n = Math.round(Number(input.dayOfMonth));
    if (!Number.isFinite(n) || n < 1 || n > 31) {
      return { ok: false, error: "Day of month must be 1–31." };
    }
    dayOfMonth = n;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: maxRow } = await supabase
    .from("monthly_tasks")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("monthly_tasks").insert({
    user_id: user.id,
    category_id: input.categoryId ?? null,
    title,
    notes: input.notes?.trim() || null,
    day_of_month: dayOfMonth,
    icon: cleanIcon(input.icon),
    accent: cleanAccent(input.accent),
    sort_order: nextOrder,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateMonthlyTaskAction(input: {
  id: string;
  title?: string;
  categoryId?: string | null;
  dayOfMonth?: number | null;
  notes?: string | null;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Missing task id." };

  const patch: MonthlyTaskUpdate = {};
  if (input.title !== undefined) {
    const title = cleanTitle(input.title, 80);
    if (!title) return { ok: false, error: "Title is required." };
    patch.title = title;
  }
  if (input.categoryId !== undefined) patch.category_id = input.categoryId ?? null;
  if (input.dayOfMonth !== undefined) {
    if (input.dayOfMonth === null) {
      patch.day_of_month = null;
    } else {
      const n = Math.round(Number(input.dayOfMonth));
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        return { ok: false, error: "Day of month must be 1–31." };
      }
      patch.day_of_month = n;
    }
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes ? input.notes.trim() || null : null;
  }
  if (input.icon !== undefined) patch.icon = cleanIcon(input.icon);
  if (input.accent !== undefined) patch.accent = cleanAccent(input.accent);

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("monthly_tasks")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveMonthlyTaskAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Missing task id." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("monthly_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Toggle the done state for a monthly task on a given month. */
export async function toggleMonthlyTaskDoneAction(input: {
  taskId: string;
  monthStart: string;
  done: boolean;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!MONTH_START_RE.test(input.monthStart)) {
    return { ok: false, error: "Invalid month." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("monthly_task_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("month_start", input.monthStart)
    .maybeSingle();

  const doneAt = input.done ? new Date().toISOString() : null;

  if (existing) {
    const { error } = await supabase
      .from("monthly_task_completions")
      .update({ done_at: doneAt })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("monthly_task_completions").insert({
      user_id: user.id,
      task_id: input.taskId,
      month_start: input.monthStart,
      done_at: doneAt,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/month", "page");
  return { ok: true };
}

// ============================================================================
// Daily habits ↔ category (lightweight)
// ============================================================================

/**
 * Attach (or detach) a category to an existing daily habit. The category must
 * be a 'daily' scope category belonging to the same user.
 */
export async function setHabitCategoryAction(input: {
  habitId: string;
  categoryId: string | null;
}): Promise<ActionResult> {
  if (!input.habitId) return { ok: false, error: "Missing habit id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

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

  const { error } = await supabase
    .from("habits")
    .update({ category_id: input.categoryId })
    .eq("id", input.habitId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
