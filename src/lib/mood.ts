// Client-safe mood types and helpers.

import type { HabitStatus } from "@/lib/habits";

export type MoodKey = "angry" | "sad" | "stressed" | "tired" | "happy" | "joyful";

export const MOOD_OPTIONS: {
  key: MoodKey;
  label: string;
  icon: string;
}[] = [
  { key: "angry", label: "Arg", icon: "😠" },
  { key: "sad", label: "Ledsen", icon: "😢" },
  { key: "stressed", label: "Stressad", icon: "😰" },
  { key: "tired", label: "Trött", icon: "😴" },
  { key: "happy", label: "Glad", icon: "😊" },
  { key: "joyful", label: "Lycklig", icon: "🥳" },
];

export const MOOD_LABEL: Record<MoodKey, string> = Object.fromEntries(
  MOOD_OPTIONS.map((o) => [o.key, o.label]),
) as Record<MoodKey, string>;

export const MOOD_ICON: Record<MoodKey, string> = Object.fromEntries(
  MOOD_OPTIONS.map((o) => [o.key, o.icon]),
) as Record<MoodKey, string>;

export interface DailyMoodContext {
  localDate: string;
  mood: MoodKey | null;
}

export function isMoodKey(value: string): value is MoodKey {
  return MOOD_OPTIONS.some((o) => o.key === value);
}

export function moodStatusFor(
  ctx: DailyMoodContext,
  isFuture: boolean,
): HabitStatus | null {
  if (isFuture || !ctx.mood) return null;
  if (ctx.mood === "happy" || ctx.mood === "joyful") return "yes";
  if (ctx.mood === "tired") return "half";
  return "no";
}
