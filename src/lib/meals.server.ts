import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MealKey, MealPlan, MealRestaurant } from "@/lib/habits";
import { MEAL_LABEL } from "@/lib/habits";
import { eatingOutPlace } from "@/lib/meal-month-summary";

export interface RestaurantYearVisit {
  date: string;
  meal: MealKey;
  mealLabel: string;
  description: string;
  rating: number | null;
}

export interface RestaurantYearEntry {
  id: string;
  name: string;
  visitCount: number;
  ratingCount: number;
  /** Null when no visit was rated. */
  averageRating: number | null;
  visits: RestaurantYearVisit[];
}

/** Saved restaurants for quick re-selection when logging meals. */
export async function getMealRestaurants(userId: string): Promise<MealRestaurant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_restaurants")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}

/** Restaurant visits for a calendar year — grouped by place. */
export async function getYearRestaurantMeals(
  userId: string,
  year: number,
): Promise<RestaurantYearEntry[]> {
  const supabase = await createClient();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data } = await supabase
    .from("meal_entries")
    .select(
      "local_date, meal, description, rating, cooked_by, cooked_by_name, meal_restaurants(id, name)",
    )
    .eq("user_id", userId)
    .in("cooked_by", ["restaurant", "other"])
    .gte("local_date", start)
    .lte("local_date", end)
    .order("local_date", { ascending: false });

  const grouped = new Map<
    string,
    RestaurantYearEntry & { ratingSum: number }
  >();

  for (const row of data ?? []) {
    const place = restaurantPlace(row);
    if (!place) continue;

    let entry = grouped.get(place.id);
    if (!entry) {
      entry = {
        id: place.id,
        name: place.name,
        visitCount: 0,
        ratingCount: 0,
        ratingSum: 0,
        averageRating: null,
        visits: [],
      };
      grouped.set(place.id, entry);
    }

    const meal = row.meal as MealKey;
    const rating = row.rating != null && row.rating > 0 ? row.rating : null;
    entry.visits.push({
      date: row.local_date,
      meal,
      mealLabel: MEAL_LABEL[meal],
      description: row.description,
      rating,
    });
    entry.visitCount += 1;
    if (rating != null) {
      entry.ratingSum += rating;
      entry.ratingCount += 1;
    }
  }

  return [...grouped.values()]
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      visitCount: entry.visitCount,
      ratingCount: entry.ratingCount,
      averageRating:
        entry.ratingCount > 0 ? entry.ratingSum / entry.ratingCount : null,
      visits: entry.visits,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

function restaurantPlace(row: {
  cooked_by: string | null;
  cooked_by_name: string | null;
  meal_restaurants: { id: string; name: string } | { id: string; name: string }[] | null;
}): { id: string; name: string } | null {
  const saved = Array.isArray(row.meal_restaurants)
    ? row.meal_restaurants[0] ?? null
    : row.meal_restaurants;
  if (row.cooked_by === "restaurant" && saved) {
    return { id: saved.id, name: saved.name };
  }
  if (row.cooked_by !== "other") return null;
  const place = eatingOutPlace(row.cooked_by_name);
  if (!place) return null;
  return { id: `place:${place.toLocaleLowerCase("sv-SE")}`, name: place };
}

/** Planning notes for breakfast, lunch and dinner on one day. */
export async function getDailyMealPlans(
  userId: string,
  localDate: string,
): Promise<Record<MealKey, MealPlan | null>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plans")
    .select("meal, note, cooks_self")
    .eq("user_id", userId)
    .eq("local_date", localDate);

  const out: Record<MealKey, MealPlan | null> = {
    breakfast: null,
    lunch: null,
    dinner: null,
  };
  for (const row of data ?? []) {
    const meal = row.meal as MealKey;
    if (out[meal] === undefined) continue;
    out[meal] = {
      note: row.note?.trim() ? row.note.trim() : null,
      cooksSelf: row.cooks_self,
    };
  }
  return out;
}

/** Find or create a restaurant row for the user (case-insensitive name). */
export async function resolveMealRestaurant(
  userId: string,
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Skriv restaurangens namn." };
  if (trimmed.length > 120) {
    return { ok: false, error: "Restaurangnamnet får vara max 120 tecken." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("meal_restaurants")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .maybeSingle();

  if (existing) return { ok: true, id: existing.id };

  const { data: inserted, error } = await supabase
    .from("meal_restaurants")
    .insert({ user_id: userId, name: trimmed })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Kunde inte spara restaurangen." };
  }

  return { ok: true, id: inserted.id };
}
