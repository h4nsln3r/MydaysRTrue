// Client-safe gym types and helpers.
// Server-only queries live in `./gym.server`.

import type { Weekday } from "@/lib/tasks";

export type GymWarmup =
  | "skidor"
  | "rodd"
  | "cykel"
  | "crosstrainer"
  | "magmaskin";

export const GYM_WARMUPS: GymWarmup[] = [
  "skidor",
  "rodd",
  "cykel",
  "crosstrainer",
  "magmaskin",
];

export const GYM_WARMUP_LABEL: Record<GymWarmup, string> = {
  skidor: "Skidor",
  rodd: "Rodd",
  cykel: "Cykel",
  crosstrainer: "Crosstrainer",
  magmaskin: "Magmaskin",
};

export const GYM_WARMUP_ICON: Record<GymWarmup, string> = {
  skidor: "⛷️",
  rodd: "🚣",
  cykel: "🚴",
  crosstrainer: "🏃",
  magmaskin: "🎯",
};

export interface GymSessionTemplate {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string;
  accent: string;
  sortOrder: number;
  /** Default ISO weekday when a new week is opened (1 = Mon … 7 = Sun). */
  defaultWeekday: Weekday;
}

export interface GymPlacement {
  id: string;
  templateId: string;
  weekStart: string;
  /** null = in the week backlog until placed on a day. */
  weekday: Weekday | null;
  /** Order on the weekday in the unified week plan. */
  daySortOrder: number;
  warmup: GymWarmup | null;
  doneAt: string | null;
  note: string | null;
}

/** A gym pass in the context of a specific week. */
export interface GymSessionForWeek extends GymSessionTemplate {
  placement: GymPlacement;
}

export function isGymWarmup(value: string): value is GymWarmup {
  return (GYM_WARMUPS as readonly string[]).includes(value);
}
