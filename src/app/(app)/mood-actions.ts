"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMoodKey, type MoodKey } from "@/lib/mood";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveMoodDailyLogAction(input: {
  localDate: string;
  mood: MoodKey | null;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  if (input.mood !== null && !isMoodKey(input.mood)) {
    return { ok: false, error: "Ogiltig känsla." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  if (input.mood === null) {
    const { error } = await supabase
      .from("mood_daily_logs")
      .delete()
      .eq("user_id", user.id)
      .eq("local_date", input.localDate);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("mood_daily_logs").upsert(
      {
        user_id: user.id,
        local_date: input.localDate,
        mood: input.mood,
      },
      { onConflict: "user_id,local_date" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
