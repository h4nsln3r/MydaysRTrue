"use server";

import { createClient } from "@/lib/supabase/server";
import { getMealsInRange } from "@/lib/meal-box.server";
import {
  mealBoxesMade,
  mealsForCookSlice,
  type MealBoxMade,
  type MealCookSliceKey,
  type MealSliceEntry,
} from "@/lib/meal-month-summary";

const SLICE_KEYS: MealCookSliceKey[] = [
  "self",
  "julia",
  "restaurant",
  "meal_box",
  "bought",
  "other",
];

function isSlice(value: string): value is MealCookSliceKey {
  return (SLICE_KEYS as string[]).includes(value);
}

function monthEnd(monthStart: string): string | null {
  const match = /^(\d{4})-(\d{2})-01$/.exec(monthStart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthStart.slice(0, 8)}${String(last).padStart(2, "0")}`;
}

/** Meals behind one cook slice. Fetched when that slice is opened. */
export async function loadMealMonthSlice(
  monthStart: string,
  slice: MealCookSliceKey,
): Promise<
  | { ok: true; meals: MealSliceEntry[]; made: MealBoxMade[] }
  | { ok: false; error: string }
> {
  if (!isSlice(slice)) return { ok: false, error: "Ogiltigt val." };
  const end = monthEnd(monthStart);
  if (!end) return { ok: false, error: "Ogiltig månad." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { days } = await getMealsInRange(user.id, monthStart, end);
  return {
    ok: true,
    meals: mealsForCookSlice(days, slice),
    made: slice === "meal_box" ? mealBoxesMade(days) : [],
  };
}
