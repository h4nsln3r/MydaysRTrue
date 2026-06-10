// Client-safe intake types and helpers.
// Server-only queries live in `./intake.server`.

import type { HabitStatus } from "./habits";
//
// The four daily intakes are kept in one table because they behave the same
// way: at most one entry per (user, date, kind). Only `creatine` carries a
// linked water_logs row — but the data shape is uniform so the UI can render
// them with one component.

export type IntakeKind = "fruit" | "creatine" | "vitamin" | "shake";

export const INTAKE_ORDER: IntakeKind[] = ["fruit", "creatine", "vitamin", "shake"];

export const INTAKE_LABEL: Record<IntakeKind, string> = {
  fruit: "Fruit",
  creatine: "Creatine",
  vitamin: "Vitamins",
  shake: "Shake",
};

export const INTAKE_ICON: Record<IntakeKind, string> = {
  fruit: "🍎",
  creatine: "💪",
  vitamin: "💊",
  shake: "🥤",
};

/** Kinds the user only tracks Mon–Fri. */
export const INTAKE_WEEKDAYS_ONLY: Record<IntakeKind, boolean> = {
  fruit: false,
  creatine: false,
  vitamin: true,
  shake: true,
};

/** Whether the inline form must have non-empty description text. */
export const INTAKE_REQUIRES_DESCRIPTION: Record<IntakeKind, boolean> = {
  fruit: true,
  creatine: false,
  vitamin: true,
  shake: false,
};

/** Kinds that collect a water amount as part of the same form. */
export const INTAKE_HAS_WATER: Record<IntakeKind, boolean> = {
  fruit: false,
  creatine: true,
  vitamin: false,
  shake: true,
};

/** Form placeholder + label hints — keeps the UI declarative. */
export const INTAKE_DESCRIPTION_LABEL: Record<IntakeKind, string> = {
  fruit: "Which fruit?",
  creatine: "Brand or note (optional)",
  vitamin: "Which vitamins?",
  shake: "Flavour / note (optional)",
};

export const INTAKE_DESCRIPTION_PLACEHOLDER: Record<IntakeKind, string> = {
  fruit: "e.g. Apple, banana",
  creatine: "e.g. 5 g monohydrate",
  vitamin: "e.g. D3, Omega-3, magnesium",
  shake: "e.g. Vanilla",
};

/** Short hint shown next to an empty row. */
export const INTAKE_EMPTY_HINT: Record<IntakeKind, string> = {
  fruit: "Tap to log fruit",
  creatine: "Tap to log creatine",
  vitamin: "Tap to log vitamins",
  shake: "Tap to log shake",
};

export interface IntakeEntry {
  id: string;
  kind: IntakeKind;
  description: string;
  /** Water-only kinds (currently `creatine`). 0 if no water logged. */
  waterMl: number;
  waterLogId: string | null;
}

/** True if the given YYYY-MM-DD falls on Saturday/Sunday. */
export function isWeekend(localDate: string): boolean {
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0 = Sun, 6 = Sat
  return dow === 0 || dow === 6;
}

/** Intake kinds that apply on the given date (skips weekday-only ones on Sat/Sun). */
export function applicableIntakeKinds(localDate: string): IntakeKind[] {
  const weekend = isWeekend(localDate);
  return INTAKE_ORDER.filter((k) => !(weekend && INTAKE_WEEKDAYS_ONLY[k]));
}

/** Intake rollup: all applicable kinds = yes, some = half, none = no. */
export function intakeStatusFor(logged: number, total: number): HabitStatus {
  if (logged <= 0 || total <= 0) return "no";
  if (logged >= total) return "yes";
  return "half";
}
