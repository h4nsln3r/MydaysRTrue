import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DailyMobileGamesContext } from "@/lib/mobile-games";

export async function getDailyMobileGames(
  userId: string,
  localDate: string,
): Promise<DailyMobileGamesContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mobile_game_daily_logs")
    .select("chess_done, duolingo_done, pokemon_go_done")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();

  return {
    localDate,
    chess: data?.chess_done ?? false,
    duolingo: data?.duolingo_done ?? false,
    pokemonGo: data?.pokemon_go_done ?? false,
    hasLog: Boolean(data),
  };
}
