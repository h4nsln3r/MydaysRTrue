// Client-safe leave / semester types and helpers.

import { addDaysISO } from "@/lib/date";

export type LeaveKind = "vacation" | "day_off";

export const LEAVE_KIND_LABEL: Record<LeaveKind, string> = {
  vacation: "Semester",
  day_off: "Ledig",
};

export const LEAVE_KIND_ICON: Record<LeaveKind, string> = {
  vacation: "🏖",
  day_off: "☕",
};

export interface LeavePeriod {
  id: string;
  kind: LeaveKind;
  startDate: string;
  endDate: string;
  note: string | null;
}

export interface YearLeaveContext {
  year: number;
  periods: LeavePeriod[];
}

export function isLeaveKind(value: string): value is LeaveKind {
  return value === "vacation" || value === "day_off";
}

/** Inclusive list of YYYY-MM-DD dates covered by a period. */
export function expandLeaveDates(period: Pick<LeavePeriod, "startDate" | "endDate">): string[] {
  const dates: string[] = [];
  let cursor = period.startDate;
  while (cursor <= period.endDate) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return dates;
}

/** Map localDate → leave kind (later periods win on overlap). */
export function leaveKindByDate(periods: LeavePeriod[]): Map<string, LeaveKind> {
  const map = new Map<string, LeaveKind>();
  for (const period of periods) {
    for (const date of expandLeaveDates(period)) {
      map.set(date, period.kind);
    }
  }
  return map;
}

export function isDateOnLeave(
  localDate: string,
  periods: LeavePeriod[],
): boolean {
  return periods.some(
    (p) => localDate >= p.startDate && localDate <= p.endDate,
  );
}

export function leaveForDate(
  localDate: string,
  periods: LeavePeriod[],
): LeavePeriod | null {
  for (let i = periods.length - 1; i >= 0; i--) {
    const p = periods[i];
    if (localDate >= p.startDate && localDate <= p.endDate) return p;
  }
  return null;
}

export function formatLeaveRange(period: Pick<LeavePeriod, "startDate" | "endDate">): string {
  if (period.startDate === period.endDate) return period.startDate;
  return `${period.startDate} – ${period.endDate}`;
}

export function leavePeriodDetail(period: LeavePeriod): string {
  const parts = [LEAVE_KIND_LABEL[period.kind], formatLeaveRange(period)];
  if (period.note) parts.push(period.note);
  return parts.join(" · ");
}

/** Count weekdays (Mon–Fri) covered by leave in a year. */
export function countLeaveWeekdaysInYear(
  periods: LeavePeriod[],
  year: number,
): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const seen = new Set<string>();
  for (const period of periods) {
    const start = period.startDate < yearStart ? yearStart : period.startDate;
    const end = period.endDate > yearEnd ? yearEnd : period.endDate;
    if (start > end) continue;
    let cursor = start;
    while (cursor <= end) {
      const jsDow = new Date(
        Number(cursor.slice(0, 4)),
        Number(cursor.slice(5, 7)) - 1,
        Number(cursor.slice(8, 10)),
      ).getDay();
      const isoWeekday = ((jsDow + 6) % 7) + 1;
      if (isoWeekday <= 5) seen.add(cursor);
      cursor = addDaysISO(cursor, 1);
    }
  }
  return seen.size;
}
