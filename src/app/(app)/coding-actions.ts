"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export async function createCodingProjectAction(input: {
  title: string;
  description?: string;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv ett projektnamn." };
  if (title.length > 120) {
    return { ok: false, error: "Håll namnet under 120 tecken." };
  }
  const description = (input.description ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: last } = await supabase
    .from("coding_projects")
    .select("sort_order")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("coding_projects")
    .insert({
      user_id: user.id,
      title,
      description,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true, id: data.id };
}

export async function updateCodingProjectAction(input: {
  id: string;
  title: string;
  description?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar projekt." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv ett projektnamn." };
  if (title.length > 120) {
    return { ok: false, error: "Håll namnet under 120 tecken." };
  }
  const description = (input.description ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("coding_projects")
    .update({ title, description })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}

export async function archiveCodingProjectAction(input: {
  id: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar projekt." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("coding_projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
  return { ok: true };
}
