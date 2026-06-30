"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  addMealBoxStockEntry,
  deleteMealBoxStockEntry,
  setMealBoxStockRemaining,
} from "@/lib/meal-box.server";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateMealViews() {
  revalidatePath("/", "layout");
  revalidatePath("/profile/meal-boxes");
  revalidatePath("/week");
}

export async function setMealBoxStockRemainingAction(input: {
  stockId: string;
  remaining: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const result = await setMealBoxStockRemaining(
    user.id,
    input.stockId,
    input.remaining,
  );
  if (!result.ok) return result;

  revalidateMealViews();
  return { ok: true };
}

export async function addMealBoxStockAction(input: {
  description: string;
  remaining: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const result = await addMealBoxStockEntry(
    user.id,
    input.description,
    input.remaining,
  );
  if (!result.ok) return result;

  revalidateMealViews();
  return { ok: true };
}

export async function deleteMealBoxStockAction(
  stockId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const result = await deleteMealBoxStockEntry(user.id, stockId);
  if (!result.ok) return result;

  revalidateMealViews();
  return { ok: true };
}
