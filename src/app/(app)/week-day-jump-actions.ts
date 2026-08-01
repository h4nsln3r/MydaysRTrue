"use server";

import { getWeekDayJumpStatuses } from "@/lib/week-day-jump.server";
import type { WeekDayJumpDayStatus } from "@/lib/week-day-score";

export async function fetchWeekDayJumpStatusesAction(
  weekStart: string,
): Promise<WeekDayJumpDayStatus[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return [];
  return getWeekDayJumpStatuses(weekStart);
}
