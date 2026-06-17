// Client-safe bathing types and helpers.
// Server-only queries live in `./bathing.server`.

import type { Weekday } from "@/lib/tasks";

export type BathingKey = "bad" | "bastu";

export interface BathingSessionTemplate {
  id: string;
  key: BathingKey;
  label: string;
  description: string | null;
  icon: string;
  accent: string;
  sortOrder: number;
  defaultWeekday: Weekday;
}

export interface BathingPlacement {
  id: string;
  templateId: string;
  weekStart: string;
  /** null = in the week backlog until placed on a day. */
  weekday: Weekday | null;
  daySortOrder: number;
  waterTempC: number | null;
  doneAt: string | null;
  note: string | null;
}

export interface BathingSessionForWeek extends BathingSessionTemplate {
  placement: BathingPlacement;
}

export function bathingRequiresWaterTemp(key: BathingKey | string): boolean {
  return key === "bad" || key.startsWith("bad_");
}

export function formatWaterTemp(c: number): string {
  return `${c}°C`;
}
