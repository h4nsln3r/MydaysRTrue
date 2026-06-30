import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MealKey, MealRestaurant } from "@/lib/habits";
import { MEAL_LABEL } from "@/lib/habits";

export interface RestaurantYearVisit {
  date: string;
  meal: MealKey;
  mealLabel: string;
  description: string;
}

export interface RestaurantYearEntry {
  id: string;
  name: string;
  visitCount: number;
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

/** Restaurant visits for a calendar year — grouped by restaurant. */
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
      "local_date, meal, description, restaurant_id, meal_restaurants(id, name)",
    )
    .eq("user_id", userId)
    .eq("cooked_by", "restaurant")
    .gte("local_date", start)
    .lte("local_date", end)
    .not("restaurant_id", "is", null)
    .order("local_date", { ascending: false });

  const grouped = new Map<string, RestaurantYearEntry>();

  for (const row of data ?? []) {
    const restaurant = row.meal_restaurants as { id: string; name: string } | null;
    if (!restaurant) continue;

    let entry = grouped.get(restaurant.id);
    if (!entry) {
      entry = {
        id: restaurant.id,
        name: restaurant.name,
        visitCount: 0,
        visits: [],
      };
      grouped.set(restaurant.id, entry);
    }

    const meal = row.meal as MealKey;
    entry.visits.push({
      date: row.local_date,
      meal,
      mealLabel: MEAL_LABEL[meal],
      description: row.description,
    });
    entry.visitCount += 1;
  }

  return [...grouped.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "sv"),
  );
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
