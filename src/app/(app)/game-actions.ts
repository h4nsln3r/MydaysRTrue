"use server";

import { revalidatePath } from "next/cache";
import {
  GAME_KIND_ICON,
  isGameKind,
  type GameKind,
} from "@/lib/games";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function revalidateGames() {
  revalidatePath("/", "layout");
}

function parseGameFields(input: { title: string; kind?: string; icon?: string }):
  | { ok: true; title: string; kind: GameKind; icon: string }
  | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv vilket spel det är." };
  if (title.length > 80) {
    return { ok: false, error: "Håll spelnamnet under 80 tecken." };
  }

  const kindRaw = input.kind ?? "other";
  if (!isGameKind(kindRaw)) {
    return { ok: false, error: "Ogiltig spelkategori." };
  }

  const icon = (input.icon ?? "").trim() || GAME_KIND_ICON[kindRaw];
  if (icon.length > 8) {
    return { ok: false, error: "Håll ikonen kort." };
  }

  return { ok: true, title, kind: kindRaw, icon };
}

export async function createUserGameAction(input: {
  title: string;
  kind?: string;
  icon?: string;
}): Promise<ActionResult> {
  const parsed = parseGameFields(input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: last } = await supabase
    .from("user_games")
    .select("sort_order")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("user_games")
    .insert({
      user_id: user.id,
      title: parsed.title,
      kind: parsed.kind,
      icon: parsed.icon,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Du har redan ett spel med det namnet." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Kunde inte skapa spelet." };

  revalidateGames();
  return { ok: true, id: data.id };
}

export async function updateUserGameAction(input: {
  id: string;
  title: string;
  kind?: string;
  icon?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar spel-id." };
  const parsed = parseGameFields(input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("user_games")
    .update({
      title: parsed.title,
      kind: parsed.kind,
      icon: parsed.icon,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Du har redan ett spel med det namnet." };
    }
    return { ok: false, error: error.message };
  }

  revalidateGames();
  return { ok: true, id: input.id };
}

export async function archiveUserGameAction(input: {
  id: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar spel-id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("user_games")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidateGames();
  return { ok: true };
}
