import { DayPlanPanel } from "@/components/DayPlanPanel/DayPlanPanel";
import { getAuthUser } from "@/lib/auth.server";
import { getDayPlanSettings } from "@/lib/habits.server";
import { getCategories } from "@/lib/tasks.server";

export async function DayPlanSettingsSection() {
  const user = await getAuthUser();
  const [dayPlan, categories] = await Promise.all([
    getDayPlanSettings(user.id),
    getCategories(user.id),
  ]);

  return (
    <DayPlanPanel
      habits={dayPlan.habits}
      goals={dayPlan.goals}
      categories={categories}
    />
  );
}
