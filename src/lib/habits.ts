// Client-safe habit types and helpers.
// Server-only queries live in `./habits.server`.

import { diffDaysISO, isoWeekdayFromLocalISO } from "@/lib/date";
import type { IntakeKind } from "@/lib/intake";
import type { MoodKey } from "@/lib/mood";
import { WEEKDAY_SHORT, type Weekday } from "@/lib/tasks";

/** Per-day sub-item data for expandable week progress rows. */
export interface WeekHabitDayDetails {
  water?: { totalMl: number; goalMl: number };
  intake?: Partial<Record<IntakeKind, boolean>>;
  mobileGames?: { chess: boolean; duolingo: boolean; pokemonGo: boolean };
  smokeFree?: { nicotine: HabitStatus | null; cannabis: HabitStatus | null };
  steps?: { value: number; goal: number };
  activity?: { value: number; goal: number };
  sugarFree?: HabitStatus | null;
}

export type HabitKind =
  | "tri_state"
  | "water"
  | "meal"
  | "snack"
  | "intake"
  | "steps"
  | "activity_hours"
  | "media"
  | "live"
  | "mobile_games"
  | "mood"
  | "smoke_free";

/** Habit keys shown in the week progress board. */
export const WEEK_PROGRESS_HABIT_KEYS = [
  "meals",
  "intake",
  "steps",
  "activity_hours",
  "smoke_free",
  "sugar_free",
  "mobile_games",
  "media",
  "mood",
] as const;

export type SnackSlot = 1 | 2;

export const SNACK_SLOTS: SnackSlot[] = [1, 2];
export const SNACK_LABEL: Record<SnackSlot, string> = {
  1: "Mellanmål 1",
  2: "Mellanmål 2",
};
export const SNACK_ICON: Record<SnackSlot, string> = {
  1: "🍎",
  2: "🥜",
};
export type HabitStatus = "yes" | "half" | "no";

export type MealKey = "breakfast" | "lunch" | "dinner";

export const MEAL_ORDER: MealKey[] = ["breakfast", "lunch", "dinner"];
export const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};
export const MEAL_ICON: Record<MealKey, string> = {
  breakfast: "🌅",
  lunch: "🥗",
  dinner: "🍽",
};

export type MealCookedBy =
  | "self"
  | "julia"
  | "restaurant"
  | "other"
  | "bought"
  | "meal_box";

export const MEAL_COOKED_BY_ORDER: MealCookedBy[] = [
  "self",
  "julia",
  "restaurant",
  "other",
  "bought",
  "meal_box",
];
export const MEAL_COOKED_BY_LABEL: Record<MealCookedBy, string> = {
  self: "Jag",
  julia: "Julia",
  restaurant: "Restaurang",
  other: "Annan",
  bought: "Köpt hem",
  meal_box: "Matlåda",
};

export interface MealRestaurant {
  id: string;
  name: string;
}

export interface MealBoxStockItem {
  id: string;
  description: string;
  remaining: number;
}

/** Human-readable label for who prepared lunch/dinner. */
export function mealCookedByDisplay(
  cookedBy: MealCookedBy | null,
  restaurantName: string | null = null,
  cookedByName: string | null = null,
): string | null {
  if (!cookedBy) return null;
  if (cookedBy === "meal_box") return MEAL_COOKED_BY_LABEL.meal_box;
  if (cookedBy === "restaurant" && restaurantName?.trim()) {
    return restaurantName.trim();
  }
  if (cookedBy === "other" && cookedByName?.trim()) {
    return cookedByName.trim();
  }
  return MEAL_COOKED_BY_LABEL[cookedBy];
}

/** Meal-prep boxes count — when cooking, not when eating a matlåda. */
export function mealShowsMealBoxes(cookedBy: MealCookedBy | null): boolean {
  return cookedBy !== null && cookedBy !== "meal_box";
}

/** Lunch and dinner track who cooked and optional meal-prep boxes. */
export function mealHasCookingMeta(meal: MealKey): boolean {
  return meal === "lunch" || meal === "dinner";
}

export interface Habit {
  id: string;
  key: string;
  label: string;
  kind: HabitKind;
  icon: string;
  accent: string;
  sortOrder: number;
  /** Optional daily-scope category id. */
  categoryId: string | null;
  /** When false the tracker is hidden from daily progress views. */
  enabled: boolean;
  /** When false the tracker is hidden on leave/vacation days. */
  showOnLeave: boolean;
  /** 1 = every day; 2 = every other day from the anchor date. */
  intervalDays: number;
  /** First occurrence when intervalDays > 1. */
  intervalAnchorDate: string | null;
  /** ISO weekdays (1=Mon … 7=Sun). Empty = every day (unless interval applies). */
  weekdays: Weekday[];
}

export interface HabitIntervalRule {
  intervalDays: number;
  intervalAnchorDate: string | null;
  weekdays: Weekday[];
}

/** Whether a habit should appear for this day given leave status. */
export function habitVisibleOnLeaveDay(
  habit: { showOnLeave: boolean },
  onLeave: boolean,
): boolean {
  if (!onLeave) return true;
  return habit.showOnLeave;
}

/**
 * Whether a daily habit is due on `localDate`.
 * Selected weekdays win. Otherwise interval 1 is every day, and interval 2+
 * repeats every N calendar days from the anchor.
 */
export function habitOccursOnDate(
  habit: HabitIntervalRule,
  localDate: string,
): boolean {
  if (habit.weekdays.length > 0) {
    const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
    return habit.weekdays.includes(weekday);
  }
  const interval = Math.max(1, Math.round(habit.intervalDays || 1));
  if (interval <= 1) return true;
  const anchor = habit.intervalAnchorDate;
  if (!anchor || localDate < anchor) return false;
  const delta = diffDaysISO(anchor, localDate);
  return delta % interval === 0;
}

/** Short Swedish cadence for settings and day-plan hints. */
export function habitCadenceLabel(habit: HabitIntervalRule): string | null {
  if (habit.weekdays.length > 0) {
    return habit.weekdays.map((d) => WEEKDAY_SHORT[d]).join(" · ");
  }
  if (habit.intervalDays === 2) return "Varannan dag";
  if (habit.intervalDays > 2) return `Var ${habit.intervalDays}:e dag`;
  return null;
}

export function parseHabitWeekdays(raw: number[] | null | undefined): Weekday[] {
  if (!raw || raw.length === 0) return [];
  const seen = new Set<Weekday>();
  for (const value of raw) {
    const n = Math.round(Number(value));
    if (n >= 1 && n <= 7) seen.add(n as Weekday);
  }
  return [...seen].sort((a, b) => a - b);
}

export interface DailyHabit extends Habit {
  /** null = no entry yet (tri-state) OR nothing logged (water/meals). */
  status: HabitStatus | null;
  note: string | null;
  /** Water only — total drunk on the day. */
  waterMl?: number;
  /** Water only — the day's goal. */
  goalMl?: number;
  /** Water only — 0..(>1) fraction toward goal. */
  progress?: number;
  /** Meals only — how many of the 3 slots have been logged. */
  mealsLogged?: number;
  /** Steps / activity — logged value for the day. */
  metricValue?: number;
  /** Steps / activity — daily goal from profile. */
  metricGoal?: number;
  /** Snacks — how many of 2 slots are logged. */
  snacksDone?: number;
  /** Intake — how many applicable kinds are logged. */
  intakeLogged?: number;
  /** Intake — applicable kinds for the day (weekday-only kinds excluded on weekends). */
  intakeTotal?: number;
  /** Mood — selected feeling for the day. */
  moodKey?: MoodKey | null;
}

export interface SnackEntry {
  id: string;
  slot: SnackSlot;
  description: string;
}

export type DailySnacks = Record<SnackSlot, SnackEntry | null>;

export interface MealEntry {
  id: string;
  meal: MealKey;
  description: string;
  waterMl: number; // 0 if no water logged with the meal
  waterLogId: string | null;
  /** Who prepared lunch/dinner — null for breakfast or legacy rows. */
  cookedBy: MealCookedBy | null;
  /** Saved restaurant when cooked_by is restaurant. */
  restaurantId: string | null;
  restaurantName: string | null;
  /** Free-text name when cooked_by is other. */
  cookedByName: string | null;
  /** Meal-prep boxes made when cooking — lunch/dinner only. */
  mealBoxes: number | null;
  /** Logged by eating from meal-prep inventory. */
  fromMealBox: boolean;
  /** Stock row consumed when fromMealBox is true. */
  mealBoxStockId: string | null;
}

/**
 * Derive a tri-state status from a water amount + goal.
 * `null` means "no entry" — we don't paint anything for those days.
 */
export function waterStatusFor(totalMl: number, goalMl: number): HabitStatus | null {
  return numericGoalStatus(totalMl, goalMl);
}

/** Ratio above a numeric goal that counts as crushing it. */
export const GOAL_EXCEED_RATIO = 1.25;

/** True when the logged value is well above the daily goal. */
export function goalExceeded(
  current: number,
  goal: number,
  ratio = GOAL_EXCEED_RATIO,
): boolean {
  if (current <= 0 || goal <= 0) return false;
  return current >= goal * ratio;
}

/** Derive yes/half/no from a numeric value vs a daily goal. */
export function numericGoalStatus(
  current: number,
  goal: number,
): HabitStatus | null {
  if (current <= 0 || goal <= 0) return null;
  if (current >= goal) return "yes";
  if (current >= goal * 0.5) return "half";
  return "no";
}

/** Points toward a habit summary: Ja = 1, ½ = 0.5, else 0. */
export function habitStatusPoints(
  status: HabitStatus | null | undefined,
): number {
  if (status === "yes") return 1;
  if (status === "half") return 0.5;
  return 0;
}

/** Format hit counts that may include half-points (e.g. 3.5). */
export function formatHabitPoints(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Unfilled tracker on a past day counts as missed; today and future stay open. */
export function statusOrMissedOnPastDay(
  status: HabitStatus | null,
  day: { isFuture: boolean; isToday: boolean },
): HabitStatus | null {
  if (day.isFuture || day.isToday) return status;
  return status ?? "no";
}

/**
 * Derive meal status from the number of logged meals (0..3).
 *   3 → yes, 2 → half, 1 → no (started, not complete), 0 → null (not filled in).
 * For future days the caller should pass `null` instead of calling this.
 */
export function mealStatusFor(count: number): HabitStatus | null {
  if (count <= 0) return null;
  if (count >= 3) return "yes";
  if (count >= 2) return "half";
  return "no";
}

/** Snack rollup: 2 = yes, 1 = half (started), 0 = null (not filled in). */
export function snackStatusFor(count: number): HabitStatus | null {
  if (count <= 0) return null;
  if (count >= 2) return "yes";
  return "half";
}

/** Cycles yes → half → no → null → yes when the same button is tapped repeatedly. */
export function nextHabitStatus(
  current: HabitStatus | null,
  pressed: HabitStatus,
): HabitStatus | null {
  return current === pressed ? null : pressed;
}

/** User has logged or answered — not necessarily yes / goal met. */
export function isDailyHabitFilledIn(habit: DailyHabit): boolean {
  switch (habit.kind) {
    case "meal":
      return (habit.mealsLogged ?? 0) > 0;
    case "snack":
      return (habit.snacksDone ?? 0) > 0;
    case "intake":
      return (habit.intakeLogged ?? 0) > 0;
    case "water":
      return (habit.waterMl ?? 0) > 0;
    case "mood":
      return habit.moodKey != null;
    default:
      return habit.status !== null;
  }
}

/** Steps, habits, media, etc. — unfilled first, then sort_order. */
export function sortOtherDailyTrackersIncompleteFirst(
  habits: DailyHabit[],
): DailyHabit[] {
  return [...habits].sort((a, b) => {
    const aFilled = isDailyHabitFilledIn(a);
    const bFilled = isDailyHabitFilledIn(b);
    if (aFilled !== bFilled) return aFilled ? 1 : -1;
    return a.sortOrder - b.sortOrder;
  });
}
