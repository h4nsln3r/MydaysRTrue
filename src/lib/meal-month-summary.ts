import type { DailySnacks, MealEntry, MealKey } from "@/lib/habits";
import { MEAL_COOKED_BY_LABEL, MEAL_ORDER } from "@/lib/habits";

/** One day of logged meals. Matches the meal range used on the month page. */
export interface MealMonthDay {
  date: string;
  meals: Record<MealKey, MealEntry | null>;
  snacks: DailySnacks;
  boxesProduced: number;
}

export interface MealSliceEntry {
  date: string;
  meal: MealKey;
  description: string;
  /** Restaurant, or who cooked, when that is separate from the dish. */
  detail: string | null;
  rating: number | null;
}

/** Meal-prep boxes cooked in the month, summed per person and dish. */
export interface MealBoxMade {
  cook: string;
  description: string;
  count: number;
}

export type MealCookSliceKey =
  | "self"
  | "julia"
  | "restaurant"
  | "meal_box"
  | "bought"
  | "other";

export interface MealCookSlice {
  key: MealCookSliceKey;
  label: string;
  count: number;
}

export interface MealMonthDishStat {
  name: string;
  count: number;
  /** Set when the dish was rated at least twice. */
  averageRating: number | null;
}

export interface MealMonthBest {
  rating: number;
  names: string[];
  /** Names beyond the ones listed, when many dishes share the top score. */
  extra: number;
  /** Set when a single dish owns the top score and every log was the same slot. */
  where: string | null;
}

export interface MealMonthSummaryModel {
  mealCount: number;
  snackCount: number;
  uniqueDishCount: number;
  byMeal: Record<MealKey, number>;
  cook: MealCookSlice[];
  cookTotal: number;
  /** Named dishes eaten at least twice, most frequent first. */
  repeatedDishes: MealMonthDishStat[];
  /** The only named dish this month, including when it was eaten once. */
  onlyDish: string | null;
  best: MealMonthBest | null;
  eatOutCount: number;
  restaurants: MealMonthDishStat[];
  boxesProduced: number;
  boxesEaten: number;
  topSnack: MealMonthDishStat | null;
  /** Most common drink, when it was logged at least twice. */
  topDrink: MealMonthDishStat | null;
  otherCooks: MealMonthDishStat[];
}

const COOK_SLICES: { key: MealCookSliceKey; label: string }[] = [
  { key: "self", label: "Jag" },
  { key: "julia", label: "Julia" },
  { key: "restaurant", label: "Ute" },
  { key: "meal_box", label: "Matlåda" },
  { key: "bought", label: "Köpt hem" },
  { key: "other", label: "Annan" },
];

const WHERE_LABEL: Record<MealKey | "snack", string> = {
  breakfast: "frukost",
  lunch: "lunch",
  dinner: "middag",
  snack: "mellanmål",
};

interface Bucket {
  variants: Map<string, number>;
  count: number;
  ratingSum: number;
  ratingCount: number;
}

function emptyBucket(): Bucket {
  return {
    variants: new Map(),
    count: 0,
    ratingSum: 0,
    ratingCount: 0,
  };
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function touch(map: Map<string, Bucket>, raw: string, rating: number | null) {
  const name = normalizeName(raw);
  const key = name.toLocaleLowerCase("sv-SE");
  if (!key) return;
  const bucket = map.get(key) ?? emptyBucket();
  bucket.variants.set(name, (bucket.variants.get(name) ?? 0) + 1);
  bucket.count += 1;
  if (rating != null && rating > 0) {
    bucket.ratingSum += rating;
    bucket.ratingCount += 1;
  }
  map.set(key, bucket);
}

function displayName(bucket: Bucket): string {
  let best = "";
  let bestCount = -1;
  for (const [name, count] of bucket.variants) {
    if (
      count > bestCount ||
      (count === bestCount && name.localeCompare(best, "sv") < 0)
    ) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function toStats(map: Map<string, Bucket>): MealMonthDishStat[] {
  return [...map.values()]
    .map((bucket) => ({
      name: displayName(bucket),
      count: bucket.count,
      averageRating:
        bucket.ratingCount >= 2
          ? bucket.ratingSum / bucket.ratingCount
          : null,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const left = a.averageRating ?? -1;
      const right = b.averageRating ?? -1;
      if (right !== left) return right - left;
      return a.name.localeCompare(b.name, "sv");
    });
}

/**
 * Place name when a free-text "who cooked" note is really eating out.
 * The restaurant category is not required — "Resturang i Kyoto" counts.
 * A person's name, or food at someone's home, returns null.
 */
export function eatingOutPlace(note: string | null | undefined): string | null {
  const name = normalizeName(note ?? "");
  if (!name) return null;
  const key = name.toLocaleLowerCase("sv-SE");
  if (HOME_MEAL_RE.test(key) && !EATING_OUT_RE.test(key)) return null;
  if (!EATING_OUT_RE.test(key)) return null;
  return name;
}

const EATING_OUT_RE =
  /rest\w*rang|restaurant|pizzeria|pizza på|burger king|taco bell|mcdonald|\bkfc\b|food ?court|belt sushi|caf[eé]|kaf[eé]|krog|\bbistro\b|l[åa]ngos|på flyget|flygplats|\bkastrup\b|blir serverad|\bkedja\b|vagnen/;

const HOME_MEAL_RE =
  /\b(hemma|hos|mamma|pappa|mor och far|föräldr|jag lagade|jag och)\b/;

function cookSlice(entry: MealEntry): MealCookSliceKey | null {
  if (entry.meal !== "lunch" && entry.meal !== "dinner") return null;
  if (entry.fromMealBox || entry.cookedBy === "meal_box") return "meal_box";
  if (entry.cookedBy === "other" && eatingOutPlace(entry.cookedByName)) {
    return "restaurant";
  }
  switch (entry.cookedBy) {
    case "self":
    case "julia":
    case "restaurant":
    case "bought":
    case "other":
      return entry.cookedBy;
    default:
      return null;
  }
}

function eatOutPlaceName(entry: MealEntry): string | null {
  if (entry.cookedBy === "restaurant") return entry.restaurantName;
  return eatingOutPlace(entry.cookedByName);
}

/** Lunch and dinner in one cook slice, in date order. Matches the month bar. */
export function mealsForCookSlice(
  days: MealMonthDay[],
  key: MealCookSliceKey,
): MealSliceEntry[] {
  const meals: MealSliceEntry[] = [];
  for (const day of days) {
    for (const mealKey of MEAL_ORDER) {
      const entry = day.meals[mealKey];
      if (!entry || cookSlice(entry) !== key) continue;
      const detail =
        key === "restaurant"
          ? eatOutPlaceName(entry)
          : key === "other"
            ? normalizeName(entry.cookedByName ?? "") || null
            : null;
      meals.push({
        date: day.date,
        meal: mealKey,
        description: normalizeName(entry.description),
        detail,
        rating: entry.rating != null && entry.rating > 0 ? entry.rating : null,
      });
    }
  }
  return meals;
}

const MADE_COOK_ORDER = ["Jag", "Julia", "Köpt hem", "Annan"];

function batchCook(entry: MealEntry): string {
  if (entry.cookedBy === "other") {
    return normalizeName(entry.cookedByName ?? "") || MEAL_COOKED_BY_LABEL.other;
  }
  if (entry.cookedBy === "restaurant" && entry.restaurantName?.trim()) {
    return entry.restaurantName.trim();
  }
  if (entry.cookedBy && entry.cookedBy !== "meal_box") {
    return MEAL_COOKED_BY_LABEL[entry.cookedBy];
  }
  return "Annan";
}

/** Boxes produced while cooking, not the meals later eaten from the stock. */
export function mealBoxesMade(days: MealMonthDay[]): MealBoxMade[] {
  const grouped = new Map<string, MealBoxMade>();
  for (const day of days) {
    for (const mealKey of MEAL_ORDER) {
      const entry = day.meals[mealKey];
      if (!entry || entry.fromMealBox) continue;
      const count = entry.mealBoxes ?? 0;
      if (count <= 0) continue;
      const cook = batchCook(entry);
      const description = normalizeName(entry.description) || "Matlåda";
      const key = `${cook.toLocaleLowerCase("sv-SE")}\0${description.toLocaleLowerCase("sv-SE")}`;
      const prev = grouped.get(key);
      if (prev) prev.count += count;
      else grouped.set(key, { cook, description, count });
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const aRank = MADE_COOK_ORDER.indexOf(a.cook);
    const bRank = MADE_COOK_ORDER.indexOf(b.cook);
    const aOrder = aRank === -1 ? MADE_COOK_ORDER.length : aRank;
    const bOrder = bRank === -1 ? MADE_COOK_ORDER.length : bRank;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.cook !== b.cook) return a.cook.localeCompare(b.cook, "sv");
    if (b.count !== a.count) return b.count - a.count;
    return a.description.localeCompare(b.description, "sv");
  });
}

export function buildMealMonthSummary(days: MealMonthDay[]): MealMonthSummaryModel {
  const byMeal: Record<MealKey, number> = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
  };
  const cookCounts: Record<MealCookSliceKey, number> = {
    self: 0,
    julia: 0,
    restaurant: 0,
    meal_box: 0,
    bought: 0,
    other: 0,
  };
  const dishes = new Map<string, Bucket>();
  const restaurants = new Map<string, Bucket>();
  const snacks = new Map<string, Bucket>();
  const drinks = new Map<string, Bucket>();
  const otherCooks = new Map<string, Bucket>();
  const rated: { name: string; rating: number; where: string }[] = [];

  let mealCount = 0;
  let snackCount = 0;
  let eatOutCount = 0;
  let boxesEaten = 0;
  let boxesProduced = 0;

  for (const day of days) {
    boxesProduced += day.boxesProduced;

    for (const mealKey of MEAL_ORDER) {
      const entry = day.meals[mealKey];
      if (!entry) continue;
      mealCount += 1;
      byMeal[mealKey] += 1;
      if (entry.fromMealBox || entry.cookedBy === "meal_box") boxesEaten += 1;

      const slice = cookSlice(entry);
      if (slice) cookCounts[slice] += 1;
      if (slice === "restaurant") {
        eatOutCount += 1;
        const place = eatOutPlaceName(entry);
        if (place) touch(restaurants, place, null);
      }
      if (slice === "other" && entry.cookedByName) {
        touch(otherCooks, entry.cookedByName, null);
      }

      touch(dishes, entry.description, entry.rating);
      if (entry.drinkNote) touch(drinks, entry.drinkNote, null);
      const dishName = normalizeName(entry.description);
      if (entry.rating != null && entry.rating > 0 && dishName) {
        rated.push({
          name: dishName,
          rating: entry.rating,
          where: WHERE_LABEL[mealKey],
        });
      }
    }

    for (const snack of [day.snacks[1], day.snacks[2]]) {
      if (!snack) continue;
      snackCount += 1;
      touch(snacks, snack.description, snack.rating);
      if (snack.drinkNote) touch(drinks, snack.drinkNote, null);
      const snackName = normalizeName(snack.description);
      if (snack.rating != null && snack.rating > 0 && snackName) {
        rated.push({
          name: snackName,
          rating: snack.rating,
          where: WHERE_LABEL.snack,
        });
      }
    }
  }

  const dishStats = toStats(dishes);
  const repeatedDishes = dishStats.filter((dish) => dish.count >= 2);
  const drinkStats = toStats(drinks);
  const topDrink = drinkStats[0] && drinkStats[0].count >= 2 ? drinkStats[0] : null;
  const snackStats = toStats(snacks);

  return {
    mealCount,
    snackCount,
    uniqueDishCount: dishStats.length,
    byMeal,
    cook: COOK_SLICES.map((slice) => ({
      ...slice,
      count: cookCounts[slice.key],
    })).filter((slice) => slice.count > 0),
    cookTotal: COOK_SLICES.reduce((sum, slice) => sum + cookCounts[slice.key], 0),
    repeatedDishes,
    onlyDish: dishStats.length === 1 ? dishStats[0]!.name : null,
    best: bestRating(rated),
    eatOutCount,
    restaurants: toStats(restaurants),
    boxesProduced,
    boxesEaten,
    topSnack: snackStats[0] ?? null,
    topDrink,
    otherCooks: toStats(otherCooks),
  };
}

function bestRating(
  rated: { name: string; rating: number; where: string }[],
): MealMonthBest | null {
  if (rated.length === 0) return null;
  const rating = Math.max(...rated.map((item) => item.rating));
  const tops = rated.filter((item) => item.rating === rating);

  const seen = new Map<string, { name: string; wheres: Set<string> }>();
  for (const item of tops) {
    const key = item.name.toLocaleLowerCase("sv-SE");
    const prev = seen.get(key);
    if (prev) prev.wheres.add(item.where);
    else seen.set(key, { name: item.name, wheres: new Set([item.where]) });
  }

  const unique = [...seen.values()];
  const listed = unique.slice(0, 3);
  const wheres = listed.length === 1 ? [...listed[0]!.wheres] : [];

  return {
    rating,
    names: listed.map((item) => item.name),
    extra: Math.max(0, unique.length - listed.length),
    where: wheres.length === 1 ? wheres[0]! : null,
  };
}
