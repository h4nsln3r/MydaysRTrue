// Fixed parts inside a daily habit (intake, meals, snacks, …).
// Each part can be hidden on semester/resa, ledig, sjuk or helg
// without hiding the rest of the habit.

import {
  MEAL_ICON,
  SNACK_ICON,
  SNACK_SLOTS,
  habitVisibleOnDay,
  mealStatusFor,
  snackStatusFor,
  type HabitDayContext,
  type HabitKind,
  type HabitStatus,
  type HabitVisibility,
  type MealKey,
} from "@/lib/habits";
import { INTAKE_ICON, INTAKE_ORDER, intakeStatusFor } from "@/lib/intake";
import {
  MOBILE_GAME_STEPS,
  mobileGamesStatusFor,
  type DailyMobileGamesContext,
  type MobileGameKey,
} from "@/lib/mobile-games";
import {
  SMOKE_FREE_SUBSTANCES,
  smokeFreeStatusFor,
  smokeFreeValueFor,
  type DailySmokeFreeContext,
  type SmokeFreeSubstance,
} from "@/lib/smoke-free";

export interface HabitPart {
  key: string;
  label: string;
  icon: string;
}

const MEAL_PARTS: HabitPart[] = [
  { key: "breakfast", label: "Frukost", icon: MEAL_ICON.breakfast },
  { key: "lunch", label: "Lunch", icon: MEAL_ICON.lunch },
  { key: "dinner", label: "Middag", icon: MEAL_ICON.dinner },
];

const INTAKE_PARTS: HabitPart[] = INTAKE_ORDER.map((kind) => ({
  key: kind,
  icon: INTAKE_ICON[kind],
  label:
    kind === "fruit"
      ? "Frukt"
      : kind === "creatine"
        ? "Kreatin"
        : kind === "vitamin"
          ? "Vitaminer"
          : "Shake",
}));

const VISIBILITY_FLAGS = [
  "showOnVacation",
  "showOnDayOff",
  "showOnSick",
  "showOnWeekend",
] as const;

export function habitVisibilityParts(habit: { kind: HabitKind | string }): HabitPart[] {
  switch (habit.kind) {
    case "meal":
      return MEAL_PARTS;
    case "snack":
      return SNACK_SLOTS.map((slot) => ({
        key: String(slot),
        label: slot === 1 ? "Mellanmål 1" : "Mellanmål 2",
        icon: SNACK_ICON[slot],
      }));
    case "intake":
      return INTAKE_PARTS;
    case "smoke_free":
      return SMOKE_FREE_SUBSTANCES.map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
      }));
    case "mobile_games":
      return MOBILE_GAME_STEPS.map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
      }));
    default:
      return [];
  }
}

export function emptyPartVisibility(): HabitVisibility {
  return {
    showOnVacation: true,
    showOnDayOff: true,
    showOnSick: true,
    showOnWeekend: true,
  };
}

export function parsePartVisibility(
  raw: unknown,
): Record<string, HabitVisibility> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, HabitVisibility> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const flags = emptyPartVisibility();
    for (const flag of VISIBILITY_FLAGS) {
      if (typeof row[flag] === "boolean") flags[flag] = row[flag];
    }
    out[key] = flags;
  }
  return out;
}

export function partVisibilityFor(
  parts: Record<string, HabitVisibility> | undefined,
  partKey: string,
): HabitVisibility {
  return parts?.[partKey] ?? emptyPartVisibility();
}

/** Part-level flag only. The parent habit is checked separately. */
export function habitPartShown(
  habit: { partVisibility: Record<string, HabitVisibility> },
  partKey: string,
  ctx: HabitDayContext,
): boolean {
  return habitVisibleOnDay(partVisibilityFor(habit.partVisibility, partKey), ctx);
}

export function hiddenPartKeys(
  habit: { kind: HabitKind | string; partVisibility: Record<string, HabitVisibility> },
  ctx: HabitDayContext,
): string[] {
  return habitVisibilityParts(habit)
    .filter((part) => !habitPartShown(habit, part.key, ctx))
    .map((part) => part.key);
}

export function partVisibilityCustomized(
  habit: { kind: HabitKind | string; partVisibility: Record<string, HabitVisibility> },
): boolean {
  return habitVisibilityParts(habit).some((part) => {
    const flags = partVisibilityFor(habit.partVisibility, part.key);
    return VISIBILITY_FLAGS.some((flag) => !flags[flag]);
  });
}

export function statusForVisibleParts(
  logged: ReadonlySet<string>,
  visibleKeys: readonly string[],
  fullKeys: readonly string[],
  fullStatus: (count: number) => HabitStatus | null,
): HabitStatus | null {
  const loggedVisible = visibleKeys.filter((key) => logged.has(key)).length;
  if (visibleKeys.length === fullKeys.length) return fullStatus(loggedVisible);
  if (visibleKeys.length === 0 || loggedVisible <= 0) return null;
  if (loggedVisible >= visibleKeys.length) return "yes";
  return "half";
}

export function mealStatusForVisible(
  logged: ReadonlySet<string>,
  hidden: readonly string[],
): HabitStatus | null {
  const hiddenSet = new Set(hidden);
  const visible = MEAL_PARTS.map((part) => part.key).filter((key) => !hiddenSet.has(key));
  return statusForVisibleParts(logged, visible, MEAL_PARTS.map((part) => part.key), mealStatusFor);
}

export function snackStatusForVisible(
  logged: ReadonlySet<string>,
  hidden: readonly string[],
): HabitStatus | null {
  const hiddenSet = new Set(hidden);
  const full = SNACK_SLOTS.map(String);
  const visible = full.filter((key) => !hiddenSet.has(key));
  return statusForVisibleParts(logged, visible, full, snackStatusFor);
}

export function intakeStatusForVisible(
  logged: ReadonlySet<string>,
  kinds: readonly string[],
): HabitStatus | null {
  if (kinds.length === 0) return null;
  return intakeStatusFor(
    kinds.filter((kind) => logged.has(kind)).length,
    kinds.length,
  );
}

export function smokeStatusForVisible(
  ctx: DailySmokeFreeContext,
  visible: SmokeFreeSubstance[],
): HabitStatus | null {
  if (visible.length === SMOKE_FREE_SUBSTANCES.length) {
    return smokeFreeStatusFor(ctx, false);
  }
  if (visible.length === 0) return null;
  const values = visible.map((key) => smokeFreeValueFor(ctx, key));
  if (!ctx.hasLog && values.every((value) => value == null)) return null;
  if (values.every((value) => value === "yes")) return "yes";
  if (values.every((value) => value === "no")) return "no";
  if (values.some((value) => value == null)) return null;
  return "half";
}

function mobileGameDone(ctx: DailyMobileGamesContext, key: MobileGameKey): boolean {
  if (key === "chess") return ctx.chess;
  if (key === "duolingo") return ctx.duolingo;
  return ctx.pokemonGo;
}

export function mobileGamesStatusForVisible(
  ctx: DailyMobileGamesContext,
  visible: MobileGameKey[],
): HabitStatus | null {
  if (visible.length === MOBILE_GAME_STEPS.length) {
    return mobileGamesStatusFor(ctx, false);
  }
  if (visible.length === 0) return null;
  const done = visible.filter((key) => mobileGameDone(ctx, key)).length;
  if (!ctx.hasLog && done === 0) return null;
  if (done >= visible.length) return "yes";
  if (done === 0) return "no";
  return "half";
}

export function isMealKey(value: string): value is MealKey {
  return value === "breakfast" || value === "lunch" || value === "dinner";
}
