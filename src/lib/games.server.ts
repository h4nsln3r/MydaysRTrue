import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isGameKind,
  type GameKind,
  type UserGame,
} from "@/lib/games";

interface GameRow {
  id: string;
  key: string | null;
  title: string;
  kind: string;
  icon: string;
  sort_order: number;
}

export function rowToUserGame(r: GameRow): UserGame {
  const kind: GameKind = isGameKind(r.kind) ? r.kind : "other";
  return {
    id: r.id,
    key: r.key,
    title: r.title,
    kind,
    icon: r.icon?.trim() || "🎲",
    sortOrder: r.sort_order,
  };
}

export async function ensureDefaultUserGames(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_games")
    .select("id")
    .eq("user_id", userId)
    .eq("key", "dnd")
    .maybeSingle();
  if (existing) {
    await supabase
      .from("user_games")
      .update({ archived_at: null, title: "D&D", kind: "rpg", icon: "🐉" })
      .eq("id", existing.id)
      .eq("user_id", userId);
    return;
  }

  await supabase.from("user_games").insert({
    user_id: userId,
    key: "dnd",
    title: "D&D",
    kind: "rpg",
    icon: "🐉",
    sort_order: 0,
  });
}

export async function getUserGames(userId: string): Promise<UserGame[]> {
  const supabase = await createClient();
  await ensureDefaultUserGames(userId);
  const { data } = await supabase
    .from("user_games")
    .select("id, key, title, kind, icon, sort_order")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  return (data ?? []).map(rowToUserGame);
}
