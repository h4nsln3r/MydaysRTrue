// Client-safe sport types and helpers.
// Server-only queries live in `./sport.server`.

import type { Weekday } from "@/lib/tasks";

export type SportKey = "sport_1" | "sport_2";

export interface SportSessionTemplate {
  id: string;
  key: SportKey;
  label: string;
  description: string | null;
  icon: string;
  accent: string;
  sortOrder: number;
  defaultWeekday: Weekday;
}

export interface SportPlacement {
  id: string;
  templateId: string;
  weekStart: string;
  /** null = in the week backlog until placed on a day. */
  weekday: Weekday | null;
  daySortOrder: number;
  planSport: string | null;
  actualSport: string | null;
  note: string | null;
  companions: string | null;
  doneAt: string | null;
}

export interface SportSessionForWeek extends SportSessionTemplate {
  placement: SportPlacement;
}

export function formatSportDetail(placement: SportPlacement): string | null {
  const parts: string[] = [];
  if (placement.actualSport?.trim()) {
    parts.push(placement.actualSport.trim());
  } else if (placement.planSport?.trim()) {
    parts.push(`Plan: ${placement.planSport.trim()}`);
  }
  if (placement.note?.trim()) parts.push(placement.note.trim());
  if (placement.companions?.trim()) {
    parts.push(`Med: ${placement.companions.trim()}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
