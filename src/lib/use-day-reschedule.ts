"use client";

import { useMemo } from "react";
import { addDaysISO, formatDayLong, isoWeekdayFromLocalISO } from "@/lib/date";
import type { Weekday } from "@/lib/tasks";
import { useAfterEight } from "@/lib/use-after-eight";

export interface RescheduleDay {
  weekday: Weekday;
  label: string;
}

/** After 20:00 today, or any overdue day — enable "Planera om" for week-planned items. */
export function useDayReschedule(options: {
  date?: string;
  today?: string;
  weekStart: string;
  planningMode?: boolean;
}): {
  isOverdue: boolean;
  canReschedule: boolean;
  rescheduleDays: RescheduleDay[];
} {
  const { date, today, weekStart, planningMode = false } = options;
  const afterEight = useAfterEight();
  const isOverdue =
    !planningMode && date != null && today != null && date < today;
  const isToday = date != null && today != null && date === today;
  const canReschedule =
    !planningMode && (isOverdue || (isToday && afterEight));

  const rescheduleDays = useMemo<RescheduleDay[]>(() => {
    if (!today) return [];
    return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i))
      .filter((iso) => iso > today || (isOverdue && iso === today))
      .map((iso) => ({
        weekday: isoWeekdayFromLocalISO(iso) as Weekday,
        label: iso === today ? "Idag" : formatDayLong(iso),
      }));
  }, [weekStart, today, isOverdue]);

  return { isOverdue, canReschedule, rescheduleDays };
}
