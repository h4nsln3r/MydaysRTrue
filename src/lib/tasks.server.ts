import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, isoWeekdayFromLocalISO, parseLocalISO, weekStartISO } from "@/lib/date";
import {
  dedupeMonthlyTasks,
  monthlyTaskKeeperScore,
  type MonthlyCompletion,
  type MonthlyTask,
  type MonthlyTaskCompletionKind,
  type MonthlyTaskForMonth,
  type TaskCategory,
  type TaskScope,
  type Weekday,
  type WeeklyPlacement,
  type WeeklyTask,
  type WeeklyTaskChecklistItem,
  type WeeklyTaskForWeek,
  type MusicBand,
} from "@/lib/tasks";
import {
  balancesFromSnapshotRow,
  SAVINGS_TRANSFER_TASKS,
  type MonthlyFinanceBalances,
  type MonthlyFinanceSnapshot,
} from "@/lib/monthly-finance";
import {
  effectiveScheduledDay,
  monthStartFromDate,
  monthlyTasksOnLocalDate,
} from "@/lib/monthly-bills";
import { repairAmountCompletionsMissingDone } from "@/app/(app)/tasks-actions";

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
  key: string | null;
  title: string;
  notes: string | null;
  icon: string;
  accent: string;
  sort_order: number;
  default_weekday: number | null;
  completion_kind: string;
  single_week_start: string | null;
  enabled: boolean;
}

function rowToWeekly(r: WeeklyTaskRow): WeeklyTask {
  return {
    id: r.id,
    categoryId: r.category_id,
    key: r.key,
    title: r.title,
    notes: r.notes,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    completionKind: r.completion_kind as WeeklyTask["completionKind"],
    defaultWeekday: r.default_weekday as Weekday | null,
    singleWeekStart: r.single_week_start,
    enabled: r.enabled ?? true,
  };
}

function isActiveWeeklyRow(r: WeeklyTaskRow): boolean {
  return r.single_week_start != null || (r.enabled ?? true);
}

interface WeeklyPlacementRow {
  id: string;
  task_id: string;
  week_start: string;
  weekday: number | null;
  day_sort_order: number;
  done_at: string | null;
  plan_note: string | null;
  note: string | null;
  shop_location: string | null;
  shop_amount: number | null;
  laundry_loads: number | null;
  band: string | null;
}

function rowToPlacement(r: WeeklyPlacementRow): WeeklyPlacement {
  return {
    id: r.id,
    taskId: r.task_id,
    weekStart: r.week_start,
    weekday: r.weekday as Weekday | null,
    daySortOrder: r.day_sort_order ?? 0,
    doneAt: r.done_at,
    planNote: r.plan_note,
    note: r.note,
    shopLocation: r.shop_location,
    shopAmount: r.shop_amount != null ? Number(r.shop_amount) : null,
    laundryLoads: r.laundry_loads,
    band: (r.band as MusicBand | null) ?? null,
  };
}

interface ChecklistRow {
  id: string;
  task_id: string;
  text: string;
  done_at: string | null;
  sort_order: number;
}

function rowToChecklistItem(r: ChecklistRow): WeeklyTaskChecklistItem {
  return {
    id: r.id,
    taskId: r.task_id,
    text: r.text,
    doneAt: r.done_at,
    sortOrder: r.sort_order,
  };
}

const WEEKLY_TASK_SELECT =
  "id, category_id, key, title, notes, icon, accent, sort_order, default_weekday, completion_kind, single_week_start, enabled";

const WEEKLY_PLACEMENT_SELECT =
  "id, task_id, week_start, weekday, day_sort_order, done_at, plan_note, note, shop_location, shop_amount, laundry_loads, band";

const CHECKLIST_SELECT = "id, task_id, text, done_at, sort_order";

export async function getWeeklyTasks(userId: string): Promise<WeeklyTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_tasks")
    .select(WEEKLY_TASK_SELECT)
    .eq("user_id", userId)
    .is("archived_at", null)
    // Exclude one-off (single-week) tasks from the permanent template list.
    .is("single_week_start", null)
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
  const [tasksRes, placementsRes, catsRes, checklistRes] = await Promise.all([
    supabase
      .from("weekly_tasks")
      .select(WEEKLY_TASK_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      // Permanent templates (single_week_start null) plus one-offs for THIS week.
      .or(`single_week_start.is.null,single_week_start.eq.${weekStart}`)
      .order("sort_order", { ascending: true }),
    supabase
      .from("weekly_task_placements")
      .select(WEEKLY_PLACEMENT_SELECT)
      .eq("user_id", userId)
      .eq("week_start", weekStart),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order")
      .eq("user_id", userId)
      .eq("scope", "task")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("weekly_task_checklist_items")
      .select(CHECKLIST_SELECT)
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
  ]);

  const placements = new Map<string, WeeklyPlacement>();
  for (const row of placementsRes.data ?? []) {
    placements.set(row.task_id, rowToPlacement(row));
  }

  const checklistByTask = new Map<string, WeeklyTaskChecklistItem[]>();
  for (const row of checklistRes.data ?? []) {
    const list = checklistByTask.get(row.task_id) ?? [];
    list.push(rowToChecklistItem(row));
    checklistByTask.set(row.task_id, list);
  }

  const dayOrderCursor = new Map<number, number>();
  for (const p of placements.values()) {
    if (p.weekday != null) {
      const next = Math.max(dayOrderCursor.get(p.weekday) ?? -1, p.daySortOrder) + 1;
      dayOrderCursor.set(p.weekday, next);
    }
  }

  const toInsert: {
    user_id: string;
    task_id: string;
    week_start: string;
    weekday: number | null;
    day_sort_order: number;
  }[] = [];

  for (const row of tasksRes.data ?? []) {
    if (!isActiveWeeklyRow(row)) continue;
    if (!placements.has(row.id)) {
      const wd = row.default_weekday;
      let daySortOrder = 0;
      if (wd != null) {
        daySortOrder = dayOrderCursor.get(wd) ?? 0;
        dayOrderCursor.set(wd, daySortOrder + 1);
      }
      toInsert.push({
        user_id: userId,
        task_id: row.id,
        week_start: weekStart,
        weekday: wd,
        day_sort_order: daySortOrder,
      });
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("weekly_task_placements")
      .insert(toInsert)
      .select(WEEKLY_PLACEMENT_SELECT);
    for (const row of inserted ?? []) {
      placements.set(row.task_id, rowToPlacement(row));
    }
  }

  const tasks: WeeklyTaskForWeek[] = (tasksRes.data ?? [])
    .filter(isActiveWeeklyRow)
    .map((row) => ({
    ...rowToWeekly(row),
    placement: placements.get(row.id) ?? null,
    checklist: checklistByTask.get(row.id) ?? [],
  }));

  const categories = (catsRes.data ?? []).map(rowToCategory);
  return { weekStart, tasks, categories };
}

export interface WeeklyTasksDaySummary {
  localDate: string;
  weekStart: string;
  weekday: Weekday;
  tasks: WeeklyTaskForWeek[];
  /** All tasks in the ISO week (for journal / done-on-day lookup). */
  weekTasks: WeeklyTaskForWeek[];
  categories: TaskCategory[];
}

/** Weekly tasks placed on the weekday of `localDate` (within that ISO week). */
export async function getWeeklyTasksForDate(
  userId: string,
  localDate: string,
): Promise<WeeklyTasksDaySummary> {
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  const { tasks, categories } = await getWeekSummary(userId, weekStart);
  const forDay = tasks
    .filter(
      (t) => t.placement?.weekday != null && t.placement.weekday === weekday,
    )
    .sort((a, b) => {
      const ao = a.placement?.daySortOrder ?? a.sortOrder;
      const bo = b.placement?.daySortOrder ?? b.sortOrder;
      return ao - bo;
    });
  return { localDate, weekStart, weekday, tasks: forDay, weekTasks: tasks, categories };
}

export interface MonthlyTasksDaySummary {
  localDate: string;
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
}

/** Monthly tasks scheduled on the calendar day of `localDate`. */
export async function getMonthlyTasksForDate(
  userId: string,
  localDate: string,
): Promise<MonthlyTasksDaySummary> {
  const monthStart = monthStartFromDate(localDate);
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const [monthSummary, billsWeek] = await Promise.all([
    getMonthTaskSummary(userId, monthStart),
    getMonthlyBillsForWeek(userId, weekStart),
  ]);

  const tasksById = new Map(monthSummary.tasks.map((t) => [t.id, t]));
  for (const task of billsWeek.tasks) {
    if (!tasksById.has(task.id)) tasksById.set(task.id, task);
  }

  const mergedTasks = [...tasksById.values()].map((task) => ({
    ...task,
    completion:
      billsWeek.completionsByTaskMonth.get(`${task.id}|${monthStart}`) ??
      task.completion ??
      null,
  }));

  const forDay = monthlyTasksOnLocalDate(
    mergedTasks,
    localDate,
    billsWeek.completionsByTaskMonth,
    { includeWhenDone: true },
  );

  return { localDate, monthStart, tasks: forDay, categories: monthSummary.categories };
}

// ----------------------------------------------------------------------------
// Monthly tasks
// ----------------------------------------------------------------------------

interface MonthlyTaskRow {
  id: string;
  category_id: string | null;
  key: string | null;
  title: string;
  notes: string | null;
  day_of_month: number | null;
  icon: string;
  accent: string;
  sort_order: number;
  completion_kind: string;
  single_month_start: string | null;
  default_amount_kr: number | null;
  enabled: boolean;
}

function rowToMonthly(r: MonthlyTaskRow): MonthlyTask {
  return {
    id: r.id,
    categoryId: r.category_id,
    key: r.key,
    title: r.title,
    notes: r.notes,
    dayOfMonth: r.day_of_month,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    completionKind: r.completion_kind as MonthlyTaskCompletionKind,
    singleMonthStart: r.single_month_start,
    defaultAmountKr:
      r.default_amount_kr != null ? Number(r.default_amount_kr) : null,
    enabled: r.enabled ?? true,
  };
}

function isActiveMonthlyRow(r: MonthlyTaskRow): boolean {
  return r.single_month_start != null || (r.enabled ?? true);
}

interface MonthlyCompletionRow {
  id: string;
  task_id: string;
  month_start: string;
  done_at: string | null;
  note: string | null;
  amount: number | null;
  scheduled_day_of_month: number | null;
  scheduled_week_start: string | null;
  is_unscheduled: boolean;
  day_sort_order: number;
}

function rowToCompletion(r: MonthlyCompletionRow): MonthlyCompletion {
  return {
    id: r.id,
    taskId: r.task_id,
    monthStart: r.month_start,
    doneAt: r.done_at,
    note: r.note,
    amount: r.amount != null ? Number(r.amount) : null,
    scheduledDayOfMonth: r.scheduled_day_of_month,
    scheduledWeekStart: r.scheduled_week_start,
    isUnscheduled: r.is_unscheduled,
    daySortOrder: r.day_sort_order ?? 0,
  };
}

const MONTHLY_TASK_SELECT =
  "id, category_id, key, title, notes, day_of_month, icon, accent, sort_order, completion_kind, single_month_start, default_amount_kr, enabled";

const MONTHLY_COMPLETION_SELECT =
  "id, task_id, month_start, done_at, note, amount, scheduled_day_of_month, scheduled_week_start, is_unscheduled, day_sort_order";

interface MonthlyTaskDedupeRow {
  id: string;
  title: string;
  key: string | null;
  category_id: string | null;
  single_month_start: string | null;
  sort_order: number;
}

/** Archive duplicate monthly tasks that share the same title (keeps seeded/categorized). */
async function repairDuplicateMonthlyTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("monthly_tasks")
    .select("id, title, key, category_id, single_month_start, sort_order")
    .eq("user_id", userId)
    .is("archived_at", null);

  if (!data?.length) return;

  const toArchive = new Set<string>();

  const byKey = new Map<string, MonthlyTaskDedupeRow[]>();
  for (const row of data) {
    if (!row.key) continue;
    const list = byKey.get(row.key) ?? [];
    list.push(row);
    byKey.set(row.key, list);
  }
  for (const list of byKey.values()) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const scoreA = monthlyTaskKeeperScore({
        key: a.key,
        categoryId: a.category_id,
        singleMonthStart: a.single_month_start,
        sortOrder: a.sort_order,
      });
      const scoreB = monthlyTaskKeeperScore({
        key: b.key,
        categoryId: b.category_id,
        singleMonthStart: b.single_month_start,
        sortOrder: b.sort_order,
      });
      return scoreB - scoreA;
    });
    for (const loser of sorted.slice(1)) {
      toArchive.add(loser.id);
    }
  }

  const groups = new Map<string, MonthlyTaskDedupeRow[]>();
  for (const row of data) {
    if (row.key && toArchive.has(row.id)) continue;
    const norm = row.title.trim().toLowerCase();
    const list = groups.get(norm) ?? [];
    list.push(row);
    groups.set(norm, list);
  }

  for (const list of groups.values()) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const scoreA = monthlyTaskKeeperScore({
        key: a.key,
        categoryId: a.category_id,
        singleMonthStart: a.single_month_start,
        sortOrder: a.sort_order,
      });
      const scoreB = monthlyTaskKeeperScore({
        key: b.key,
        categoryId: b.category_id,
        singleMonthStart: b.single_month_start,
        sortOrder: b.sort_order,
      });
      return scoreB - scoreA;
    });
    for (const loser of sorted.slice(1)) {
      toArchive.add(loser.id);
    }
  }

  if (toArchive.size === 0) return;

  await supabase
    .from("monthly_tasks")
    .update({ archived_at: new Date().toISOString() })
    .in("id", [...toArchive])
    .eq("user_id", userId);
}

/** Keep seeded savings transfer titles/notes in sync (e.g. SBAB spar rename). */
async function repairMonthlySavingsTaskLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  for (const [key, meta] of Object.entries(SAVINGS_TRANSFER_TASKS)) {
    await supabase
      .from("monthly_tasks")
      .update({ title: meta.title, notes: meta.notes })
      .eq("user_id", userId)
      .eq("key", key);
  }
}

export async function getMonthlyTasks(userId: string): Promise<MonthlyTask[]> {
  const supabase = await createClient();
  await repairDuplicateMonthlyTasks(supabase, userId);
  await repairMonthlySavingsTaskLabels(supabase, userId);
  const { data } = await supabase
    .from("monthly_tasks")
    .select(MONTHLY_TASK_SELECT)
    .eq("user_id", userId)
    .is("archived_at", null)
    .is("single_month_start", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToMonthly);
}

export interface MonthSummaryTasks {
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
  financeSnapshot: MonthlyFinanceSnapshot | null;
}

interface FinanceSnapshotRow {
  month_start: string;
  langforsakringar: number | null;
  kort: number | null;
  spar: number | null;
  isk: number | null;
  sbab_spar: number | null;
  avanza: number | null;
  krypto: number | null;
  cash: number | null;
  note: string | null;
  done_at: string | null;
}

function rowToFinanceSnapshot(r: FinanceSnapshotRow): MonthlyFinanceSnapshot {
  return {
    monthStart: r.month_start,
    balances: balancesFromSnapshotRow(r),
    note: r.note,
    doneAt: r.done_at,
  };
}

export async function getMonthFinanceSnapshot(
  userId: string,
  monthStart: string,
): Promise<MonthlyFinanceSnapshot | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_finance_snapshots")
    .select(
      "month_start, langforsakringar, kort, spar, isk, sbab_spar, avanza, krypto, cash, note, done_at",
    )
    .eq("user_id", userId)
    .eq("month_start", monthStart)
    .maybeSingle();
  return data ? rowToFinanceSnapshot(data) : null;
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
  await repairDuplicateMonthlyTasks(supabase, userId);
  await repairMonthlySavingsTaskLabels(supabase, userId);
  await repairAmountCompletionsMissingDone(userId);
  const [tasksRes, completionsRes, catsRes, financeRes] = await Promise.all([
    supabase
      .from("monthly_tasks")
      .select(MONTHLY_TASK_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      .or(`single_month_start.is.null,single_month_start.eq.${monthStart}`)
      .order("sort_order", { ascending: true }),
    supabase
      .from("monthly_task_completions")
      .select(MONTHLY_COMPLETION_SELECT)
      .eq("user_id", userId)
      .eq("month_start", monthStart),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order")
      .eq("user_id", userId)
      .eq("scope", "task")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("monthly_finance_snapshots")
      .select(
        "month_start, langforsakringar, kort, spar, isk, sbab_spar, avanza, krypto, cash, note, done_at",
      )
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .maybeSingle(),
  ]);

  const compMap = new Map<string, MonthlyCompletion>();
  for (const row of completionsRes.data ?? []) {
    compMap.set(row.task_id, rowToCompletion(row));
  }

  const tasks: MonthlyTaskForMonth[] = dedupeMonthlyTasks(
    (tasksRes.data ?? [])
      .filter(isActiveMonthlyRow)
      .map((row) => ({
        ...rowToMonthly(row),
        completion: compMap.get(row.id) ?? null,
      })),
  );

  const categories = (catsRes.data ?? []).map(rowToCategory);
  const financeSnapshot = financeRes.data
    ? rowToFinanceSnapshot(financeRes.data)
    : null;
  return { monthStart, tasks, categories, financeSnapshot };
}

export interface MonthlyBillsWeekContext {
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
  completionsByTaskMonth: Map<string, MonthlyCompletion>;
}

/** Monthly bills + completions for all months touched by an ISO week. */
export async function getMonthlyBillsForWeek(
  userId: string,
  weekStart: string,
): Promise<MonthlyBillsWeekContext> {
  const supabase = await createClient();
  await repairDuplicateMonthlyTasks(supabase, userId);
  await repairMonthlySavingsTaskLabels(supabase, userId);
  await repairAmountCompletionsMissingDone(userId);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const monthStarts = [...new Set(weekDates.map((d) => `${d.slice(0, 7)}-01`))];
  const oneOffFilter = monthStarts.map((m) => `single_month_start.eq.${m}`).join(",");
  const taskOrFilter = oneOffFilter
    ? `single_month_start.is.null,${oneOffFilter}`
    : "single_month_start.is.null";

  const [tasksRes, catsRes, completionsRes] = await Promise.all([
    supabase
      .from("monthly_tasks")
      .select(MONTHLY_TASK_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      .or(taskOrFilter)
      .order("sort_order", { ascending: true }),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order")
      .eq("user_id", userId)
      .eq("scope", "task")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("monthly_task_completions")
      .select(MONTHLY_COMPLETION_SELECT)
      .eq("user_id", userId)
      .in("month_start", monthStarts),
  ]);

  const completionsByTaskMonth = new Map<string, MonthlyCompletion>();
  for (const row of completionsRes.data ?? []) {
    const c = rowToCompletion(row);
    completionsByTaskMonth.set(`${c.taskId}|${c.monthStart}`, c);
  }

  const categories = (catsRes.data ?? []).map(rowToCategory);
  const tasks: MonthlyTaskForMonth[] = dedupeMonthlyTasks(
    (tasksRes.data ?? [])
      .filter(isActiveMonthlyRow)
      .map((row) => ({
        ...rowToMonthly(row),
        completion: null,
      })),
  );

  return {
    tasks,
    categories,
    completionsByTaskMonth,
  };
}
