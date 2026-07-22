// Client-safe work / jobb types and helpers.

import { isoWeekdayFromLocalISO } from "@/lib/date";

export interface WorkDailyLog {
  localDate: string;
  startedAt: string | null;
  startNote: string | null;
  endedAt: string | null;
  endNote: string | null;
}

export function isWorkday(localDate: string): boolean {
  const weekday = isoWeekdayFromLocalISO(localDate);
  return weekday >= 1 && weekday <= 5;
}

/** Weekday and not marked as leave (semester/ledig). */
export function shouldShowWork(
  localDate: string,
  onLeave = false,
): boolean {
  return isWorkday(localDate) && !onLeave;
}

export function emptyWorkLog(localDate: string): WorkDailyLog {
  return {
    localDate,
    startedAt: null,
    startNote: null,
    endedAt: null,
    endNote: null,
  };
}
