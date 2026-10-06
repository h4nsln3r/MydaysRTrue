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

export function bathingWaterTempError(
  key: BathingKey | string,
  waterTempC: number | null | undefined,
): string | null {
  if (!bathingRequiresWaterTemp(key)) return null;
  if (waterTempC == null || !Number.isFinite(waterTempC)) {
    return "Ange vattentemperaturen i °C.";
  }
  if (waterTempC < -5 || waterTempC > 50) {
    return "Vattentemperaturen ska vara mellan -5 och 50 °C.";
  }
  return null;
}

/** Journal line for a completed bath, same text the day page builds. */
export function formatBathingJournalBody(
  waterTempC: number | null,
  note: string | null,
  description?: string | null,
): string {
  const parts: string[] = [];
  if (waterTempC != null) parts.push(formatWaterTemp(waterTempC));
  const trimmedNote = note?.trim();
  if (trimmedNote) parts.push(trimmedNote);
  if (description && parts.length === 0) parts.push(description);
  return parts.length > 0 ? parts.join(". ") : "Klart.";
}

const BATHING_TEMP_RE = /(-?\d+(?:[.,]\d+)?)\s*(?:°\s*c|grader)/i;

/** Pull a water temperature and leftover comment out of a journal line. */
export function parseBathingJournalBody(body: string): {
  waterTempC: number | null;
  note: string | null;
} {
  const trimmed = body.trim();
  const match = BATHING_TEMP_RE.exec(trimmed);
  if (!match) {
    return { waterTempC: null, note: trimmed || null };
  }
  const waterTempC = Number(match[1].replace(",", "."));
  const rawNote = `${trimmed.slice(0, match.index)}${trimmed.slice(match.index + match[0].length)}`
    .replace(/\s+/g, " ")
    .replace(/^[\s.,:;–—-]+/, "")
    .replace(/[\s.,:;–—-]+$/, "")
    .trim();
  return {
    waterTempC: Number.isFinite(waterTempC) ? waterTempC : null,
    note: rawNote || null,
  };
}
