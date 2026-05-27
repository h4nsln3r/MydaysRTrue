// Client-safe habit types and helpers.
// Server-only queries live in `./habits.server`.

export type HabitKind = "tri_state" | "water" | "meal";
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
}

export interface MealEntry {
  id: string;
  meal: MealKey;
  description: string;
  waterMl: number; // 0 if no water logged with the meal
  waterLogId: string | null;
}

/**
 * Derive a tri-state status from a water amount + goal.
 * `null` means "no entry" — we don't paint anything for those days.
 */
export function waterStatusFor(totalMl: number, goalMl: number): HabitStatus | null {
  if (totalMl <= 0 || goalMl <= 0) return null;
  if (totalMl >= goalMl) return "yes";
  if (totalMl >= goalMl * 0.5) return "half";
  return "no";
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

/** Cycles yes → half → no → null → yes when the same button is tapped repeatedly. */
export function nextHabitStatus(
  current: HabitStatus | null,
  pressed: HabitStatus,
): HabitStatus | null {
  return current === pressed ? null : pressed;
}
