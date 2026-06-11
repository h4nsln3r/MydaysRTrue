import type { Weekday } from "@/lib/tasks";

export type WeightTimeOfDay = "morning" | "day" | "evening";

export const WEIGHT_TIMES_OF_DAY: WeightTimeOfDay[] = [
  "morning",
  "day",
  "evening",
];

export const WEIGHT_TIME_LABEL: Record<WeightTimeOfDay, string> = {
  morning: "Morgon",
  day: "Dag",
  evening: "Kväll",
};

export const WEIGHT_ITEM_ID = "weight-check";

export interface WeightLog {
  localDate: string;
  timeOfDay: WeightTimeOfDay;
  weightKg: number;
  loggedAt: string;
}

export interface WeightWeekPlan {
  weekStart: string;
  enabled: boolean;
  weekday: Weekday | null;
  /** User default from profile — used when seeding new weeks. */
  defaultWeekday: Weekday | null;
  /** Log for the scheduled day this week, if placed and logged. */
  log: WeightLog | null;
}

export interface WeightDayContext {
  localDate: string;
  weekStart: string;
  weekday: Weekday;
  /** Enabled and placed on this calendar day for the current week. */
  scheduled: boolean;
  log: WeightLog | null;
}

export function isWeightTimeOfDay(value: string): value is WeightTimeOfDay {
  return WEIGHT_TIMES_OF_DAY.includes(value as WeightTimeOfDay);
}
