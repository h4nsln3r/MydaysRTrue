import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isCodingProjectStatus,
  type CodingProject,
  type CodingProjectStatus,
  type CodingProjectVersion,
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

interface CodingProjectVersionRow {
  id: string;
  project_id: string;
  version_number: number;
  completed_on: string;
  note: string | null;
}

function rowToVersion(r: CodingProjectVersionRow): CodingProjectVersion {
  return {
    id: r.id,
    versionNumber: r.version_number,
    completedOn: r.completed_on,
    note: r.note?.trim() ? r.note.trim() : null,
  };
}

function rowToProject(
  r: CodingProjectRow,
  versions: CodingProjectVersion[],
): CodingProject {
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
    versions,
    sortOrder: r.sort_order,
  };
}

export async function getCodingProjects(
  userId: string,
): Promise<CodingProject[]> {
  const supabase = await createClient();
  const [{ data: projects }, { data: versions }] = await Promise.all([
    supabase
      .from("coding_projects")
      .select(
        "id, title, description, github_url, live_url, is_live, status, sort_order",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true }),
    supabase
      .from("coding_project_versions")
      .select("id, project_id, version_number, completed_on, note")
      .eq("user_id", userId)
      .order("version_number", { ascending: true }),
  ]);

  const versionsByProject = new Map<string, CodingProjectVersion[]>();
  for (const row of versions ?? []) {
    const list = versionsByProject.get(row.project_id) ?? [];
    list.push(rowToVersion(row));
    versionsByProject.set(row.project_id, list);
  }

  return (projects ?? []).map((p) =>
    rowToProject(p, versionsByProject.get(p.id) ?? []),
  );
}
