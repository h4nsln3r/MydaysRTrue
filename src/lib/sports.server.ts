import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_USER_SPORTS, type UserSport } from "@/lib/sports";

interface SportRow {
  id: string;
  key: string | null;
  title: string;
  icon: string;
  sort_order: number;
}

export function rowToUserSport(r: SportRow): UserSport {
  return {
    id: r.id,
    key: r.key,
    title: r.title,
    icon: r.icon?.trim() || "🏸",
    sortOrder: r.sort_order,
  };
}

export async function ensureDefaultUserSports(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_sports")
    .select("id, key")
    .eq("user_id", userId)
    .in(
      "key",
      DEFAULT_USER_SPORTS.map((s) => s.key),
    );

  const byKey = new Map(
    (existing ?? []).map((r) => [r.key, r.id] as const),
  );
  const toInsert: Array<{
    user_id: string;
    key: string;
    title: string;
    icon: string;
    sort_order: number;
  }> = [];

  for (const preset of DEFAULT_USER_SPORTS) {
    const id = byKey.get(preset.key);
    if (id) {
      await supabase
        .from("user_sports")
        .update({
          archived_at: null,
          title: preset.title,
          icon: preset.icon,
          sort_order: preset.sortOrder,
        })
        .eq("id", id)
        .eq("user_id", userId);
    } else {
      toInsert.push({
        user_id: userId,
        key: preset.key,
        title: preset.title,
        icon: preset.icon,
        sort_order: preset.sortOrder,
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("user_sports").insert(toInsert);
  }
}

export async function getUserSports(userId: string): Promise<UserSport[]> {
  const supabase = await createClient();
  await ensureDefaultUserSports(userId);
  const { data } = await supabase
    .from("user_sports")
    .select("id, key, title, icon, sort_order")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  return (data ?? []).map(rowToUserSport);
}
