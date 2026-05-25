"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  error?: string;
  message?: string;
}

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const goalRaw = Number(formData.get("dailyWaterGoalMl") ?? "0");

  if (!Number.isFinite(goalRaw) || goalRaw < 250 || goalRaw > 20000) {
    return { error: "Daily goal must be between 250 and 20000 ml." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName || null,
        daily_water_goal_ml: Math.round(goalRaw),
      },
      { onConflict: "id" },
    );

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { message: "Saved." };
}
