import type { MealKey } from "@/lib/habits";
import { formatMl } from "@/lib/water";

export const FOOD_RATING_MIN = 1;
export const FOOD_RATING_MAX = 10;
export const DRINK_NOTE_MAX = 80;

export const MEAL_WATER_LABEL: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
};

export function foodWaterNote(label: string, drinkNote: string | null): string {
  const drink = drinkNote?.trim() ?? "";
  return drink ? `${label} · ${drink}` : label;
}

export function parseFoodDrink(
  waterMl: string,
  drinkNote: string,
):
  | { ok: true; waterMl: number; drinkNote: string | null }
  | { ok: false; error: string } {
  const parsed = waterMl.trim() === "" ? 0 : Number(waterMl);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: "Drycken måste vara ett positivt tal." };
  }
  const rounded = Math.round(parsed);
  if (rounded > 5000) {
    return { ok: false, error: "Max 5000 ml per dryck." };
  }
  const note = drinkNote.trim();
  if (note.length > DRINK_NOTE_MAX) {
    return { ok: false, error: "Håll drycken under 80 tecken." };
  }
  return { ok: true, waterMl: rounded, drinkNote: note || null };
}

export function parseFoodRating(
  rating: string,
): { ok: true; rating: number | null } | { ok: false; error: string } {
  if (rating.trim() === "") return { ok: true, rating: null };
  const value = Number(rating);
  if (
    !Number.isInteger(value) ||
    value < FOOD_RATING_MIN ||
    value > FOOD_RATING_MAX
  ) {
    return { ok: false, error: "Betyget ska vara 1–10." };
  }
  return { ok: true, rating: value };
}

export function foodDrinkSummary(
  waterMl: number,
  drinkNote: string | null,
): string | null {
  const drink = drinkNote?.trim() ?? "";
  if (waterMl > 0 && drink) return `${formatMl(waterMl)} ${drink}`;
  if (waterMl > 0) return formatMl(waterMl);
  if (drink) return drink;
  return null;
}

export function foodRatingLabel(rating: number | null): string | null {
  if (rating == null) return null;
  return `${rating}/10`;
}
