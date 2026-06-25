import { addDaysISO, parseLocalISO } from "@/lib/date";
import { formatKr } from "@/lib/monthly-finance";
import type {
  MonthlyCompletion,
  MonthlyTask,
  MonthlyTaskForMonth,
  TaskCategory,
} from "@/lib/tasks";

export const BILLS_CATEGORY_NAME = "Räkningar";
export const FINANCE_CATEGORY_NAME = "Ekonomi";

export function billsCategoryId(categories: TaskCategory[]): string | null {
  return categories.find((c) => c.name === BILLS_CATEGORY_NAME)?.id ?? null;
}

export function financeCategoryId(categories: TaskCategory[]): string | null {
  return categories.find((c) => c.name === FINANCE_CATEGORY_NAME)?.id ?? null;
}

export function isMonthlyBill(
  task: Pick<MonthlyTask, "categoryId">,
  categories: TaskCategory[],
): boolean {
  const id = billsCategoryId(categories);
  return id != null && task.categoryId === id;
}

/** Monthly tasks that can be placed on days in the week plan (bills + e.g. lön). */
export function isWeekPlannableMonthlyTask(
  task: Pick<MonthlyTask, "categoryId" | "completionKind" | "key">,
  categories: TaskCategory[],
): boolean {
  if (isMonthlyBill(task, categories)) return true;
  const financeId = financeCategoryId(categories);
  return (
    financeId != null &&
    task.categoryId === financeId &&
    task.completionKind === "amount" &&
    task.key !== "finance_ekonomi"
  );
}

export function effectiveBillAmountKr(task: MonthlyTaskForMonth): number | null {
  const actual = task.completion?.amount;
  if (actual != null && Number.isFinite(actual)) return actual;
  if (task.defaultAmountKr != null && Number.isFinite(task.defaultAmountKr)) {
    return task.defaultAmountKr;
  }
  return null;
}

export function formatBillAmountKr(task: MonthlyTaskForMonth): string | null {
  const amount = effectiveBillAmountKr(task);
  return amount != null ? formatKr(amount) : null;
}

export interface MonthlyBillsTotal {
  billCount: number;
  withAmount: number;
  missingAmount: number;
  totalKr: number;
  perPersonKr: number;
}

export function sumMonthlyBills(
  tasks: MonthlyTaskForMonth[],
  categories: TaskCategory[],
): MonthlyBillsTotal {
  const bills = tasks.filter((t) => isMonthlyBill(t, categories));
  let totalKr = 0;
  let withAmount = 0;
  for (const bill of bills) {
    const amount = effectiveBillAmountKr(bill);
    if (amount != null) {
      totalKr += amount;
      withAmount += 1;
    }
  }
  return {
    billCount: bills.length,
    withAmount,
    missingAmount: bills.length - withAmount,
    totalKr,
    perPersonKr: totalKr / 2,
  };
}

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
