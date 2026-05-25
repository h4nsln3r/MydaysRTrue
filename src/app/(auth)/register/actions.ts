"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RegisterFormState {
  error?: string;
  message?: string;
}

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || undefined },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is required, no session is returned.
  if (!data.session) {
    return {
      message:
        "Check your email to confirm your account. Once confirmed, you can sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
