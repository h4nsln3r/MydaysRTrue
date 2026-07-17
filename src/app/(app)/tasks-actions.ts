"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, parseLocalISO, todayLocalISO, weekStartISO } from "@/lib/date";
import { dateInMonth, monthStartFromDate, weeksInMonth } from "@/lib/monthly-bills";
import { shiftMonthStartISO } from "@/lib/month-plan-horizon";
import {
  applyTransferDelta,
  balancesFromSnapshotRow,
  EDITABLE_FINANCE_KEYS,
  EMPTY_FINANCE_BALANCES,
  financeTotal,
  lfTotal,
  TRANSFER_TASK_ACCOUNT,
  type EditableFinanceKey,
  type MonthlyFinanceBalances,
} from "@/lib/monthly-finance";
import type { Database } from "@/lib/supabase/database.types";
import {
  isHexColor,
  isMusicRepTask,
  MUSIC_BANDS,
  type MusicBand,
  type MusicLogKind,
  type TaskScope,
  type Weekday,
  type WeeklyTaskCompletionKind,
} from "@/lib/tasks";
import { yearFromLocalISO, GIG_RATING_MAX, GIG_RATING_MIN } from "@/lib/gigs";
import { UTGIFTER_CATEGORY_NAME } from "@/lib/expenses";
import { nextWeekDaySortOrder } from "@/lib/week-plan-order.server";

type CategoryUpdate = Database["public"]["Tables"]["task_categories"]["Update"];
type WeeklyTaskUpdate = Database["public"]["Tables"]["weekly_tasks"]["Update"];
type MonthlyTaskUpdate = Database["public"]["Tables"]["monthly_tasks"]["Update"];
type MonthlyFinanceSnapshotInsert =
  Database["public"]["Tables"]["monthly_finance_snapshots"]["Insert"];

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ----------------------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------------------

const VALID_SCOPES: ReadonlySet<TaskScope> = new Set([
  "daily",
  // Shared category set used by both weekly and monthly tasks.
  "task",
]);

/**
 * Verify a category exists, belongs to the user, and has the expected scope.
 * Returns null when valid, or an error message otherwise.
 */
async function validateCategoryScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string,
  scope: TaskScope,
): Promise<string | null> {
  const { data: cat } = await supabase
    .from("task_categories")
    .select("scope, user_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!cat || cat.user_id !== userId || cat.scope !== scope) {
    return "Invalid category.";
  }
  return null;
}

async function weeklyCompletionKindForCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string | null | undefined,
): Promise<WeeklyTaskCompletionKind | undefined> {
  if (!categoryId) return undefined;
  const { data: cat } = await supabase
    .from("task_categories")
    .select("name, user_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!cat || cat.user_id !== userId) return undefined;
  if (cat.name === UTGIFTER_CATEGORY_NAME) return "expense";
  return undefined;
}

async function monthlyCompletionKindForCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  categoryId: string | null | undefined,
): Promise<"amount" | undefined> {
  if (!categoryId) return undefined;
  const { data: cat } = await supabase
    .from("task_categories")
    .select("name, user_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!cat || cat.user_id !== userId) return undefined;
  if (cat.name === UTGIFTER_CATEGORY_NAME) return "amount";
  return undefined;
}

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

async function nextWeeklyDaySortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weekStart: string,
  weekday: Weekday,
): Promise<number> {
  void supabase;
  return nextWeekDaySortOrder(userId, weekStart, weekday);
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

  const completionKind = await weeklyCompletionKindForCategory(
    supabase,
    user.id,
    input.categoryId,
  );

  const { error } = await supabase.from("weekly_tasks").insert({
    user_id: user.id,
    category_id: input.categoryId ?? null,
    title,
    notes: input.notes?.trim() || null,
    icon: cleanIcon(input.icon),
    accent: cleanAccent(input.accent),
    sort_order: nextOrder,
    ...(completionKind ? { completion_kind: completionKind } : {}),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Create a one-off weekly task that exists ONLY for the given week and place it
 * on a weekday (or leave it in the week backlog when weekday is omitted). It
 * does not recur and is hidden from the profile editor / future weeks.
 */
export async function createOneOffWeeklyTaskAction(input: {
  title: string;
  weekStart: string;
  categoryId?: string | null;
  weekday?: Weekday | null;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  const title = cleanTitle(input.title, 80);
  if (!title) return { ok: false, error: "Title is required." };
  if (!isMonday(input.weekStart)) return { ok: false, error: "Invalid week." };
  if (input.weekday != null && (input.weekday < 1 || input.weekday > 7)) {
    return { ok: false, error: "Ogiltig veckodag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.categoryId) {
    const err = await validateCategoryScope(
      supabase,
      user.id,
      input.categoryId,
      "task",
    );
    if (err) return { ok: false, error: err };
  }

  const { data: maxRow } = await supabase
    .from("weekly_tasks")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const completionKind = await weeklyCompletionKindForCategory(
    supabase,
    user.id,
    input.categoryId,
  );

  // completion_kind omitted → DB default 'note' (quick check + optional comment).
  const { data: created, error } = await supabase
    .from("weekly_tasks")
    .insert({
      user_id: user.id,
      category_id: input.categoryId ?? null,
      title,
      icon: cleanIcon(input.icon),
      accent: cleanAccent(input.accent),
      sort_order: nextOrder,
      single_week_start: input.weekStart,
      ...(completionKind ? { completion_kind: completionKind } : {}),
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!created) return { ok: false, error: "Kunde inte skapa uppgiften." };

  const weekday = input.weekday ?? null;
  const daySortOrder =
    weekday != null
      ? await nextWeeklyDaySortOrder(supabase, user.id, input.weekStart, weekday)
      : 0;

  const { error: placeError } = await supabase
    .from("weekly_task_placements")
    .insert({
      user_id: user.id,
      task_id: created.id,
      week_start: input.weekStart,
      weekday,
      day_sort_order: daySortOrder,
    });
  if (placeError) return { ok: false, error: placeError.message };

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
  defaultWeekday?: Weekday | null;
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
  if (input.defaultWeekday !== undefined) {
    if (input.defaultWeekday === null) {
      patch.default_weekday = null;
    } else if (input.defaultWeekday >= 1 && input.defaultWeekday <= 7) {
      patch.default_weekday = input.defaultWeekday;
    } else {
      return { ok: false, error: "Ogiltig standarddag." };
    }
  }

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

export async function setWeeklyTaskEnabledAction(input: {
  taskId: string;
  enabled: boolean;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: task } = await supabase
    .from("weekly_tasks")
    .select("single_week_start")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };
  if (task.single_week_start) {
    return { ok: false, error: "Engångsuppgifter tas bort i stället för att stängas av." };
  }

  const { error } = await supabase
    .from("weekly_tasks")
    .update({ enabled: input.enabled })
    .eq("id", input.taskId)
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
    .select("id, done_at, note, weekday, day_sort_order")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  const movingDay = existing?.weekday !== input.weekday;
  const daySortOrder = movingDay
    ? await nextWeeklyDaySortOrder(
        supabase,
        user.id,
        input.weekStart,
        input.weekday,
      )
    : (existing?.day_sort_order ?? 0);

  if (existing) {
    const { error } = await supabase
      .from("weekly_task_placements")
      .update({
        weekday: input.weekday,
        day_sort_order: daySortOrder,
        on_hold: false,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("weekly_task_placements").insert({
      user_id: user.id,
      task_id: input.taskId,
      week_start: input.weekStart,
      weekday: input.weekday,
      day_sort_order: daySortOrder,
      on_hold: false,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Reorder weekly tasks on a single weekday in the week plan. */
export async function reorderWeeklyDayTasksAction(input: {
  weekStart: string;
  weekday: Weekday;
  taskIds: string[];
}): Promise<ActionResult> {
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Week must start on a Monday." };
  }
  if (input.weekday < 1 || input.weekday > 7) {
    return { ok: false, error: "Invalid weekday." };
  }
  if (input.taskIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: rows } = await supabase
    .from("weekly_task_placements")
    .select("id, task_id")
    .eq("user_id", user.id)
    .eq("week_start", input.weekStart)
    .eq("weekday", input.weekday)
    .in("task_id", input.taskIds);

  const idByTask = new Map((rows ?? []).map((r) => [r.task_id, r.id]));
  for (let i = 0; i < input.taskIds.length; i++) {
    const placementId = idByTask.get(input.taskIds[i]);
    if (!placementId) continue;
    const { error } = await supabase
      .from("weekly_task_placements")
      .update({ day_sort_order: i })
      .eq("id", placementId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Pause a one-off weekly task for this week — moves it to the on-hold list. */
export async function setWeeklyTaskOnHoldAction(input: {
  taskId: string;
  weekStart: string;
  onHold: boolean;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Saknar uppgifts-id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: task } = await supabase
    .from("weekly_tasks")
    .select("single_week_start")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Uppgiften hittades inte." };
  if (!task.single_week_start) {
    return {
      ok: false,
      error: "Bara engångsuppgifter kan pausas.",
    };
  }

  const { data: existing } = await supabase
    .from("weekly_task_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (input.onHold) {
    if (existing) {
      const { error } = await supabase
        .from("weekly_task_placements")
        .update({ on_hold: true, weekday: null })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("weekly_task_placements").insert({
        user_id: user.id,
        task_id: input.taskId,
        week_start: input.weekStart,
        weekday: null,
        day_sort_order: 0,
        on_hold: true,
      });
      if (error) return { ok: false, error: error.message };
    }
  } else if (existing) {
    const { error } = await supabase
      .from("weekly_task_placements")
      .update({ on_hold: false })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
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

  const { data: existing } = await supabase
    .from("weekly_task_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("weekly_task_placements")
      .update({ weekday: null })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Save planning fields (plan note) without marking the task done. */
export async function updateWeeklyTaskPlanAction(input: {
  taskId: string;
  weekStart: string;
  planNote: string;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Saknar uppgifts-id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: task } = await supabase
    .from("weekly_tasks")
    .select("completion_kind")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Uppgiften hittades inte." };

  const kind = task.completion_kind as WeeklyTaskCompletionKind;
  const planNote = input.planNote.trim();
  if (kind === "journal" && !planNote) {
    return { ok: false, error: "Skriv vad du ska jobba med." };
  }
  if (kind === "laundry" && !planNote) {
    return { ok: false, error: "Skriv vilken tid du bokat." };
  }
  if (kind !== "journal" && kind !== "laundry" && kind !== "music") {
    return { ok: false, error: "Uppgiften har inget att planera." };
  }

  const { data: existing } = await supabase
    .from("weekly_task_placements")
    .select("id")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();
  if (!existing) {
    return { ok: false, error: "Placera uppgiften på en dag först." };
  }

  const { error } = await supabase
    .from("weekly_task_placements")
    .update({ plan_note: planNote })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Complete a weekly task with kind-specific fields. */
export async function completeWeeklyTaskAction(input: {
  taskId: string;
  weekStart: string;
  planNote?: string;
  note?: string;
  shopLocation?: string;
  shopAmount?: number;
  laundryLoads?: number;
  band?: string;
  /** Music only: register as own-band gig or attended live concert. */
  musicLogKind?: MusicLogKind | null;
  /** Required when musicLogKind is gig or live. */
  musicTitle?: string;
  /** Venue (gig) or location (live). */
  musicPlace?: string;
  musicRating?: number | null;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Saknar uppgifts-id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: task } = await supabase
    .from("weekly_tasks")
    .select("completion_kind, key")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Uppgiften hittades inte." };

  const kind = task.completion_kind as WeeklyTaskCompletionKind;
  const note = (input.note ?? "").trim();
  const shopLocation = (input.shopLocation ?? "").trim();
  const bandInput = (input.band ?? "").trim();
  const musicLogKind = input.musicLogKind ?? null;
  const musicTitle = (input.musicTitle ?? "").trim();
  const musicPlace = (input.musicPlace ?? "").trim().slice(0, 120) || null;
  const eventNote = note.slice(0, 280);

  const { data: existing } = await supabase
    .from("weekly_task_placements")
    .select("id, plan_note, weekday")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();
  if (!existing) {
    return { ok: false, error: "Placera uppgiften på en dag först." };
  }
  if (existing.weekday == null) {
    return { ok: false, error: "Dra uppgiften till en dag i veckovyn först." };
  }

  const planNote =
    (input.planNote ?? "").trim() || (existing.plan_note ?? "").trim();

  let shopAmount: number | null = null;
  let completionNote: string | null = null;
  let laundryLoads: number | null = null;
  let band: MusicBand | null = null;
  let resolvedMusicLogKind: MusicLogKind | null = null;
  let gigId: string | null = null;
  let liveEventId: string | null = null;

  if (kind === "shop" || kind === "expense") {
    if (!shopLocation) {
      return {
        ok: false,
        error:
          kind === "expense"
            ? "Ange vad utgiften gällde."
            : "Ange var du handlade.",
      };
    }
    const amount = input.shopAmount;
    if (amount == null || !Number.isFinite(amount) || amount < 0) {
      return {
        ok: false,
        error:
          kind === "expense"
            ? "Ange beloppet."
            : "Ange hur mycket du handlade för.",
      };
    }
    shopAmount = Math.round(amount * 100) / 100;
  } else if (kind === "journal") {
    if (!note) {
      return { ok: false, error: "Anteckna vad du gjorde." };
    }
    if (note.length > 500) {
      return { ok: false, error: "Håll anteckningen under 500 tecken." };
    }
    completionNote = note;
  } else if (kind === "laundry") {
    const loads = input.laundryLoads;
    if (loads == null || !Number.isInteger(loads) || loads < 1 || loads > 30) {
      return { ok: false, error: "Ange antal tvättar (1–30)." };
    }
    laundryLoads = loads;
  } else if (kind === "music") {
    if (musicLogKind != null && musicLogKind !== "gig" && musicLogKind !== "live") {
      return { ok: false, error: "Ogiltig musikttyp." };
    }

    if (musicLogKind === "gig" || musicLogKind === "live") {
      if (!musicTitle) {
        return { ok: false, error: "Skriv en titel." };
      }
      if (musicTitle.length > 120) {
        return { ok: false, error: "Håll titeln under 120 tecken." };
      }
      if (note.length > 280) {
        return { ok: false, error: "Håll kommentaren under 280 tecken." };
      }

      const rating = input.musicRating;
      if (
        rating != null &&
        (!Number.isInteger(rating) ||
          rating < GIG_RATING_MIN ||
          rating > GIG_RATING_MAX)
      ) {
        return { ok: false, error: "Betyget måste vara 1–10." };
      }

      const eventDate = addDaysISO(input.weekStart, existing.weekday - 1);
      const year = yearFromLocalISO(eventDate);
      const nowIso = new Date().toISOString();

      if (musicLogKind === "gig") {
        if (!bandInput || !MUSIC_BANDS.includes(bandInput as MusicBand)) {
          return { ok: false, error: "Välj vilket band som spelade." };
        }
        band = bandInput as MusicBand;

        const { data: last } = await supabase
          .from("gigs")
          .select("sort_order")
          .eq("user_id", user.id)
          .eq("year", year)
          .is("archived_at", null)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: gig, error: gigError } = await supabase
          .from("gigs")
          .insert({
            user_id: user.id,
            year,
            band,
            title: musicTitle,
            event_date: eventDate,
            venue: musicPlace,
            note: eventNote || null,
            rating: rating ?? null,
            played_at: nowIso,
            sort_order: (last?.sort_order ?? -1) + 1,
          })
          .select("id")
          .single();
        if (gigError || !gig) {
          return {
            ok: false,
            error: gigError?.message ?? "Kunde inte spara spelningen.",
          };
        }
        gigId = gig.id;
      } else {
        const { data: last } = await supabase
          .from("live_events")
          .select("sort_order")
          .eq("user_id", user.id)
          .eq("year", year)
          .is("archived_at", null)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: liveEvent, error: liveError } = await supabase
          .from("live_events")
          .insert({
            user_id: user.id,
            year,
            kind: "concert",
            title: musicTitle,
            event_date: eventDate,
            location: musicPlace,
            note: eventNote || null,
            rating: rating ?? null,
            attended_at: nowIso,
            sort_order: (last?.sort_order ?? -1) + 1,
          })
          .select("id")
          .single();
        if (liveError || !liveEvent) {
          return {
            ok: false,
            error: liveError?.message ?? "Kunde inte spara live-spelningen.",
          };
        }
        liveEventId = liveEvent.id;
      }

      resolvedMusicLogKind = musicLogKind;
      completionNote = musicTitle;
    } else {
      if (!note) {
        return { ok: false, error: "Skriv en kommentar om vad du gjorde." };
      }
      if (note.length > 500) {
        return { ok: false, error: "Håll kommentaren under 500 tecken." };
      }
      completionNote = note;
      if (isMusicRepTask(task.key)) {
        if (!bandInput || !MUSIC_BANDS.includes(bandInput as MusicBand)) {
          return { ok: false, error: "Välj vilket band du repade med." };
        }
        band = bandInput as MusicBand;
      }
    }
  }

  // Any kind without a dedicated required text field may still carry an
  // optional free-text comment (simple, note, shop, laundry).
  if (completionNote == null && note) {
    completionNote = note.slice(0, 500);
  }

  const { error } = await supabase
    .from("weekly_task_placements")
    .update({
      done_at: new Date().toISOString(),
      plan_note: planNote || null,
      note: completionNote,
      shop_location:
        kind === "shop" || kind === "expense" ? shopLocation : null,
      shop_amount:
        kind === "shop" || kind === "expense" ? shopAmount : null,
      laundry_loads: laundryLoads,
      band: kind === "music" ? band : null,
      music_log_kind: kind === "music" ? resolvedMusicLogKind : null,
      gig_id: kind === "music" ? gigId : null,
      live_event_id: kind === "music" ? liveEventId : null,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) {
    if (gigId) {
      await supabase.from("gigs").delete().eq("id", gigId).eq("user_id", user.id);
    }
    if (liveEventId) {
      await supabase
        .from("live_events")
        .delete()
        .eq("id", liveEventId)
        .eq("user_id", user.id);
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
  return { ok: true };
}

export async function uncompleteWeeklyTaskAction(input: {
  taskId: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Saknar uppgifts-id." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("weekly_task_placements")
    .select("id, gig_id, live_event_id")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Uppgiften hittades inte." };

  const { error } = await supabase
    .from("weekly_task_placements")
    .update({
      done_at: null,
      note: null,
      shop_location: null,
      shop_amount: null,
      laundry_loads: null,
      band: null,
      music_log_kind: null,
      gig_id: null,
      live_event_id: null,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  if (existing.gig_id) {
    await supabase
      .from("gigs")
      .delete()
      .eq("id", existing.gig_id)
      .eq("user_id", user.id);
  }
  if (existing.live_event_id) {
    await supabase
      .from("live_events")
      .delete()
      .eq("id", existing.live_event_id)
      .eq("user_id", user.id);
  }

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  revalidatePath("/month", "page");
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
    .update(
      input.done
        ? { done_at: new Date().toISOString() }
        : {
            done_at: null,
            plan_note: null,
            note: null,
            shop_location: null,
            shop_amount: null,
            laundry_loads: null,
            band: null,
          },
    )
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  if (input.done) {
    const { data: task } = await supabase
      .from("weekly_tasks")
      .select("single_week_start, key")
      .eq("id", input.taskId)
      .eq("user_id", user.id)
      .maybeSingle();
    // Recurring user-created tasks (no system key, not a one-off) are archived
    // once done. One-offs (single_week_start set) are kept so they stay in
    // "Dagens plan" as a checked-off row and are recorded in the diary.
    if (task?.key == null && !task?.single_week_start) {
      await supabase
        .from("weekly_tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", input.taskId)
        .eq("user_id", user.id);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ============================================================================
// Weekly task checklist (music tasks)
// ============================================================================

export async function addWeeklyTaskChecklistItemAction(input: {
  taskId: string;
  text: string;
}): Promise<ActionResult> {
  const text = (input.text ?? "").trim();
  if (!text) return { ok: false, error: "Skriv en uppgift." };
  if (text.length > 200) return { ok: false, error: "Max 200 tecken." };
  if (!input.taskId) return { ok: false, error: "Saknar uppgifts-id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: task } = await supabase
    .from("weekly_tasks")
    .select("id")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Uppgiften hittades inte." };

  const { data: maxRow } = await supabase
    .from("weekly_task_checklist_items")
    .select("sort_order")
    .eq("task_id", input.taskId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("weekly_task_checklist_items").insert({
    user_id: user.id,
    task_id: input.taskId,
    text,
    sort_order: nextOrder,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateWeeklyTaskChecklistItemAction(input: {
  itemId: string;
  text: string;
}): Promise<ActionResult> {
  const text = (input.text ?? "").trim();
  if (!text) return { ok: false, error: "Skriv en uppgift." };
  if (text.length > 200) return { ok: false, error: "Max 200 tecken." };
  if (!input.itemId) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("weekly_task_checklist_items")
    .update({ text })
    .eq("id", input.itemId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleWeeklyTaskChecklistItemAction(input: {
  itemId: string;
  localDate: string;
  done: boolean;
  note?: string | null;
}): Promise<ActionResult> {
  if (!input.itemId) return { ok: false, error: "Saknar id." };
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: item } = await supabase
    .from("weekly_task_checklist_items")
    .select("id")
    .eq("id", input.itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return { ok: false, error: "Uppgiften hittades inte." };

  if (!input.done) {
    const { error } = await supabase
      .from("weekly_task_checklist_completions")
      .delete()
      .eq("checklist_item_id", input.itemId)
      .eq("local_date", input.localDate)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const note = (input.note ?? "").trim() || null;
    if (note && note.length > 500) {
      return { ok: false, error: "Håll kommentaren under 500 tecken." };
    }
    const { error } = await supabase.from("weekly_task_checklist_completions").upsert(
      {
        user_id: user.id,
        checklist_item_id: input.itemId,
        local_date: input.localDate,
        note,
        done_at: new Date().toISOString(),
      },
      { onConflict: "checklist_item_id,local_date" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteWeeklyTaskChecklistItemAction(
  itemId: string,
): Promise<ActionResult> {
  if (!itemId) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("weekly_task_checklist_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
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

  const completionKind = await monthlyCompletionKindForCategory(
    supabase,
    user.id,
    input.categoryId,
  );

  const { error } = await supabase.from("monthly_tasks").insert({
    user_id: user.id,
    category_id: input.categoryId ?? null,
    title,
    notes: input.notes?.trim() || null,
    day_of_month: dayOfMonth,
    icon: cleanIcon(input.icon),
    accent: cleanAccent(input.accent),
    sort_order: nextOrder,
    ...(completionKind ? { completion_kind: completionKind } : {}),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createOneOffMonthlyTaskAction(input: {
  title: string;
  monthStart: string;
  categoryId?: string | null;
  dayOfMonth?: number | null;
  notes?: string;
  icon?: string;
  accent?: string;
}): Promise<ActionResult> {
  const title = cleanTitle(input.title, 80);
  if (!title) return { ok: false, error: "Title is required." };
  if (!MONTH_START_RE.test(input.monthStart)) {
    return { ok: false, error: "Invalid month." };
  }

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

  if (input.categoryId) {
    const err = await validateCategoryScope(
      supabase,
      user.id,
      input.categoryId,
      "task",
    );
    if (err) return { ok: false, error: err };
  }

  const { data: maxRow } = await supabase
    .from("monthly_tasks")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const completionKind =
    (await monthlyCompletionKindForCategory(
      supabase,
      user.id,
      input.categoryId,
    )) ?? "simple";

  const { error } = await supabase.from("monthly_tasks").insert({
    user_id: user.id,
    category_id: input.categoryId ?? null,
    title,
    notes: input.notes?.trim() || null,
    day_of_month: dayOfMonth,
    icon: cleanIcon(input.icon),
    accent: cleanAccent(input.accent),
    sort_order: nextOrder,
    single_month_start: input.monthStart,
    completion_kind: completionKind,
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
  defaultAmountKr?: number | null;
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
  if (input.defaultAmountKr !== undefined) {
    if (input.defaultAmountKr === null) {
      patch.default_amount_kr = null;
    } else if (!Number.isFinite(input.defaultAmountKr) || input.defaultAmountKr < 0) {
      return { ok: false, error: "Kostnaden måste vara 0 eller mer." };
    } else {
      patch.default_amount_kr = Math.round(input.defaultAmountKr * 100) / 100;
    }
  }

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

export async function setMonthlyTaskEnabledAction(input: {
  taskId: string;
  enabled: boolean;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: task } = await supabase
    .from("monthly_tasks")
    .select("single_month_start")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };
  if (task.single_month_start) {
    return { ok: false, error: "Engångsuppgifter tas bort i stället för att stängas av." };
  }

  const { error } = await supabase
    .from("monthly_tasks")
    .update({ enabled: input.enabled })
    .eq("id", input.taskId)
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

async function upsertMonthlyBillSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  taskId: string,
  monthStart: string,
  scheduledDayOfMonth: number | null,
  scheduledWeekStart: string | null,
  isUnscheduled: boolean,
): Promise<ActionResult> {
  const { data: existing } = await supabase
    .from("monthly_task_completions")
    .select("id")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("month_start", monthStart)
    .maybeSingle();

  const payload = {
    scheduled_day_of_month: scheduledDayOfMonth,
    scheduled_week_start: scheduledWeekStart,
    is_unscheduled: isUnscheduled,
  };

  if (existing) {
    const { error } = await supabase
      .from("monthly_task_completions")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("monthly_task_completions").insert({
      user_id: userId,
      task_id: taskId,
      month_start: monthStart,
      done_at: null,
      ...payload,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Set this month's cost for a bill without marking it done. */
export async function setMonthlyBillAmountAction(input: {
  taskId: string;
  monthStart: string;
  amountKr: number | null;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!MONTH_START_RE.test(input.monthStart)) {
    return { ok: false, error: "Invalid month." };
  }
  if (
    input.amountKr != null &&
    (!Number.isFinite(input.amountKr) || input.amountKr < 0)
  ) {
    return { ok: false, error: "Kostnaden måste vara 0 eller mer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: task } = await supabase
    .from("monthly_tasks")
    .select("completion_kind")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };

  const amount =
    input.amountKr != null ? Math.round(input.amountKr * 100) / 100 : null;

  if (task.completion_kind === "amount") {
    if (amount == null) {
      return toggleMonthlyTaskDoneAction({
        taskId: input.taskId,
        monthStart: input.monthStart,
        done: false,
      });
    }
    return toggleMonthlyTaskDoneAction({
      taskId: input.taskId,
      monthStart: input.monthStart,
      done: true,
      amount,
    });
  }

  const { data: existing } = await supabase
    .from("monthly_task_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("month_start", input.monthStart)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("monthly_task_completions")
      .update({ amount })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else if (amount != null) {
    const { error } = await supabase.from("monthly_task_completions").insert({
      user_id: user.id,
      task_id: input.taskId,
      month_start: input.monthStart,
      done_at: null,
      amount,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Set which day of the month a bill is due (month plan). */
export async function scheduleMonthlyBillDayAction(input: {
  taskId: string;
  monthStart: string;
  dayOfMonth: number | null;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!MONTH_START_RE.test(input.monthStart)) {
    return { ok: false, error: "Invalid month." };
  }
  if (
    input.dayOfMonth != null &&
    (input.dayOfMonth < 1 || input.dayOfMonth > 31)
  ) {
    return { ok: false, error: "Invalid day." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.dayOfMonth == null) {
    return upsertMonthlyBillSchedule(
      supabase,
      user.id,
      input.taskId,
      input.monthStart,
      null,
      null,
      true,
    );
  }

  const weekStart = weekStartISO(
    parseLocalISO(dateInMonth(input.monthStart, input.dayOfMonth)),
  );

  return upsertMonthlyBillSchedule(
    supabase,
    user.id,
    input.taskId,
    input.monthStart,
    input.dayOfMonth,
    weekStart,
    false,
  );
}

/** Plan a monthly task on a week and/or day from the month board. */
export async function scheduleMonthlyTaskPlanAction(input: {
  taskId: string;
  monthStart: string;
  weekStart: string | null;
  dayOfMonth: number | null;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!MONTH_START_RE.test(input.monthStart)) {
    return { ok: false, error: "Invalid month." };
  }
  if (
    input.dayOfMonth != null &&
    (input.dayOfMonth < 1 || input.dayOfMonth > 31)
  ) {
    return { ok: false, error: "Ogiltig dag." };
  }
  if (input.weekStart != null && !ISO_DATE_RE.test(input.weekStart)) {
    return { ok: false, error: "Ogiltig vecka." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.weekStart == null && input.dayOfMonth == null) {
    return upsertMonthlyBillSchedule(
      supabase,
      user.id,
      input.taskId,
      input.monthStart,
      null,
      null,
      true,
    );
  }

  if (input.dayOfMonth != null) {
    const weekStart = weekStartISO(
      parseLocalISO(dateInMonth(input.monthStart, input.dayOfMonth)),
    );
    return upsertMonthlyBillSchedule(
      supabase,
      user.id,
      input.taskId,
      input.monthStart,
      input.dayOfMonth,
      weekStart,
      false,
    );
  }

  return upsertMonthlyBillSchedule(
    supabase,
    user.id,
    input.taskId,
    input.monthStart,
    null,
    input.weekStart,
    false,
  );
}

/** Copy last month's schedule (and bill amounts) into a future month plan. */
export async function copyMonthPlanFromPreviousAction(input: {
  monthStart: string;
}): Promise<ActionResult> {
  if (!MONTH_START_RE.test(input.monthStart)) {
    return { ok: false, error: "Invalid month." };
  }

  const prevMonthStart = shiftMonthStartISO(input.monthStart, -1);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [tasksRes, targetCompletionsRes, prevCompletionsRes] =
    await Promise.all([
      supabase
        .from("monthly_tasks")
        .select("id, day_of_month, single_month_start")
        .eq("user_id", user.id)
        .is("archived_at", null),
      supabase
        .from("monthly_task_completions")
        .select(
          "id, task_id, scheduled_day_of_month, scheduled_week_start, is_unscheduled, done_at",
        )
        .eq("user_id", user.id)
        .eq("month_start", input.monthStart),
      supabase
        .from("monthly_task_completions")
        .select(
          "id, task_id, scheduled_day_of_month, scheduled_week_start, is_unscheduled, amount",
        )
        .eq("user_id", user.id)
        .eq("month_start", prevMonthStart),
    ]);

  const targetByTask = new Map(
    (targetCompletionsRes.data ?? []).map((r) => [r.task_id, r]),
  );
  const prevByTask = new Map(
    (prevCompletionsRes.data ?? []).map((r) => [r.task_id, r]),
  );

  let copied = 0;

  for (const task of tasksRes.data ?? []) {
    if (task.single_month_start && task.single_month_start !== input.monthStart) {
      continue;
    }
    if (task.day_of_month != null) continue;

    const target = targetByTask.get(task.id);
    if (target?.done_at) continue;
    if (
      target?.scheduled_day_of_month != null ||
      target?.scheduled_week_start != null
    ) {
      continue;
    }
    if (target?.is_unscheduled) continue;

    const prev = prevByTask.get(task.id);
    if (!prev || prev.is_unscheduled) continue;
    if (prev.scheduled_day_of_month == null && !prev.scheduled_week_start) {
      continue;
    }

    let scheduledDay: number | null = prev.scheduled_day_of_month;
    let scheduledWeek: string | null = null;

    if (scheduledDay != null) {
      scheduledWeek = weekStartISO(
        parseLocalISO(dateInMonth(input.monthStart, scheduledDay)),
      );
    } else if (prev.scheduled_week_start) {
      const prevWeeks = weeksInMonth(prevMonthStart);
      const targetWeeks = weeksInMonth(input.monthStart);
      const idx = prevWeeks.indexOf(prev.scheduled_week_start);
      scheduledWeek =
        idx >= 0
          ? targetWeeks[Math.min(idx, targetWeeks.length - 1)]
          : targetWeeks[0];
    }

    const payload = {
      scheduled_day_of_month: scheduledDay,
      scheduled_week_start: scheduledWeek,
      is_unscheduled: false,
      ...(prev.amount != null ? { amount: Number(prev.amount) } : {}),
    };

    if (target) {
      const { error } = await supabase
        .from("monthly_task_completions")
        .update(payload)
        .eq("id", target.id)
        .eq("user_id", user.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("monthly_task_completions").insert({
        user_id: user.id,
        task_id: task.id,
        month_start: input.monthStart,
        done_at: null,
        ...payload,
      });
      if (error) return { ok: false, error: error.message };
    }
    copied += 1;
  }

  if (copied === 0) {
    return {
      ok: false,
      error: "Inget att kopiera — förra månaden saknar plan eller den här månaden är redan planerad.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Place a monthly bill on a weekday in the unified week board. */
export async function placeMonthlyBillFromWeekAction(input: {
  taskId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!ISO_DATE_RE.test(input.weekStart)) {
    return { ok: false, error: "Invalid week." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const localDate = addDaysISO(input.weekStart, input.weekday - 1);
  const monthStart = monthStartFromDate(localDate);
  const dayOfMonth = Number(localDate.split("-")[2]);

  const daySortOrder = await nextWeekDaySortOrder(
    user.id,
    input.weekStart,
    input.weekday,
  );

  const scheduleRes = await upsertMonthlyBillSchedule(
    supabase,
    user.id,
    input.taskId,
    monthStart,
    dayOfMonth,
    input.weekStart,
    false,
  );
  if (!scheduleRes.ok) return scheduleRes;

  const { error } = await supabase
    .from("monthly_task_completions")
    .update({ day_sort_order: daySortOrder })
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("month_start", monthStart);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Move a monthly task from a weekday back to the week backlog. */
export async function unplaceMonthlyBillFromWeekAction(input: {
  taskId: string;
  monthStart: string;
  weekStart: string;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };
  if (!MONTH_START_RE.test(input.monthStart)) {
    return { ok: false, error: "Invalid month." };
  }
  if (!ISO_DATE_RE.test(input.weekStart)) {
    return { ok: false, error: "Invalid week." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  return upsertMonthlyBillSchedule(
    supabase,
    user.id,
    input.taskId,
    input.monthStart,
    null,
    input.weekStart,
    false,
  );
}

async function syncTransferToFinanceSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  monthStart: string,
  account: EditableFinanceKey,
  delta: number,
): Promise<ActionResult> {
  const { data: snap } = await supabase
    .from("monthly_finance_snapshots")
    .select("kort, spar, isk, sbab_spar, avanza, krypto, cash")
    .eq("user_id", userId)
    .eq("month_start", monthStart)
    .maybeSingle();

  const balances = snap
    ? balancesFromSnapshotRow(snap)
    : { ...EMPTY_FINANCE_BALANCES };
  const next = applyTransferDelta(balances, account, delta);

  const payload: MonthlyFinanceSnapshotInsert = {
    user_id: userId,
    month_start: monthStart,
    langforsakringar: lfTotal(next),
  };
  for (const key of EDITABLE_FINANCE_KEYS) {
    payload[key] = next[key];
  }

  const { error } = await supabase
    .from("monthly_finance_snapshots")
    .upsert(payload, { onConflict: "user_id,month_start" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Toggle the done state for a monthly task on a given month. Optionally stores
 * a free-text comment. When `note` is omitted on completion any existing
 * comment is preserved; uncompleting always clears it.
 */
export async function toggleMonthlyTaskDoneAction(input: {
  taskId: string;
  monthStart: string;
  done: boolean;
  note?: string;
  amount?: number;
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

  const { data: task } = await supabase
    .from("monthly_tasks")
    .select("completion_kind, key, day_of_month, single_month_start")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };

  const { data: existing } = await supabase
    .from("monthly_task_completions")
    .select(
      "id, amount, scheduled_day_of_month, scheduled_week_start, is_unscheduled",
    )
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("month_start", input.monthStart)
    .maybeSingle();

  const autoScheduleOnDone = (): {
    scheduled_day_of_month: number;
    scheduled_week_start: string;
    is_unscheduled: boolean;
  } | null => {
    if (!input.done) return null;
    if (task.day_of_month != null) return null;
    if (existing?.scheduled_day_of_month != null) return null;
    if (existing?.is_unscheduled) return null;

    const today = todayLocalISO();
    if (monthStartFromDate(today) !== input.monthStart) return null;

    const dayOfMonth = Number(today.slice(8, 10));
    return {
      scheduled_day_of_month: dayOfMonth,
      scheduled_week_start: weekStartISO(parseLocalISO(today)),
      is_unscheduled: false,
    };
  };

  const schedulePatch = autoScheduleOnDone();

  let amountValue: number | null = null;
  if (task.completion_kind === "amount" && input.done) {
    if (input.amount == null || !Number.isFinite(input.amount)) {
      return { ok: false, error: "Ange ett belopp." };
    }
    amountValue = Math.round(input.amount * 100) / 100;
  } else if (
    input.done &&
    input.amount != null &&
    Number.isFinite(input.amount)
  ) {
    amountValue = Math.round(input.amount * 100) / 100;
  }

  const previousAmount =
    existing?.amount != null ? Number(existing.amount) : null;
  const transferAccount =
    task.key != null ? TRANSFER_TASK_ACCOUNT[task.key] : undefined;

  const doneAt = input.done ? new Date().toISOString() : null;
  const trimmedNote = (input.note ?? "").trim();
  const noteValue = input.done ? trimmedNote.slice(0, 500) || null : null;
  const setNote = input.done ? input.note !== undefined : true;

  if (existing) {
    const patch: {
      done_at: string | null;
      note?: string | null;
      amount?: number | null;
      scheduled_day_of_month?: number;
      scheduled_week_start?: string;
      is_unscheduled?: boolean;
    } = {
      done_at: doneAt,
    };
    if (setNote) patch.note = noteValue;
    if (task.completion_kind === "amount") {
      patch.amount = input.done ? amountValue : null;
    } else if (amountValue != null) {
      patch.amount = amountValue;
    }
    if (schedulePatch) {
      patch.scheduled_day_of_month = schedulePatch.scheduled_day_of_month;
      patch.scheduled_week_start = schedulePatch.scheduled_week_start;
      patch.is_unscheduled = schedulePatch.is_unscheduled;
    }
    const { error } = await supabase
      .from("monthly_task_completions")
      .update(patch)
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("monthly_task_completions").insert({
      user_id: user.id,
      task_id: input.taskId,
      month_start: input.monthStart,
      done_at: doneAt,
      note: noteValue,
      amount:
        task.completion_kind === "amount"
          ? amountValue
          : amountValue ?? null,
      ...(schedulePatch ?? {}),
    });
    if (error) return { ok: false, error: error.message };
  }

  if (
    task.completion_kind === "amount" &&
    transferAccount &&
    (input.done ? amountValue != null : previousAmount != null)
  ) {
    const delta = input.done
      ? (amountValue ?? 0)
      : -(previousAmount ?? 0);
    const syncRes = await syncTransferToFinanceSnapshot(
      supabase,
      user.id,
      input.monthStart,
      transferAccount,
      delta,
    );
    if (!syncRes.ok) return syncRes;
  }

  // One-off monthly tasks (single_month_start set) are kept once done so they
  // stay in the plan as a checked-off row and are recorded in the diary.

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveMonthlyFinanceAction(input: {
  taskId: string;
  monthStart: string;
  balances: MonthlyFinanceBalances;
  note?: string;
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

  const { data: task } = await supabase
    .from("monthly_tasks")
    .select("completion_kind")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task || task.completion_kind !== "finance") {
    return { ok: false, error: "Invalid finance task." };
  }

  const snapshotPayload: MonthlyFinanceSnapshotInsert = {
    user_id: user.id,
    month_start: input.monthStart,
    note: input.note?.trim().slice(0, 500) || null,
    done_at: input.done ? new Date().toISOString() : null,
    langforsakringar: lfTotal(input.balances),
  };

  for (const key of EDITABLE_FINANCE_KEYS) {
    const raw = input.balances[key];
    snapshotPayload[key] =
      raw != null && Number.isFinite(raw) ? Math.round(raw * 100) / 100 : null;
  }

  const { error: snapError } = await supabase
    .from("monthly_finance_snapshots")
    .upsert(snapshotPayload, { onConflict: "user_id,month_start" });
  if (snapError) return { ok: false, error: snapError.message };

  if (input.done) {
    const total = financeTotal(input.balances);
    const toggleRes = await toggleMonthlyTaskDoneAction({
      taskId: input.taskId,
      monthStart: input.monthStart,
      done: true,
      note: `Totalt ${total.toLocaleString("sv-SE")} kr`,
    });
    if (!toggleRes.ok) return toggleRes;
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Backfill: amount-tasks with a saved amount should count as done. */
export async function repairAmountCompletionsMissingDone(
  userId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: amountTasks } = await supabase
    .from("monthly_tasks")
    .select("id, key")
    .eq("user_id", userId)
    .eq("completion_kind", "amount")
    .is("archived_at", null);

  const amountTaskIds = (amountTasks ?? []).map((t) => t.id);
  if (amountTaskIds.length === 0) return;

  const { data: rows } = await supabase
    .from("monthly_task_completions")
    .select("id, task_id, month_start, amount")
    .eq("user_id", userId)
    .is("done_at", null)
    .not("amount", "is", null)
    .in("task_id", amountTaskIds);

  for (const row of rows ?? []) {
    if (row.amount == null || !Number.isFinite(Number(row.amount))) continue;
    await toggleMonthlyTaskDoneAction({
      taskId: row.task_id,
      monthStart: row.month_start,
      done: true,
      amount: Number(row.amount),
    });
  }
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

/**
 * Attach (or detach) a shared 'task' category to an existing weekly task.
 */
export async function setWeeklyTaskCategoryAction(input: {
  taskId: string;
  categoryId: string | null;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.categoryId) {
    const err = await validateCategoryScope(
      supabase,
      user.id,
      input.categoryId,
      "task",
    );
    if (err) return { ok: false, error: err };
  }

  const { error } = await supabase
    .from("weekly_tasks")
    .update({ category_id: input.categoryId })
    .eq("id", input.taskId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Attach (or detach) a shared 'task' category to an existing monthly task.
 */
export async function setMonthlyTaskCategoryAction(input: {
  taskId: string;
  categoryId: string | null;
}): Promise<ActionResult> {
  if (!input.taskId) return { ok: false, error: "Missing task id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.categoryId) {
    const err = await validateCategoryScope(
      supabase,
      user.id,
      input.categoryId,
      "task",
    );
    if (err) return { ok: false, error: err };
  }

  const { error } = await supabase
    .from("monthly_tasks")
    .update({ category_id: input.categoryId })
    .eq("id", input.taskId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
