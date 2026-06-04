"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  INTAKE_HAS_WATER,
  INTAKE_LABEL,
  INTAKE_REQUIRES_DESCRIPTION,
  type IntakeKind,
} from "@/lib/intake";

interface ActionResult {
  ok: boolean;
  error?: string;
}

const VALID_KINDS: ReadonlySet<IntakeKind> = new Set([
  "fruit",
  "creatine",
  "vitamin",
  "shake",
]);

/**
 * Upsert an intake entry for (date, kind). For kinds that accept a water
 * amount (currently `creatine`), a linked `water_logs` row is created /
 * updated / removed in lockstep so the same liquid only has to be typed
 * once and still shows up in the user's water totals.
 */
export async function saveIntakeAction(input: {
  kind: IntakeKind;
  localDate: string;
  description?: string;
  waterMl?: number;
}): Promise<ActionResult> {
  if (!VALID_KINDS.has(input.kind)) {
    return { ok: false, error: "Invalid intake type." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Invalid date." };
  }

  const description = (input.description ?? "").trim();
  if (INTAKE_REQUIRES_DESCRIPTION[input.kind] && !description) {
    return { ok: false, error: "Please add a description." };
  }
  if (description.length > 280) {
    return { ok: false, error: "Keep it under 280 characters." };
  }

  const supportsWater = INTAKE_HAS_WATER[input.kind];
  const waterMlRaw = input.waterMl ?? 0;
  if (!Number.isFinite(waterMlRaw) || waterMlRaw < 0) {
    return { ok: false, error: "Water can't be negative." };
  }
  const waterMl = supportsWater ? Math.round(waterMlRaw) : 0;
  if (waterMl > 5000) {
    return { ok: false, error: "Max 5000 ml per entry." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Look up the existing entry so we can keep its linked water_log in sync.
  const { data: existing, error: lookupErr } = await supabase
    .from("intake_entries")
    .select("id, water_log_id")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .eq("kind", input.kind)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };

  let waterLogId: string | null = existing?.water_log_id ?? null;
  if (waterMl > 0) {
    if (waterLogId) {
      const { error } = await supabase
        .from("water_logs")
        .update({
          amount_ml: waterMl,
          note: INTAKE_LABEL[input.kind],
          local_date: input.localDate,
        })
        .eq("id", waterLogId)
        .eq("user_id", user.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: inserted, error } = await supabase
        .from("water_logs")
        .insert({
          user_id: user.id,
          amount_ml: waterMl,
          local_date: input.localDate,
          note: INTAKE_LABEL[input.kind],
        })
        .select("id")
        .single();
      if (error || !inserted) {
        return { ok: false, error: error?.message ?? "Could not save water." };
      }
      waterLogId = inserted.id;
    }
  } else if (waterLogId) {
    // User cleared the water on this intake — remove the linked log too.
    await supabase
      .from("water_logs")
      .delete()
      .eq("id", waterLogId)
      .eq("user_id", user.id);
    waterLogId = null;
  }

  if (existing) {
    const { error } = await supabase
      .from("intake_entries")
      .update({
        description,
        water_log_id: waterLogId,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("intake_entries").insert({
      user_id: user.id,
      local_date: input.localDate,
      kind: input.kind,
      description,
      water_log_id: waterLogId,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Remove an intake entry. Any linked `water_logs` row is removed too,
 * matching the meal behaviour — the user implicitly logged that liquid
 * as part of the intake.
 */
export async function clearIntakeAction(input: {
  kind: IntakeKind;
  localDate: string;
}): Promise<ActionResult> {
  if (!VALID_KINDS.has(input.kind)) {
    return { ok: false, error: "Invalid intake type." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Invalid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("intake_entries")
    .select("id, water_log_id")
    .eq("user_id", user.id)
    .eq("local_date", input.localDate)
    .eq("kind", input.kind)
    .maybeSingle();

  if (!existing) return { ok: true };

  if (existing.water_log_id) {
    await supabase
      .from("water_logs")
      .delete()
      .eq("id", existing.water_log_id)
      .eq("user_id", user.id);
  }

  const { error } = await supabase
    .from("intake_entries")
    .delete()
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
