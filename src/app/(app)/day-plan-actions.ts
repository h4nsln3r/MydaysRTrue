"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveDailyPlanOrder } from "@/lib/day-plan.server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function reorderDayPlanAction(input: {
  localDate: string;
  orderedKeys: string[];
}): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }
  if (!input.orderedKeys.length) {
    return { ok: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const result = await saveDailyPlanOrder(
    user.id,
    input.localDate,
    input.orderedKeys,
  );
  if (!result.ok) return result;

  revalidatePath("/", "layout");
  return { ok: true };
}
