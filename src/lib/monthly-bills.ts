import {
  addDaysISO,
  parseLocalISO,
  weekStartISO,
} from "@/lib/date";
import { FINANCE_EKONOMI_TASK_KEY, formatKr, monthPlanEkonomiHref } from "@/lib/monthly-finance";
import type {
  MonthlyCompletion,
  MonthlyTask,
  MonthlyTaskForMonth,
  TaskCategory,
} from "@/lib/tasks";

export const BILLS_CATEGORY_NAME = "Räkningar";
export const FINANCE_CATEGORY_NAME = "Ekonomi";
export const SAVINGS_CATEGORY_NAME = "Sparande";

export function billsCategoryId(categories: TaskCategory[]): string | null {
  return categories.find((c) => c.name === BILLS_CATEGORY_NAME)?.id ?? null;
}

export function financeCategoryId(categories: TaskCategory[]): string | null {
  return categories.find((c) => c.name === FINANCE_CATEGORY_NAME)?.id ?? null;
}

export function savingsCategoryId(categories: TaskCategory[]): string | null {
  return categories.find((c) => c.name === SAVINGS_CATEGORY_NAME)?.id ?? null;
}

export function isMonthlyBill(
  task: Pick<MonthlyTask, "categoryId">,
  categories: TaskCategory[],
): boolean {
  const id = billsCategoryId(categories);
  return id != null && task.categoryId === id;
}

/** Monthly tasks that can be placed on a day (bills, savings, salary, ekonomi). */
export function isWeekPlannableMonthlyTask(
  task: Pick<MonthlyTask, "categoryId" | "completionKind" | "key">,
  categories: TaskCategory[],
): boolean {
  if (isMonthlyBill(task, categories)) return true;
  const savingsId = savingsCategoryId(categories);
  if (
    savingsId != null &&
    task.categoryId === savingsId &&
    task.completionKind === "amount"
  ) {
    return true;
  }
  const financeId = financeCategoryId(categories);
  if (financeId != null && task.categoryId === financeId) {
    if (task.completionKind === "finance") return true;
    if (
      task.completionKind === "amount" &&
      task.key !== FINANCE_EKONOMI_TASK_KEY
    ) {
      return true;
    }
  }
  return false;
}

export function isMonthlyFinanceTask(
  task: Pick<MonthlyTask, "completionKind" | "key">,
): boolean {
  return (
    task.completionKind === "finance" ||
    task.key === FINANCE_EKONOMI_TASK_KEY
  );
}

export function isMonthlyAmountTask(
  task: Pick<MonthlyTask, "completionKind">,
): boolean {
  return task.completionKind === "amount";
}

/** Done, or amount saved for amount-tasks (counts as complete in UI). */
export function isMonthlyTaskComplete(
  task: Pick<MonthlyTask, "completionKind">,
  completion: MonthlyCompletion | null | undefined,
): boolean {
  if (completion?.doneAt) return true;
  return (
    isMonthlyAmountTask(task) &&
    completion?.amount != null &&
    Number.isFinite(completion.amount)
  );
}

export type MonthlyTaskVisualStatus =
  | "done"
  | "planned"
  | "missed"
  | "unplaced";

export function monthlyTaskVisualStatus(
  task: Pick<MonthlyTask, "dayOfMonth" | "completionKind">,
  completion: MonthlyCompletion | null | undefined,
  monthStart: string,
  today: string,
): MonthlyTaskVisualStatus {
  if (isMonthlyTaskComplete(task, completion)) return "done";

  const schedule = resolveMonthlyTaskSchedule(task, completion ?? null, monthStart);
  if (!schedule.isPlanned) return "unplaced";

  if (schedule.dayOfMonth != null) {
    const scheduledDate = dateInMonth(monthStart, schedule.dayOfMonth);
    if (scheduledDate > today) return "planned";
    if (scheduledDate === today) return "planned";
    return "missed";
  }

  return "planned";
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

export type MonthlyScheduleSource = "explicit" | "default" | "none";

export interface MonthlyTaskSchedule {
  monthStart: string;
  weekStart: string | null;
  dayOfMonth: number | null;
  isPlanned: boolean;
  source: MonthlyScheduleSource;
}

/** All ISO week starts (Mondays) that overlap a calendar month. */
export function weeksInMonth(monthStart: string): string[] {
  const [y, m] = monthStart.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;

  const weeks = new Set<string>();
  let cursor = monthStart;
  while (cursor <= monthEnd) {
    weeks.add(weekStartISO(parseLocalISO(cursor)));
    cursor = addDaysISO(cursor, 1);
  }
  return [...weeks].sort();
}

/** Effective due day for a bill in a given month (per-month override wins). */
export function effectiveScheduledDay(
  task: Pick<MonthlyTask, "dayOfMonth">,
  completion:
    | Pick<
        MonthlyCompletion,
        "scheduledDayOfMonth" | "scheduledWeekStart" | "isUnscheduled"
      >
    | null
    | undefined,
  monthStart?: string,
): number | null {
  return resolveMonthlyTaskSchedule(task, completion ?? null, monthStart ?? "")
    .dayOfMonth;
}

export interface MonthlyTaskScheduleOptions {
  /** Keep schedule visible after completion (day view matches weekly tasks). */
  includeWhenDone?: boolean;
}

/**
 * Resolve how a monthly task is planned for a month.
 * Uses explicit completion row, else `day_of_month` default unless marked unscheduled.
 */
export function resolveMonthlyTaskSchedule(
  task: Pick<MonthlyTask, "dayOfMonth">,
  completion:
    | Partial<
        Pick<
          MonthlyCompletion,
          | "doneAt"
          | "scheduledDayOfMonth"
          | "scheduledWeekStart"
          | "isUnscheduled"
        >
      >
    | null,
  monthStart: string,
  options?: MonthlyTaskScheduleOptions,
): MonthlyTaskSchedule {
  const none = (): MonthlyTaskSchedule => ({
    monthStart,
    weekStart: null,
    dayOfMonth: null,
    isPlanned: false,
    source: "none",
  });

  if (completion?.doneAt && !options?.includeWhenDone) return none();
  if (completion?.isUnscheduled) return none();

  if (completion) {
    const day = completion.scheduledDayOfMonth;
    if (day != null) {
      const weekStart = weekStartISO(
        parseLocalISO(dateInMonth(monthStart, day)),
      );
      return {
        monthStart,
        weekStart: completion.scheduledWeekStart ?? weekStart,
        dayOfMonth: day,
        isPlanned: true,
        source: "explicit",
      };
    }
    if (completion.scheduledWeekStart) {
      return {
        monthStart,
        weekStart: completion.scheduledWeekStart,
        dayOfMonth: null,
        isPlanned: true,
        source: "explicit",
      };
    }
  }

  if (task.dayOfMonth != null) {
    const day = task.dayOfMonth;
    return {
      monthStart,
      weekStart: weekStartISO(parseLocalISO(dateInMonth(monthStart, day))),
      dayOfMonth: day,
      isPlanned: true,
      source: "default",
    };
  }

  return none();
}

/** Monthly tasks for a calendar day (day view / week parity). */
export function monthlyTasksOnLocalDate(
  tasks: MonthlyTaskForMonth[],
  localDate: string,
  completionsByTaskMonth?: Map<string, MonthlyCompletion>,
  options?: MonthlyTaskScheduleOptions,
): MonthlyTaskForMonth[] {
  const monthStart = monthStartFromDate(localDate);
  const results: MonthlyTaskForMonth[] = [];
  const seen = new Set<string>();

  const add = (task: MonthlyTaskForMonth) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    results.push(task);
  };

  for (const task of tasks) {
    if (task.singleMonthStart && task.singleMonthStart !== monthStart) continue;

    const completion =
      completionsByTaskMonth?.get(`${task.id}|${monthStart}`) ??
      task.completion ??
      null;

    const taskWithCompletion = { ...task, completion };

    const schedule = resolveMonthlyTaskSchedule(
      task,
      completion,
      monthStart,
      options,
    );
    if (
      schedule.isPlanned &&
      schedule.dayOfMonth != null &&
      dateInMonth(monthStart, schedule.dayOfMonth) === localDate
    ) {
      add(taskWithCompletion);
      continue;
    }

    if (completion?.doneAt && completion.doneAt.slice(0, 10) === localDate) {
      add(taskWithCompletion);
    }
  }

  return results.sort((a, b) => {
    const ao = a.completion?.daySortOrder ?? a.sortOrder;
    const bo = b.completion?.daySortOrder ?? b.sortOrder;
    return ao - bo;
  });
}

/** True when the task still needs week/day planning on the month board. */
export function needsMonthPlacement(
  task: Pick<MonthlyTask, "dayOfMonth" | "completionKind">,
  completion: MonthlyCompletion | null,
  monthStart: string,
): boolean {
  if (isMonthlyTaskComplete(task, completion)) return false;
  if (
    completion?.scheduledWeekStart != null ||
    completion?.scheduledDayOfMonth != null
  ) {
    return false;
  }
  return !resolveMonthlyTaskSchedule(task, completion, monthStart).isPlanned;
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
  return resolveMonthlyTaskSchedule(task, task.completion, monthStart)
    .dayOfMonth;
}

export interface MonthlyBillWeekSlot {
  task: MonthlyTaskForMonth;
  monthStart: string;
  scheduledDate: string;
  weekday: number;
}

export interface MonthlyBillForWeekBacklog {
  task: MonthlyTaskForMonth;
  monthStart: string;
}

/**
 * Resolve which monthly tasks appear in an ISO week.
 * - Unplanned plannable tasks sit in the backlog (Att placera).
 * - Planned week/day: visible that week (or backlog if day missing / overdue).
 * - Done tasks appear on their scheduled or completion day.
 */
export function resolveMonthlyBillsForWeek(
  tasks: MonthlyTaskForMonth[],
  weekStart: string,
  completionsByTaskMonth: Map<string, MonthlyCompletion>,
  categories: TaskCategory[],
): { placed: MonthlyBillWeekSlot[]; backlog: MonthlyBillForWeekBacklog[] } {
  const weekDates = new Set(weekDayDates(weekStart));
  const monthStarts = [...new Set([...weekDates].map(monthStartFromDate))];
  const placed: MonthlyBillWeekSlot[] = [];
  const backlog: MonthlyBillForWeekBacklog[] = [];
  const inBacklog = new Set<string>();
  const unplannedRecurringBacklog = new Set<string>();
  const placedTaskIds = new Set<string>();

  const markPlaced = (slot: MonthlyBillWeekSlot) => {
    placed.push(slot);
    if (!slot.task.singleMonthStart) {
      placedTaskIds.add(slot.task.id);
    }
  };

  const skipRecurringBacklog = (task: MonthlyTaskForMonth): boolean =>
    !task.singleMonthStart && placedTaskIds.has(task.id);

  for (const task of tasks) {
    for (const monthStart of monthStarts) {
      if (task.singleMonthStart && task.singleMonthStart !== monthStart) continue;
      if (!isWeekPlannableMonthlyTask(task, categories)) continue;

      const compKey = `${task.id}|${monthStart}`;
      const completion = completionsByTaskMonth.get(compKey) ?? null;
      const taskWithCompletion: MonthlyTaskForMonth = {
        ...task,
        completion,
      };

      if (completion?.doneAt) {
        const schedule = resolveMonthlyTaskSchedule(
          task,
          completion,
          monthStart,
          { includeWhenDone: true },
        );
        const showDate =
          schedule.isPlanned && schedule.dayOfMonth != null
            ? dateInMonth(monthStart, schedule.dayOfMonth)
            : completion.doneAt.slice(0, 10);
        if (weekDates.has(showDate)) {
          markPlaced({
            task: taskWithCompletion,
            monthStart,
            scheduledDate: showDate,
            weekday: isoWeekdayFromDate(showDate),
          });
        }
        continue;
      }

      const schedule = resolveMonthlyTaskSchedule(task, completion, monthStart);
      if (!schedule.isPlanned || !schedule.weekStart) {
        if (skipRecurringBacklog(task)) continue;
        if (!task.singleMonthStart) {
          const recurringBacklogKey = `${task.id}|${monthStart}`;
          if (!unplannedRecurringBacklog.has(recurringBacklogKey)) {
            unplannedRecurringBacklog.add(recurringBacklogKey);
            const monthCompletion =
              completionsByTaskMonth.get(`${task.id}|${monthStart}`) ??
              null;
            backlog.push({
              task: { ...task, completion: monthCompletion },
              monthStart,
            });
          }
          continue;
        }
        if (!inBacklog.has(compKey)) {
          backlog.push({ task: taskWithCompletion, monthStart });
          inBacklog.add(compKey);
        }
        continue;
      }
      if (weekStart < schedule.weekStart) continue;

      if (schedule.dayOfMonth != null) {
        const scheduledDate = dateInMonth(monthStart, schedule.dayOfMonth);
        if (weekDates.has(scheduledDate)) {
          markPlaced({
            task: taskWithCompletion,
            monthStart,
            scheduledDate,
            weekday: isoWeekdayFromDate(scheduledDate),
          });
          continue;
        }
        if (skipRecurringBacklog(task)) continue;
        if (weekStart >= schedule.weekStart && !inBacklog.has(compKey)) {
          backlog.push({ task: taskWithCompletion, monthStart });
          inBacklog.add(compKey);
        }
        continue;
      }

      if (skipRecurringBacklog(task)) continue;
      if (weekStart >= schedule.weekStart && !inBacklog.has(compKey)) {
        backlog.push({ task: taskWithCompletion, monthStart });
        inBacklog.add(compKey);
      }
    }
  }

  const dedupedBacklog: MonthlyBillForWeekBacklog[] = [];
  const seenRecurringBacklog = new Set<string>();
  for (const entry of backlog) {
    if (entry.task.singleMonthStart) {
      dedupedBacklog.push(entry);
      continue;
    }
    const key = `${entry.task.id}|${entry.monthStart}`;
    if (seenRecurringBacklog.has(key)) continue;
    if (placedTaskIds.has(entry.task.id)) continue;
    seenRecurringBacklog.add(key);
    dedupedBacklog.push(entry);
  }

  return { placed, backlog: dedupedBacklog };
}

function isoWeekdayFromDate(localDate: string): number {
  const dt = parseLocalISO(localDate);
  const jsDow = dt.getDay();
  return ((jsDow + 6) % 7) + 1;
}

export { monthPlanEkonomiHref };
