import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDailyPlanOrder(
  userId: string,
  localDate: string,
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_plan_orders")
    .select("item_key, sort_order")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("sort_order", { ascending: true });

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.item_key, row.sort_order);
  }
  return map;
}

export async function saveDailyPlanOrder(
  userId: string,
  localDate: string,
  orderedKeys: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("daily_plan_orders")
    .delete()
    .eq("user_id", userId)
    .eq("local_date", localDate);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (orderedKeys.length === 0) return { ok: true };

  const rows = orderedKeys.map((item_key, sort_order) => ({
    user_id: userId,
    local_date: localDate,
    item_key,
    sort_order,
  }));

  const { error: insertError } = await supabase
    .from("daily_plan_orders")
    .insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true };
}

/**
 * Put a plan row first in the day's saved order.
 * No-op when the day has no custom order (default ranks / day_sort_order apply).
 */
export async function prependDailyPlanItem(
  userId: string,
  localDate: string,
  itemKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getDailyPlanOrder(userId, localDate);
  if (existing.size === 0) return { ok: true };

  const rest = [...existing.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key)
    .filter((key) => key !== itemKey);

  return saveDailyPlanOrder(userId, localDate, [itemKey, ...rest]);
}
