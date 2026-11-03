import { MEAL_ORDER, SNACK_SLOTS, type MealKey, type SnackSlot } from "@/lib/habits";
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

export const FOOD_CALORIES_MAX = 20_000;
export const FOOD_PROTEIN_MAX = 1_000;

export function foodMacroInput(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

/** Empty is allowed. A filled value must be a non-negative integer within the max. */
export function parseFoodMacros(
  calories: string,
  protein: string,
):
  | { ok: true; calories: number | null; proteinG: number | null }
  | { ok: false; error: string } {
  const caloriesParsed = parseOptionalFoodInt(
    calories,
    "Kalorier",
    FOOD_CALORIES_MAX,
    "kcal",
  );
  if (!caloriesParsed.ok) return caloriesParsed;
  const proteinParsed = parseOptionalFoodInt(
    protein,
    "Protein",
    FOOD_PROTEIN_MAX,
    "g",
  );
  if (!proteinParsed.ok) return proteinParsed;
  return {
    ok: true,
    calories: caloriesParsed.value,
    proteinG: proteinParsed.value,
  };
}

export function foodMacroLabel(
  calories: number | null | undefined,
  proteinG: number | null | undefined,
  style: "full" | "compact" = "full",
): string | null {
  const parts: string[] = [];
  if (calories != null) parts.push(`${formatMacroNumber(calories)} kcal`);
  if (proteinG != null) {
    parts.push(
      style === "compact"
        ? `${formatMacroNumber(proteinG)} g`
        : `${formatMacroNumber(proteinG)} g protein`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface DayFoodTotals {
  calories: number | null;
  proteinG: number | null;
  /** Logged meals and snacks where both fields were left empty. */
  missing: number;
  label: string;
  compact: string;
}

/** Sum of whatever was filled in. Logged rows with neither number stay out of the total. */
export function dayFoodTotals(
  meals:
    | Partial<
        Record<MealKey, { calories: number | null; proteinG: number | null } | null>
      >
    | null
    | undefined,
  snacks:
    | Partial<
        Record<SnackSlot, { calories: number | null; proteinG: number | null } | null>
      >
    | null
    | undefined,
  extras?: Array<{ calories: number | null; proteinG: number | null } | null> | null,
): DayFoodTotals | null {
  const entries = [
    ...MEAL_ORDER.map((key) => meals?.[key] ?? null),
    ...SNACK_SLOTS.map((slot) => snacks?.[slot] ?? null),
    ...(extras ?? []),
  ].filter(
    (entry): entry is { calories: number | null; proteinG: number | null } =>
      entry != null,
  );

  let calories = 0;
  let protein = 0;
  let hasCalories = false;
  let hasProtein = false;
  let missing = 0;
  for (const entry of entries) {
    if (entry.calories == null && entry.proteinG == null) {
      missing += 1;
      continue;
    }
    if (entry.calories != null) {
      calories += entry.calories;
      hasCalories = true;
    }
    if (entry.proteinG != null) {
      protein += entry.proteinG;
      hasProtein = true;
    }
  }

  const calorieValue = hasCalories ? calories : null;
  const proteinValue = hasProtein ? protein : null;
  const label = foodMacroLabel(calorieValue, proteinValue, "full");
  if (!label) return null;
  return {
    calories: calorieValue,
    proteinG: proteinValue,
    missing,
    label,
    compact: foodMacroLabel(calorieValue, proteinValue, "compact") ?? label,
  };
}

function parseOptionalFoodInt(
  raw: string,
  label: string,
  max: number,
  unit: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return { ok: true, value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: `${label} måste vara 0 eller mer.` };
  }
  const rounded = Math.round(value);
  if (rounded > max) {
    return {
      ok: false,
      error: `${label} kan vara max ${max.toLocaleString("sv-SE")} ${unit}.`,
    };
  }
  return { ok: true, value: rounded };
}

function formatMacroNumber(value: number): string {
  return value.toLocaleString("sv-SE");
}
