import "server-only";
import { addDaysISO, weekStartISO, parseLocalISO } from "@/lib/date";
import {
  collectMonthExpenses,
  collectMonthShopping,
  type ExpenseSummary,
} from "@/lib/expenses";
import { getCategories, getMonthTaskSummary, getWeekSummary } from "@/lib/tasks.server";

export interface MonthSpendSummaries {
  expenses: ExpenseSummary;
  shopping: ExpenseSummary;
}

/** All logged expenses + grocery shopping in a calendar month. */
export async function getMonthSpendSummaries(
  userId: string,
  monthStart: string,
): Promise<MonthSpendSummaries> {
  const monthEnd = `${monthStart.slice(0, 7)}-31`;
  const firstWeek = weekStartISO(parseLocalISO(monthStart));
  const lastWeek = weekStartISO(parseLocalISO(monthEnd));

  const weekStarts: string[] = [];
  for (let ws = firstWeek; ws <= lastWeek; ws = addDaysISO(ws, 7)) {
    weekStarts.push(ws);
  }

  const [categories, monthTasks, ...weekSummaries] = await Promise.all([
    getCategories(userId, "task"),
    getMonthTaskSummary(userId, monthStart),
    ...weekStarts.map((ws) => getWeekSummary(userId, ws)),
  ]);

  const weeklyTasks = weekSummaries.flatMap((w) => w.tasks);
  const shared = {
    weeklyTasks,
    categories,
    monthStart,
  };

  return {
    expenses: collectMonthExpenses({
      ...shared,
      monthlyTasks: monthTasks.tasks,
    }),
    shopping: collectMonthShopping(shared),
  };
}

/** @deprecated Prefer getMonthSpendSummaries — kept for call sites that only need Utgifter. */
export async function getMonthExpenses(
  userId: string,
  monthStart: string,
): Promise<ExpenseSummary> {
  const { expenses } = await getMonthSpendSummaries(userId, monthStart);
  return expenses;
}
