import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isMoodKey, type DailyMoodContext, type MoodKey } from "@/lib/mood";

export async function getDailyMood(
  userId: string,
  localDate: string,
): Promise<DailyMoodContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mood_daily_logs")
    .select("mood")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();

  const mood =
    data?.mood && isMoodKey(data.mood) ? (data.mood as MoodKey) : null;

  return {
    localDate,
    mood,
  };
}
