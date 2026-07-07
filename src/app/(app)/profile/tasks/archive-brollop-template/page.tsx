import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** One-time cleanup: archive recurring wedding-money task wrongly saved as a template. */
export default async function ArchiveBrollopTemplatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("weekly_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("archived_at", null)
    .is("single_week_start", null)
    .or("title.ilike.%bröloppspengar%,title.ilike.%bröllopspengar%");

  revalidatePath("/", "layout");
  redirect("/profile/tasks");
}
