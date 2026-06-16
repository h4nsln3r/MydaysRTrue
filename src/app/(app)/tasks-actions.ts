"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/date";
import { monthStartFromDate } from "@/lib/monthly-bills";
import type { Database } from "@/lib/supabase/database.types";
import {
  isHexColor,
  isMusicRepTask,
  MUSIC_BANDS,
  type MusicBand,
  type TaskScope,
  type Weekday,
  type WeeklyTaskCompletionKind,
} from "@/lib/tasks";

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

  if (kind === "shop") {
    if (!shopLocation) {
      return { ok: false, error: "Ange var du handlade." };
    }
    const amount = input.shopAmount;
    if (amount == null || !Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: "Ange hur mycket du handlade för." };
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
  } else if (note) {
    completionNote = note.slice(0, 500);
  }

  const { error } = await supabase
    .from("weekly_task_placements")
    .update({
      done_at: new Date().toISOString(),
      plan_note: planNote || null,
      note: completionNote,
      shop_location: kind === "shop" ? shopLocation : null,
      shop_amount: shopAmount,
      laundry_loads: laundryLoads,
      band: kind === "music" ? band : null,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
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

  const { error } = await supabase
    .from("weekly_task_placements")
    .update({
      done_at: null,
      note: null,
      shop_location: null,
      shop_amount: null,
      laundry_loads: null,
      band: null,
    })
    .eq("user_id", user.id)
    .eq("task_id", input.taskId)
    .eq("week_start", input.weekStart);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
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

export async function toggleWeeklyTaskChecklistItemAction(input: {
  itemId: string;
  done: boolean;
}): Promise<ActionResult> {
  if (!input.itemId) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("weekly_task_checklist_items")
    .update({ done_at: input.done ? new Date().toISOString() : null })
    .eq("id", input.itemId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

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

async function upsertMonthlyBillSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  taskId: string,
  monthStart: string,
  scheduledDayOfMonth: number | null,
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
      true,
    );
  }

  return upsertMonthlyBillSchedule(
    supabase,
    user.id,
    input.taskId,
    input.monthStart,
    input.dayOfMonth,
    false,
  );
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

  return upsertMonthlyBillSchedule(
    supabase,
    user.id,
    input.taskId,
    monthStart,
    dayOfMonth,
    false,
  );
}

/** Move a monthly bill back to the backlog for a month. */
export async function unplaceMonthlyBillFromWeekAction(input: {
  taskId: string;
  monthStart: string;
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

  return upsertMonthlyBillSchedule(
    supabase,
    user.id,
    input.taskId,
    input.monthStart,
    null,
    true,
  );
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
