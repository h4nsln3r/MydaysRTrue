"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveMobileGamesDailyLogAction(input: {
  localDate: string;
  chess: boolean;
  duolingo: boolean;
  pokemonGo: boolean;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase.from("mobile_game_daily_logs").upsert(
    {
      user_id: user.id,
      local_date: input.localDate,
      chess_done: input.chess,
      duolingo_done: input.duolingo,
      pokemon_go_done: input.pokemonGo,
    },
    { onConflict: "user_id,local_date" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
