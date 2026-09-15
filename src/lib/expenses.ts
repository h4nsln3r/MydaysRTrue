import { formatKr, shopAmountExprHasBreakdown } from "@/lib/monthly-finance";
import { localISOFromTimestamp } from "@/lib/date";
import type {
  MonthlyTaskForMonth,
  SpendKind,
  TaskCategory,
  WeeklyTaskForWeek,
} from "@/lib/tasks";
import { expandWeeklyTaskPlacements, SPEND_KIND_LABEL } from "@/lib/tasks";

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
  spendKind: SpendKind | null;
  /** Weekly shop/expense placements can be edited from week/month summaries. */
  editable: boolean;
  taskId: string | null;
  weekStart: string | null;
  placementId: string | null;
  completionKind: "shop" | "expense" | "amount";
  shopLocation: string | null;
  /** Typed sum to edit, e.g. "450" or "45+120". */
  shopAmountExpr: string;
}

export type SpendKindTotalKey = SpendKind | "unset";

export interface ExpenseSummary {
  totalKr: number;
  entries: ExpenseEntry[];
  totalsByKind: Record<SpendKindTotalKey, number>;
}

export const SPEND_KIND_TOTAL_ORDER: SpendKindTotalKey[] = [
  "food",
  "private",
  "shared",
  "unset",
];

export const SPEND_KIND_TOTAL_LABEL: Record<SpendKindTotalKey, string> = {
  ...SPEND_KIND_LABEL,
  unset: "Okategoriserat",
};

function emptyKindTotals(): Record<SpendKindTotalKey, number> {
  return { food: 0, private: 0, shared: 0, unset: 0 };
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

function weeklySpendEntry(
  task: WeeklyTaskForWeek,
  placement: NonNullable<WeeklyTaskForWeek["placement"]>,
  id: string,
): ExpenseEntry {
  const description =
    placement.shopLocation?.trim() ||
    placement.note?.trim() ||
    task.title;

  return {
    id,
    title: task.title,
    description,
    amountKr: placement.shopAmount ?? 0,
    amountExpr: shopExprForEntry(placement.shopAmountExpr),
    doneAt: placement.doneAt!,
    localDate: localISOFromTimestamp(placement.doneAt!),
    scope: "weekly",
    icon: task.icon,
    accent: task.accent,
    note: placement.note,
    spendKind: placement.spendKind,
    editable: true,
    taskId: task.id,
    weekStart: placement.weekStart,
    placementId: placement.id,
    completionKind: task.completionKind === "expense" ? "expense" : "shop",
    shopLocation: placement.shopLocation,
    shopAmountExpr:
      placement.shopAmountExpr?.trim() ||
      (placement.shopAmount != null ? String(placement.shopAmount) : ""),
  };
}

function summarizeEntries(entries: ExpenseEntry[]): ExpenseSummary {
  entries.sort(
    (a, b) => new Date(a.doneAt).getTime() - new Date(b.doneAt).getTime(),
  );
  const totalsByKind = emptyKindTotals();
  let totalKr = 0;
  for (const e of entries) {
    totalKr += e.amountKr;
    const key: SpendKindTotalKey = e.spendKind ?? "unset";
    totalsByKind[key] += e.amountKr;
  }
  return { totalKr, entries, totalsByKind };
}

export function mergeExpenseSummaries(
  ...summaries: ExpenseSummary[]
): ExpenseSummary {
  return summarizeEntries(summaries.flatMap((s) => s.entries));
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
    entries.push(weeklySpendEntry(task, placement, placement.id));
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
    entries.push(weeklySpendEntry(task, placement, placement.id));
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
    const localDate = localISOFromTimestamp(placement.doneAt);
    if (localDate < input.monthStart || localDate > monthEnd) continue;
    entries.push(weeklySpendEntry(task, placement, `w-${placement.id}`));
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
      localDate: localISOFromTimestamp(completion.doneAt),
      scope: "monthly",
      icon: task.icon,
      accent: task.accent,
      note: completion.note,
      spendKind: null,
      editable: false,
      taskId: task.id,
      weekStart: null,
      placementId: null,
      completionKind: "amount",
      shopLocation: null,
      shopAmountExpr: String(completion.amount),
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

  for (const task of expandWeeklyTaskPlacements(input.weeklyTasks)) {
    if (!isTrackedWeeklyShopping(task, cats)) continue;
    const placement = task.placement;
    if (!placement?.doneAt || placement.shopAmount == null) continue;
    const localDate = localISOFromTimestamp(placement.doneAt);
    if (localDate < input.monthStart || localDate > monthEnd) continue;
    entries.push(weeklySpendEntry(task, placement, `w-${placement.id}`));
  }

  return summarizeEntries(entries);
}

export function formatExpenseKr(amount: number): string {
  return formatKr(amount);
}
