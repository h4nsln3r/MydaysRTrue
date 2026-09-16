// Client-safe cardio types and helpers.
// Server-only queries live in `./cardio.server`.

import type { Weekday } from "@/lib/tasks";

export type CardioTemplateKey = "cardio";
export type CardioKind = "running" | "cycling" | "swimming";

export const CARDIO_WEEKLY_GOAL = 3;

export const CARDIO_KINDS: {
  key: CardioKind;
  label: string;
  icon: string;
  accent: string;
}[] = [
  { key: "running", label: "Löpning", icon: "🏃", accent: "#ff7a1a" },
  { key: "cycling", label: "Cykling", icon: "🚴", accent: "#6ee7a3" },
  { key: "swimming", label: "Simning", icon: "🏊", accent: "#5fb6ff" },
];

const KIND_BY_KEY = new Map(CARDIO_KINDS.map((k) => [k.key, k]));

export interface CardioSessionTemplate {
  id: string;
  key: CardioTemplateKey | string;
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
  planKind: CardioKind | null;
  actualKind: CardioKind | null;
  doneAt: string | null;
  note: string | null;
}

export interface CardioSessionForWeek extends CardioSessionTemplate {
  placement: CardioPlacement;
}

export function isCardioKind(value: string | null | undefined): value is CardioKind {
  return value === "running" || value === "cycling" || value === "swimming";
}

export function cardioKindMeta(kind: CardioKind | null | undefined) {
  if (!kind) return null;
  return KIND_BY_KEY.get(kind) ?? null;
}

export function resolveCardioKind(placement: CardioPlacement): CardioKind | null {
  return placement.actualKind ?? placement.planKind;
}

export function cardioSessionDisplay(session: CardioSessionForWeek): {
  label: string;
  icon: string;
  accent: string;
} {
  const meta = cardioKindMeta(resolveCardioKind(session.placement));
  if (meta) return meta;
  return {
    label: session.label,
    icon: session.icon,
    accent: session.accent,
  };
}

export function formatCardioDetail(placement: CardioPlacement): string | null {
  const parts: string[] = [];
  const actual = cardioKindMeta(placement.actualKind);
  const plan = cardioKindMeta(placement.planKind);
  if (actual) {
    parts.push(actual.label);
  } else if (plan) {
    parts.push(`Plan: ${plan.label}`);
  }
  if (placement.note?.trim()) parts.push(placement.note.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function isRepeatableCardioKey(key: string | null | undefined): boolean {
  return (
    key === "cardio" ||
    key === "running" ||
    key === "cycling" ||
    key === "swimming" ||
    (key?.startsWith("cardio_") ?? false)
  );
}
