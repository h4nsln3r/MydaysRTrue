"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HabitStatus } from "@/lib/habits";
import type { SmokeFreeSubstance } from "@/lib/smoke-free";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS = new Set<HabitStatus | null>(["yes", "half", "no", null]);

export async function saveSmokeFreeDailyLogAction(input: {
  localDate: string;
  substance: SmokeFreeSubstance;
  status: HabitStatus | null;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (!VALID_STATUS.has(input.status)) {
    return { ok: false, error: "Ogiltig status." };
  }
  if (input.substance !== "nicotine" && input.substance !== "cannabis") {
    return { ok: false, error: "Ogiltig substans." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: existing } = await supabase
    .from("smoke_free_daily_logs")
    .select("nicotine_status, cannabis_status")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .maybeSingle();

  const nicotine =
    input.substance === "nicotine"
      ? input.status
      : (existing?.nicotine_status as HabitStatus | null) ?? null;
  const cannabis =
    input.substance === "cannabis"
      ? input.status
      : (existing?.cannabis_status as HabitStatus | null) ?? null;

  if (nicotine === null && cannabis === null) {
    const { error } = await supabase
      .from("smoke_free_daily_logs")
      .delete()
      .eq("user_id", user.id)
      .eq("local_date", input.localDate);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("smoke_free_daily_logs").upsert(
      {
        user_id: user.id,
        local_date: input.localDate,
        nicotine_status: nicotine,
        cannabis_status: cannabis,
      },
      { onConflict: "user_id,local_date" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
