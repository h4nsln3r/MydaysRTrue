import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  MonthlyCompletion,
  MonthlyTask,
  MonthlyTaskForMonth,
  TaskCategory,
  TaskScope,
  Weekday,
  WeeklyPlacement,
  WeeklyTask,
  WeeklyTaskForWeek,
} from "@/lib/tasks";

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  scope: TaskScope;
  name: string;
  icon: string;
  accent: string;
  sort_order: number;
}

function rowToCategory(r: CategoryRow): TaskCategory {
  return {
    id: r.id,
    scope: r.scope,
    name: r.name,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
  };
}

/** All active categories for the user, optionally filtered by scope. */
export async function getCategories(
  userId: string,
  scope?: TaskScope,
): Promise<TaskCategory[]> {
  const supabase = await createClient();
  let q = supabase
    .from("task_categories")
    .select("id, scope, name, icon, accent, sort_order")
    .eq("user_id", userId)
    .is("archived_at", null);
  if (scope) q = q.eq("scope", scope);
  q = q.order("scope", { ascending: true }).order("sort_order", { ascending: true });
  const { data } = await q;
  return (data ?? []).map(rowToCategory);
}

// ----------------------------------------------------------------------------
// Weekly tasks
// ----------------------------------------------------------------------------

interface WeeklyTaskRow {
  id: string;
  category_id: string | null;
  title: string;
  notes: string | null;
  icon: string;
  accent: string;
  sort_order: number;
  default_weekday: number | null;
}

function rowToWeekly(r: WeeklyTaskRow): WeeklyTask {
  return {
    id: r.id,
    categoryId: r.category_id,
    title: r.title,
    notes: r.notes,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    defaultWeekday: r.default_weekday as Weekday | null,
  };
}

interface WeeklyPlacementRow {
  id: string;
  task_id: string;
  week_start: string;
  weekday: number | null;
  done_at: string | null;
  note: string | null;
}

function rowToPlacement(r: WeeklyPlacementRow): WeeklyPlacement {
  return {
    id: r.id,
    taskId: r.task_id,
    weekStart: r.week_start,
    weekday: r.weekday as Weekday,
    doneAt: r.done_at,
    note: r.note,
  };
}

export async function getWeeklyTasks(userId: string): Promise<WeeklyTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_tasks")
    .select(
      "id, category_id, title, notes, icon, accent, sort_order, default_weekday",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToWeekly);
}

export interface WeekSummary {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  categories: TaskCategory[];
}

/**
 * Returns all of the user's active weekly tasks merged with their placement
 * for the given week. Tasks without a placement sit in the backlog.
 */
export async function getWeekSummary(
  userId: string,
  weekStart: string,
): Promise<WeekSummary> {
  const supabase = await createClient();
  const [tasksRes, placementsRes, catsRes] = await Promise.all([
    supabase
      .from("weekly_tasks")
      .select(
        "id, category_id, title, notes, icon, accent, sort_order, default_weekday",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("weekly_task_placements")
      .select("id, task_id, week_start, weekday, done_at, note")
      .eq("user_id", userId)
      .eq("week_start", weekStart),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order")
      .eq("user_id", userId)
      .eq("scope", "weekly")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  const placements = new Map<string, WeeklyPlacement>();
  for (const row of placementsRes.data ?? []) {
    placements.set(row.task_id, rowToPlacement(row));
  }

  const toInsert: {
    user_id: string;
    task_id: string;
    week_start: string;
    weekday: number;
  }[] = [];

  for (const row of tasksRes.data ?? []) {
    if (!placements.has(row.id) && row.default_weekday != null) {
      toInsert.push({
        user_id: userId,
        task_id: row.id,
        week_start: weekStart,
        weekday: row.default_weekday,
      });
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("weekly_task_placements")
      .insert(toInsert)
      .select("id, task_id, week_start, weekday, done_at, note");
    for (const row of inserted ?? []) {
      placements.set(row.task_id, rowToPlacement(row));
    }
  }

  const tasks: WeeklyTaskForWeek[] = (tasksRes.data ?? []).map((row) => {
    const raw = placements.get(row.id);
    return {
      ...rowToWeekly(row),
      placement: raw?.weekday != null ? raw : null,
    };
  });

  const categories = (catsRes.data ?? []).map(rowToCategory);
  return { weekStart, tasks, categories };
}

// ----------------------------------------------------------------------------
// Monthly tasks
// ----------------------------------------------------------------------------

interface MonthlyTaskRow {
  id: string;
  category_id: string | null;
  title: string;
  notes: string | null;
  day_of_month: number | null;
  icon: string;
  accent: string;
  sort_order: number;
}

function rowToMonthly(r: MonthlyTaskRow): MonthlyTask {
  return {
    id: r.id,
    categoryId: r.category_id,
    title: r.title,
    notes: r.notes,
    dayOfMonth: r.day_of_month,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
  };
}

interface MonthlyCompletionRow {
  id: string;
  task_id: string;
  month_start: string;
  done_at: string | null;
  note: string | null;
}

function rowToCompletion(r: MonthlyCompletionRow): MonthlyCompletion {
  return {
    id: r.id,
    taskId: r.task_id,
    monthStart: r.month_start,
    doneAt: r.done_at,
    note: r.note,
  };
}

export async function getMonthlyTasks(userId: string): Promise<MonthlyTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_tasks")
    .select(
      "id, category_id, title, notes, day_of_month, icon, accent, sort_order",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToMonthly);
}

export interface MonthSummaryTasks {
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
}

/**
 * Returns all active monthly tasks merged with their completion row for the
 * given month. Tasks without a row are "untouched" this month.
 */
export async function getMonthTaskSummary(
  userId: string,
  monthStart: string,
): Promise<MonthSummaryTasks> {
  const supabase = await createClient();
  const [tasksRes, completionsRes, catsRes] = await Promise.all([
    supabase
      .from("monthly_tasks")
      .select(
        "id, category_id, title, notes, day_of_month, icon, accent, sort_order",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("monthly_task_completions")
      .select("id, task_id, month_start, done_at, note")
      .eq("user_id", userId)
      .eq("month_start", monthStart),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order")
      .eq("user_id", userId)
      .eq("scope", "monthly")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  const compMap = new Map<string, MonthlyCompletion>();
  for (const row of completionsRes.data ?? []) {
    compMap.set(row.task_id, rowToCompletion(row));
  }

  const tasks: MonthlyTaskForMonth[] = (tasksRes.data ?? []).map((row) => ({
    ...rowToMonthly(row),
    completion: compMap.get(row.id) ?? null,
  }));

  const categories = (catsRes.data ?? []).map(rowToCategory);
  return { monthStart, tasks, categories };
}
