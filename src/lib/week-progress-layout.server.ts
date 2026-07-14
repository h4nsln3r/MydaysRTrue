import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { WEEK_PROGRESS_HABIT_KEYS } from "@/lib/habits";
import {
  DEFAULT_WEEK_PROGRESS_LAYOUT,
  mergeWeekProgressLayout,
  sanitizeWeekProgressLayout,
  type WeekProgressLayout,
} from "@/lib/week-progress-layout";

export async function getWeekProgressLayout(
  userId: string,
  availableHabitKeys: string[] = [...WEEK_PROGRESS_HABIT_KEYS],
): Promise<WeekProgressLayout> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("week_progress_layout")
    .eq("id", userId)
    .maybeSingle();

  const saved = sanitizeWeekProgressLayout(
    data?.week_progress_layout,
    availableHabitKeys,
  );

  return (
    saved ??
    mergeWeekProgressLayout(DEFAULT_WEEK_PROGRESS_LAYOUT, availableHabitKeys)
  );
}

export async function saveWeekProgressLayout(
  userId: string,
  layout: WeekProgressLayout,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const normalized = sanitizeWeekProgressLayout(layout, [
    ...WEEK_PROGRESS_HABIT_KEYS,
  ]);
  if (!normalized) {
    return { ok: false, error: "Ogiltig layout." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ week_progress_layout: normalized as unknown as Json })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
