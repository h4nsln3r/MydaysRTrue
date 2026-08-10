import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CodingProject } from "@/lib/coding";

interface CodingProjectRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

function rowToProject(r: CodingProjectRow): CodingProject {
  return {
    id: r.id,
    title: r.title,
    description: r.description?.trim() ? r.description.trim() : null,
    sortOrder: r.sort_order,
  };
}

export async function getCodingProjects(
  userId: string,
): Promise<CodingProject[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coding_projects")
    .select("id, title, description, sort_order")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  return (data ?? []).map(rowToProject);
}
