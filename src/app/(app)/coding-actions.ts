"use server";

import { revalidatePath } from "next/cache";
import {
  isCodingProjectStatus,
  normalizeOptionalUrl,
  parseCodingProjectDate,
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

function revalidateCoding() {
  revalidatePath("/", "layout");
  revalidatePath("/year", "page");
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

  revalidateCoding();
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

  revalidateCoding();
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

  revalidateCoding();
  return { ok: true };
}

/** Add the next version milestone (v1, v2, …) with a completion date. */
export async function addCodingProjectVersionAction(input: {
  projectId: string;
  completedOn: string;
}): Promise<ActionResult> {
  if (!input.projectId) return { ok: false, error: "Saknar projekt." };
  const date = parseCodingProjectDate(input.completedOn);
  if (!date.ok) return date;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: project } = await supabase
    .from("coding_projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!project) return { ok: false, error: "Projektet hittades inte." };

  const { data: last } = await supabase
    .from("coding_project_versions")
    .select("version_number")
    .eq("user_id", user.id)
    .eq("project_id", input.projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (last?.version_number ?? 0) + 1;
  if (nextVersion > 50) {
    return { ok: false, error: "Max 50 versioner per projekt." };
  }

  const { data, error } = await supabase
    .from("coding_project_versions")
    .insert({
      user_id: user.id,
      project_id: input.projectId,
      version_number: nextVersion,
      completed_on: date.date,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidateCoding();
  return { ok: true, id: data.id };
}

export async function updateCodingProjectVersionAction(input: {
  id: string;
  completedOn: string;
  note?: string | null;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar version." };
  const date = parseCodingProjectDate(input.completedOn);
  if (!date.ok) return date;

  const note = (input.note ?? "").trim();
  if (note.length > 280) {
    return { ok: false, error: "Håll kommentaren under 280 tecken." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("coding_project_versions")
    .update({
      completed_on: date.date,
      ...(input.note !== undefined ? { note: note || null } : {}),
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidateCoding();
  return { ok: true };
}

export async function deleteCodingProjectVersionAction(input: {
  id: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar version." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("coding_project_versions")
    .delete()
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidateCoding();
  return { ok: true };
}
