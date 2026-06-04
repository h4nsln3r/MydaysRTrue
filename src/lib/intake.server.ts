import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IntakeEntry, IntakeKind } from "@/lib/intake";

/**
 * Fetch the user's intake entries for a single day, normalised to the four
 * fixed slots. Missing kinds are returned as null so the UI can render a
 * "tap to log" placeholder. The linked water amount (creatine) is resolved
 * by joining against `water_logs` in a second query — same pattern as
 * `getDailyMeals`.
 */
export async function getDailyIntake(
  userId: string,
  localDate: string,
): Promise<Record<IntakeKind, IntakeEntry | null>> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("intake_entries")
    .select("id, kind, description, water_log_id")
    .eq("user_id", userId)
    .eq("local_date", localDate);

  const waterIds = (rows ?? [])
    .map((r) => r.water_log_id)
    .filter((v): v is string => Boolean(v));

  const waterMap = new Map<string, number>();
  if (waterIds.length > 0) {
    const { data: logs } = await supabase
      .from("water_logs")
      .select("id, amount_ml")
      .in("id", waterIds);
    for (const l of logs ?? []) waterMap.set(l.id, l.amount_ml);
  }

  const out: Record<IntakeKind, IntakeEntry | null> = {
    fruit: null,
    creatine: null,
    vitamin: null,
    shake: null,
  };
  for (const r of rows ?? []) {
    out[r.kind] = {
      id: r.id,
      kind: r.kind,
      description: r.description,
      waterMl: r.water_log_id ? waterMap.get(r.water_log_id) ?? 0 : 0,
      waterLogId: r.water_log_id,
    };
  }
  return out;
}
