import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isCodingProjectStatus,
  type CodingProject,
  type CodingProjectStatus,
} from "@/lib/coding";

interface CodingProjectRow {
  id: string;
  title: string;
  description: string | null;
  github_url: string | null;
  live_url: string | null;
  is_live: boolean;
  status: string;
  sort_order: number;
}

function rowToProject(r: CodingProjectRow): CodingProject {
  const status: CodingProjectStatus = isCodingProjectStatus(r.status)
    ? r.status
    : "active";
  return {
    id: r.id,
    title: r.title,
    description: r.description?.trim() ? r.description.trim() : null,
    githubUrl: r.github_url,
    liveUrl: r.live_url,
    isLive: Boolean(r.is_live),
    status,
    sortOrder: r.sort_order,
  };
}

export async function getCodingProjects(
  userId: string,
): Promise<CodingProject[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coding_projects")
    .select(
      "id, title, description, github_url, live_url, is_live, status, sort_order",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  return (data ?? []).map(rowToProject);
}
