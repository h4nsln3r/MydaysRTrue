"use server";

import { revalidatePath } from "next/cache";
import {
  isCodingProjectStatus,
  normalizeOptionalUrl,
  type CodingProjectStatus,
} from "@/lib/coding";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function parseProjectFields(input: {
  title: string;
  description?: string;
  githubUrl?: string;
  liveUrl?: string;
  isLive?: boolean;
  status?: string;
}):
  | {
      ok: true;
      title: string;
      description: string | null;
      githubUrl: string | null;
      liveUrl: string | null;
      isLive: boolean;
      status: CodingProjectStatus;
    }
  | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Skriv ett projektnamn." };
  if (title.length > 120) {
    return { ok: false, error: "Håll namnet under 120 tecken." };
  }

  const description = (input.description ?? "").trim().slice(0, 500) || null;

  const github = normalizeOptionalUrl(input.githubUrl);
  if (!github.ok) return { ok: false, error: `GitHub: ${github.error}` };

  const live = normalizeOptionalUrl(input.liveUrl);
  if (!live.ok) return { ok: false, error: `Live-sida: ${live.error}` };

  const statusRaw = input.status ?? "active";
  if (!isCodingProjectStatus(statusRaw)) {
    return { ok: false, error: "Ogiltig status." };
  }

  return {
    ok: true,
    title,
    description,
    githubUrl: github.url,
    liveUrl: live.url,
    isLive: Boolean(input.isLive) && live.url != null,
    status: statusRaw,
  };
}

export async function createCodingProjectAction(input: {
  title: string;
  description?: string;
  githubUrl?: string;
  liveUrl?: string;
  isLive?: boolean;
  status?: string;
}): Promise<ActionResult> {
  const parsed = parseProjectFields(input);
  if (!parsed.ok) return parsed;

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
      title: parsed.title,
      description: parsed.description,
      github_url: parsed.githubUrl,
      live_url: parsed.liveUrl,
      is_live: parsed.isLive,
      status: parsed.status,
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
  githubUrl?: string;
  liveUrl?: string;
  isLive?: boolean;
  status?: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar projekt." };

  const parsed = parseProjectFields(input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("coding_projects")
    .update({
      title: parsed.title,
      description: parsed.description,
      github_url: parsed.githubUrl,
      live_url: parsed.liveUrl,
      is_live: parsed.isLive,
      status: parsed.status,
    })
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
