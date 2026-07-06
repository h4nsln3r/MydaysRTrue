import "server-only";
import { addDaysISO, weekStartISO, parseLocalISO } from "@/lib/date";
import { collectMonthExpenses, type ExpenseSummary } from "@/lib/expenses";
import { getCategories, getMonthTaskSummary, getWeekSummary } from "@/lib/tasks.server";

/** All logged expenses in a calendar month (weekly + monthly Utgifter tasks). */
export async function getMonthExpenses(
  userId: string,
  monthStart: string,
): Promise<ExpenseSummary> {
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

  return collectMonthExpenses({
    weeklyTasks,
    monthlyTasks: monthTasks.tasks,
    categories,
    monthStart,
  });
}
