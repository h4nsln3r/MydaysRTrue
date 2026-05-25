"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LogWaterResult {
  ok: boolean;
  error?: string;
  totalMl?: number;
}

export async function logWaterAction(input: {
  amountMl: number;
  localDate: string;
  note?: string;
}): Promise<LogWaterResult> {
  const amount = Math.round(Number(input.amountMl));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a positive amount." };
  }
  if (amount > 5000) {
    return { ok: false, error: "That's a lot. Max 5000 ml per entry." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) {
    return { ok: false, error: "Invalid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("water_logs").insert({
    user_id: user.id,
    amount_ml: amount,
    local_date: input.localDate,
    note: input.note?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateWaterLogAction(input: {
  id: string;
  amountMl: number;
  note?: string;
}): Promise<LogWaterResult> {
  const amount = Math.round(Number(input.amountMl));

  if (!input.id) return { ok: false, error: "Missing entry id." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a positive amount." };
  }
  if (amount > 5000) {
    return { ok: false, error: "That's a lot. Max 5000 ml per entry." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("water_logs")
    .update({
      amount_ml: amount,
      note: input.note?.trim() || null,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteWaterLogAction(id: string): Promise<LogWaterResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("water_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
