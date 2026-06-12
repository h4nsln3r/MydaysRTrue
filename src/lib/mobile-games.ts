// Client-safe mobile games types and helpers.

import type { HabitStatus } from "@/lib/habits";

export type MobileGameKey = "chess" | "duolingo" | "pokemon_go";

export const MOBILE_GAME_STEPS: {
  key: MobileGameKey;
  label: string;
  icon: string;
}[] = [
  { key: "chess", label: "Chess", icon: "♟️" },
  { key: "duolingo", label: "Duolingo", icon: "🦉" },
  { key: "pokemon_go", label: "Pokemon GO", icon: "⚡" },
];

export interface DailyMobileGamesContext {
  localDate: string;
  chess: boolean;
  duolingo: boolean;
  pokemonGo: boolean;
  hasLog: boolean;
}

export function mobileGamesDoneCount(ctx: DailyMobileGamesContext): number {
  return Number(ctx.chess) + Number(ctx.duolingo) + Number(ctx.pokemonGo);
}

export function mobileGamesStatusFor(
  ctx: DailyMobileGamesContext,
  isFuture: boolean,
): HabitStatus | null {
  if (isFuture || !ctx.hasLog) return null;
  const done = mobileGamesDoneCount(ctx);
  if (done >= 3) return "yes";
  if (done >= 2) return "half";
  return "no";
}
