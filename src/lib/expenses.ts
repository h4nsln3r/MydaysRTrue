import { formatKr } from "@/lib/monthly-finance";
import type {
  MonthlyTaskForMonth,
  TaskCategory,
  WeeklyTaskForWeek,
} from "@/lib/tasks";

export const UTGIFTER_CATEGORY_NAME = "Utgifter";

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

function isTrackedMonthlyExpense(
  task: MonthlyTaskForMonth,
  categories: Map<string, TaskCategory>,
): boolean {
  const cat = task.categoryId ? categories.get(task.categoryId) : null;
  return (
    task.completionKind === "amount" && isUtgifterCategory(cat)
  );
}

export function collectWeekExpenses(
  tasks: WeeklyTaskForWeek[],
  categories: TaskCategory[],
): ExpenseSummary {
  const cats = categoryMap(categories);
  const entries: ExpenseEntry[] = [];

  for (const task of tasks) {
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
      doneAt: placement.doneAt,
      localDate: placement.doneAt.slice(0, 10),
      scope: "weekly",
      icon: task.icon,
      accent: task.accent,
      note: placement.note,
    });
  }

  entries.sort(
    (a, b) => new Date(a.doneAt).getTime() - new Date(b.doneAt).getTime(),
  );

  const totalKr = entries.reduce((sum, e) => sum + e.amountKr, 0);
  return { totalKr, entries };
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

  for (const task of input.weeklyTasks) {
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
      doneAt: completion.doneAt,
      localDate: completion.doneAt.slice(0, 10),
      scope: "monthly",
      icon: task.icon,
      accent: task.accent,
      note: completion.note,
    });
  }

  entries.sort(
    (a, b) => new Date(a.doneAt).getTime() - new Date(b.doneAt).getTime(),
  );

  const totalKr = entries.reduce((sum, e) => sum + e.amountKr, 0);
  return { totalKr, entries };
}

export function formatExpenseKr(amount: number): string {
  return formatKr(amount);
}
