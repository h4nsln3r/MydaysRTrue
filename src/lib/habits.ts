// Client-safe habit types and helpers.
// Server-only queries live in `./habits.server`.

import type { IntakeKind } from "@/lib/intake";
import type { MoodKey } from "@/lib/mood";

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
}

/** Whether a habit should appear for this day given leave status. */
export function habitVisibleOnLeaveDay(
  habit: { showOnLeave: boolean },
  onLeave: boolean,
): boolean {
  if (!onLeave) return true;
  return habit.showOnLeave;
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
 *   3 → yes, 2 → half, 1 → no, 0 → no (per product spec).
 * For future days the caller should pass `null` instead of calling this.
 */
export function mealStatusFor(count: number): HabitStatus {
  if (count >= 3) return "yes";
  if (count >= 2) return "half";
  return "no";
}

/** Snack rollup: 2 = yes, 1 = half, 0 = no. */
export function snackStatusFor(count: number): HabitStatus {
  if (count >= 2) return "yes";
  if (count >= 1) return "half";
  return "no";
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
