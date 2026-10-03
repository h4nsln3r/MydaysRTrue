import "server-only";
import { getBathingTemplates } from "@/lib/bathing.server";
import { getCardioTemplates } from "@/lib/cardio.server";
import type { DayQuickAddSources } from "@/lib/day-quick-add";
import { getGymTemplates } from "@/lib/gym.server";
import { getSportTemplates } from "@/lib/sport.server";
import { createClient } from "@/lib/supabase/server";

/** Templates the day plus-button can drop onto a weekday. */
export async function getDayQuickAddSources(
  userId: string,
): Promise<DayQuickAddSources> {
  const supabase = await createClient();
  const [gym, cardio, sport, bathing, shakeResult] = await Promise.all([
    getGymTemplates(userId),
    getCardioTemplates(userId),
    getSportTemplates(userId),
    getBathingTemplates(userId),
    supabase
      .from("habits")
      .select("id, label, icon")
      .eq("user_id", userId)
      .eq("key", "gor_shake")
      .eq("enabled", true)
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  const cardioTemplate =
    cardio.find((t) => t.key === "cardio") ?? cardio[0] ?? null;
  const sportTemplate = sport.find((t) => t.key === "sport") ?? sport[0] ?? null;
  const shake = shakeResult.data;

  return {
    gym: gym.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
    cardioTemplateId: cardioTemplate?.id ?? null,
    sportTemplateId: sportTemplate?.id ?? null,
    baths: bathing
      .filter((t) => t.key === "bad")
      .map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
    shake: shake
      ? { habitId: shake.id, label: shake.label, icon: shake.icon }
      : null,
  };
}
