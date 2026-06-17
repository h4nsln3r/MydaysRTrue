// Client-safe cardio types and helpers.
// Server-only queries live in `./cardio.server`.

import type { Weekday } from "@/lib/tasks";

export type CardioKey = "running" | "cycling" | "swimming";

export interface CardioSessionTemplate {
  id: string;
  key: CardioKey;
  label: string;
  description: string | null;
  icon: string;
  accent: string;
  sortOrder: number;
  defaultWeekday: Weekday;
}

export interface CardioPlacement {
  id: string;
  templateId: string;
  weekStart: string;
  /** null = in the week backlog until placed on a day. */
  weekday: Weekday | null;
  daySortOrder: number;
  doneAt: string | null;
  note: string | null;
}

export interface CardioSessionForWeek extends CardioSessionTemplate {
  placement: CardioPlacement;
}
