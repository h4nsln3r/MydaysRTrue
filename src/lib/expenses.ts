import { formatKr, shopAmountExprHasBreakdown } from "@/lib/monthly-finance";
import type {
  MonthlyTaskForMonth,
  TaskCategory,
  WeeklyTaskForWeek,
} from "@/lib/tasks";
import { expandWeeklyTaskPlacements } from "@/lib/tasks";

export const UTGIFTER_CATEGORY_NAME = "Utgifter";

/** Categories that belong on the month tab (not week goals). */
export const MONTHLY_TASK_CATEGORY_NAMES = [
  "Ekonomi",
  "Utgifter",
  "Sparande",
  "Räkningar",
] as const;

export type MonthlyTaskCategoryName =
  (typeof MONTHLY_TASK_CATEGORY_NAMES)[number];

export function isMonthlyTaskCategoryName(
  name: string | null | undefined,
): name is MonthlyTaskCategoryName {
  return (
    name != null &&
    (MONTHLY_TASK_CATEGORY_NAMES as readonly string[]).includes(name)
  );
}

export function isUtgifterCategory(
  category: Pick<TaskCategory, "name"> | null | undefined,
): boolean {
  return category?.name === UTGIFTER_CATEGORY_NAME;
}

export function isExpenseWeeklyKind(
  kind: WeeklyTaskForWeek["completionKind"],
): boolean {
  return kind === "expense" || kind === "shop";
}

export interface ExpenseEntry {
  id: string;
  title: string;
  description: string;
  amountKr: number;
  /** Raw sum expression when more than a single number. */
  amountExpr: string | null;
  doneAt: string;
  localDate: string;
  scope: "weekly" | "monthly";
  icon: string;
  accent: string;
  note: string | null;
}

export interface ExpenseSummary {
  totalKr: number;
  entries: ExpenseEntry[];
}

function categoryMap(categories: TaskCategory[]): Map<string, TaskCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}

function isTrackedWeeklyExpense(
  task: WeeklyTaskForWeek,
  categories: Map<string, TaskCategory>,
): boolean {
  const cat = task.categoryId ? categories.get(task.categoryId) : null;
  return (
    task.completionKind === "expense" ||
    (isExpenseWeeklyKind(task.completionKind) && isUtgifterCategory(cat))
  );
}

/** Handla / grocery shop tasks — separate from Utgifter. */
function isTrackedWeeklyShopping(
  task: WeeklyTaskForWeek,
  categories: Map<string, TaskCategory>,
): boolean {
  if (task.completionKind !== "shop") return false;
  const cat = task.categoryId ? categories.get(task.categoryId) : null;
  return !isUtgifterCategory(cat);
}

function isTrackedMonthlyExpense(
  task: MonthlyTaskForMonth,
  categories: Map<string, TaskCategory>,
): boolean {
  const cat = task.categoryId ? categories.get(task.categoryId) : null;
  return (
    task.completionKind === "amount" && isUtgifterCategory(cat)
  );
}

function shopExprForEntry(expr: string | null | undefined): string | null {
  const trimmed = expr?.trim() || null;
  return trimmed && shopAmountExprHasBreakdown(trimmed) ? trimmed : null;
}

function summarizeEntries(entries: ExpenseEntry[]): ExpenseSummary {
  entries.sort(
    (a, b) => new Date(a.doneAt).getTime() - new Date(b.doneAt).getTime(),
  );
  const totalKr = entries.reduce((sum, e) => sum + e.amountKr, 0);
  return { totalKr, entries };
}

export function collectWeekExpenses(
  tasks: WeeklyTaskForWeek[],
  categories: TaskCategory[],
): ExpenseSummary {
  const cats = categoryMap(categories);
  const entries: ExpenseEntry[] = [];

  for (const task of expandWeeklyTaskPlacements(tasks)) {
    if (!isTrackedWeeklyExpense(task, cats)) continue;
    const placement = task.placement;
    if (!placement?.doneAt || placement.shopAmount == null) continue;

    const description =
      placement.shopLocation?.trim() ||
      placement.note?.trim() ||
      task.title;

    entries.push({
      id: placement.id,
      title: task.title,
      description,
      amountKr: placement.shopAmount,
      amountExpr: shopExprForEntry(placement.shopAmountExpr),
      doneAt: placement.doneAt,
      localDate: placement.doneAt.slice(0, 10),
      scope: "weekly",
      icon: task.icon,
      accent: task.accent,
      note: placement.note,
    });
  }

  return summarizeEntries(entries);
}

export function collectWeekShopping(
  tasks: WeeklyTaskForWeek[],
  categories: TaskCategory[],
): ExpenseSummary {
  const cats = categoryMap(categories);
  const entries: ExpenseEntry[] = [];

  for (const task of expandWeeklyTaskPlacements(tasks)) {
    if (!isTrackedWeeklyShopping(task, cats)) continue;
    const placement = task.placement;
    if (!placement?.doneAt || placement.shopAmount == null) continue;

    const description =
      placement.shopLocation?.trim() ||
      placement.note?.trim() ||
      task.title;

    entries.push({
      id: placement.id,
      title: task.title,
      description,
      amountKr: placement.shopAmount,
      amountExpr: shopExprForEntry(placement.shopAmountExpr),
      doneAt: placement.doneAt,
      localDate: placement.doneAt.slice(0, 10),
      scope: "weekly",
      icon: task.icon,
      accent: task.accent,
      note: placement.note,
    });
  }

  return summarizeEntries(entries);
}

export function collectMonthExpenses(input: {
  weeklyTasks: WeeklyTaskForWeek[];
  monthlyTasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
  monthStart: string;
}): ExpenseSummary {
  const cats = categoryMap(input.categories);
  const monthEnd = `${input.monthStart.slice(0, 7)}-31`;
  const entries: ExpenseEntry[] = [];

  for (const task of expandWeeklyTaskPlacements(input.weeklyTasks)) {
    if (!isTrackedWeeklyExpense(task, cats)) continue;
    const placement = task.placement;
    if (!placement?.doneAt || placement.shopAmount == null) continue;
    const localDate = placement.doneAt.slice(0, 10);
    if (localDate < input.monthStart || localDate > monthEnd) continue;

    const description =
      placement.shopLocation?.trim() ||
      placement.note?.trim() ||
      task.title;

    entries.push({
      id: `w-${placement.id}`,
      title: task.title,
      description,
      amountKr: placement.shopAmount,
      amountExpr: shopExprForEntry(placement.shopAmountExpr),
      doneAt: placement.doneAt,
      localDate,
      scope: "weekly",
      icon: task.icon,
      accent: task.accent,
      note: placement.note,
    });
  }

  for (const task of input.monthlyTasks) {
    if (!isTrackedMonthlyExpense(task, cats)) continue;
    const completion = task.completion;
    if (!completion?.doneAt || completion.amount == null) continue;

    const description =
      completion.note?.trim() || task.title;

    entries.push({
      id: `m-${completion.id}`,
      title: task.title,
      description,
      amountKr: completion.amount,
      amountExpr: null,
      doneAt: completion.doneAt,
      localDate: completion.doneAt.slice(0, 10),
      scope: "monthly",
      icon: task.icon,
      accent: task.accent,
      note: completion.note,
    });
  }

  return summarizeEntries(entries);
}

export function collectMonthShopping(input: {
  weeklyTasks: WeeklyTaskForWeek[];
  categories: TaskCategory[];
  monthStart: string;
}): ExpenseSummary {
  const cats = categoryMap(input.categories);
  const monthEnd = `${input.monthStart.slice(0, 7)}-31`;
  const entries: ExpenseEntry[] = [];

  for (const task of input.weeklyTasks) {
    if (!isTrackedWeeklyShopping(task, cats)) continue;
    const placement = task.placement;
    if (!placement?.doneAt || placement.shopAmount == null) continue;
    const localDate = placement.doneAt.slice(0, 10);
    if (localDate < input.monthStart || localDate > monthEnd) continue;

    const description =
      placement.shopLocation?.trim() ||
      placement.note?.trim() ||
      task.title;

    entries.push({
      id: `w-${placement.id}`,
      title: task.title,
      description,
      amountKr: placement.shopAmount,
      amountExpr: shopExprForEntry(placement.shopAmountExpr),
      doneAt: placement.doneAt,
      localDate,
      scope: "weekly",
      icon: task.icon,
      accent: task.accent,
      note: placement.note,
    });
  }

  return summarizeEntries(entries);
}

export function formatExpenseKr(amount: number): string {
  return formatKr(amount);
}
