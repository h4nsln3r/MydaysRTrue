// Client-safe smoke-free types and helpers.

import type { HabitStatus } from "@/lib/habits";

export type SmokeFreeSubstance = "nicotine" | "cannabis";

export const SMOKE_FREE_SUBSTANCES: {
  key: SmokeFreeSubstance;
  label: string;
  icon: string;
}[] = [
  { key: "nicotine", label: "Nikotin", icon: "💨" },
  { key: "cannabis", label: "Cannabis", icon: "🌿" },
];

const STATUS_LABEL: Record<HabitStatus, string> = {
  yes: "Ja",
  half: "½",
  no: "Nej",
};

export interface DailySmokeFreeContext {
  localDate: string;
  nicotine: HabitStatus | null;
  cannabis: HabitStatus | null;
  hasLog: boolean;
}

export function smokeFreeValueFor(
  ctx: DailySmokeFreeContext,
  substance: SmokeFreeSubstance,
): HabitStatus | null {
  return substance === "nicotine" ? ctx.nicotine : ctx.cannabis;
}

export function smokeFreeYesCount(ctx: DailySmokeFreeContext): number {
  return SMOKE_FREE_SUBSTANCES.filter(
    (s) => smokeFreeValueFor(ctx, s.key) === "yes",
  ).length;
}

/** Both Ja → yes, both Nej → no, anything else → half. */
export function smokeFreeStatusFor(
  ctx: DailySmokeFreeContext,
  isFuture: boolean,
): HabitStatus | null {
  if (isFuture || !ctx.hasLog) return null;

  const { nicotine, cannabis } = ctx;
  if (nicotine === null && cannabis === null) return null;
  if (nicotine === null || cannabis === null) return "half";

  if (nicotine === "yes" && cannabis === "yes") return "yes";
  if (nicotine === "no" && cannabis === "no") return "no";
  return "half";
}

export function smokeFreeJournalBody(ctx: DailySmokeFreeContext): string {
  return SMOKE_FREE_SUBSTANCES.map((s) => {
    const status = smokeFreeValueFor(ctx, s.key);
    const label = status ? STATUS_LABEL[status] : "—";
    return `${s.label}: ${label}`;
  }).join(", ");
}
