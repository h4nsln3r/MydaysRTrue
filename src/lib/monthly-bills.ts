import { addDaysISO, parseLocalISO } from "@/lib/date";
import type { MonthlyCompletion, MonthlyTask, MonthlyTaskForMonth } from "@/lib/tasks";

/** Effective due day for a bill in a given month (per-month override wins). */
export function effectiveScheduledDay(
  task: Pick<MonthlyTask, "dayOfMonth">,
  completion:
    | Pick<MonthlyCompletion, "scheduledDayOfMonth" | "isUnscheduled">
    | null
    | undefined,
): number | null {
  if (completion?.isUnscheduled) return null;
  if (completion?.scheduledDayOfMonth != null) return completion.scheduledDayOfMonth;
  return task.dayOfMonth ?? null;
}

/** YYYY-MM-DD for a day in month, clamped to last day if needed. */
export function dateInMonth(monthStart: string, dayOfMonth: number): string {
  const [y, m] = monthStart.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, dayOfMonth), lastDay);
  return `${monthStart.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

export function monthStartFromDate(localDate: string): string {
  return `${localDate.slice(0, 7)}-01`;
}

/** All seven YYYY-MM-DD dates in an ISO week (Mon–Sun). */
export function weekDayDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
}

export function effectiveDayForMonth(
  task: MonthlyTaskForMonth,
  monthStart: string,
): number | null {
  if (task.completion?.monthStart === monthStart) {
    return effectiveScheduledDay(task, task.completion);
  }
  return task.dayOfMonth;
}

export interface MonthlyBillWeekSlot {
  task: MonthlyTaskForMonth;
  monthStart: string;
  scheduledDate: string;
  weekday: number;
}

/**
 * Resolve which monthly bills appear on which days in a given ISO week.
 * Unplaced bills for overlapping months go to the backlog list.
 */
export function resolveMonthlyBillsForWeek(
  tasks: MonthlyTaskForMonth[],
  weekStart: string,
  completionsByTaskMonth: Map<string, MonthlyCompletion>,
): { placed: MonthlyBillWeekSlot[]; backlog: MonthlyBillForWeekBacklog[] } {
  const weekDates = new Set(weekDayDates(weekStart));
  const monthStarts = [...new Set([...weekDates].map(monthStartFromDate))];
  const placed: MonthlyBillWeekSlot[] = [];
  const backlog: MonthlyBillForWeekBacklog[] = [];
  const placedTaskMonths = new Set<string>();

  for (const task of tasks) {
    for (const monthStart of monthStarts) {
      if (task.singleMonthStart && task.singleMonthStart !== monthStart) continue;
      const compKey = `${task.id}|${monthStart}`;
      const completion = completionsByTaskMonth.get(compKey) ?? null;
      const day = effectiveScheduledDay(task, completion);

      if (day != null) {
        const scheduledDate = dateInMonth(monthStart, day);
        if (weekDates.has(scheduledDate)) {
          placed.push({
            task: { ...task, completion },
            monthStart,
            scheduledDate,
            weekday: isoWeekdayFromDate(scheduledDate),
          });
          placedTaskMonths.add(compKey);
        }
      }
    }

    for (const monthStart of monthStarts) {
      if (task.singleMonthStart && task.singleMonthStart !== monthStart) continue;
      const compKey = `${task.id}|${monthStart}`;
      if (placedTaskMonths.has(compKey)) continue;

      const completion = completionsByTaskMonth.get(compKey) ?? null;
      const day = effectiveScheduledDay(task, completion);
      if (day == null) {
        backlog.push({ task: { ...task, completion }, monthStart });
      }
    }
  }

  return { placed, backlog };
}

export interface MonthlyBillForWeekBacklog {
  task: MonthlyTaskForMonth;
  monthStart: string;
}

function isoWeekdayFromDate(localDate: string): number {
  const dt = parseLocalISO(localDate);
  const jsDow = dt.getDay();
  return ((jsDow + 6) % 7) + 1;
}
