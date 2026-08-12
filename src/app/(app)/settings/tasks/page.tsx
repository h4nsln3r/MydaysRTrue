import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHabits } from "@/lib/habits.server";
import {
  getCategories,
  getMonthlyTasks,
  getWeeklyTasks,
} from "@/lib/tasks.server";
import { TaskSettingsClient } from "./TaskSettingsClient";

export const dynamic = "force-dynamic";

export default async function TaskSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [habits, dailyCategories, taskCategories, weeklyTasks, monthlyTasks] =
    await Promise.all([
      getHabits(user.id),
      getCategories(user.id, "daily"),
      getCategories(user.id, "task"),
      getWeeklyTasks(user.id),
      getMonthlyTasks(user.id),
    ]);

  return (
    <main>
      <TaskSettingsClient
        habits={habits}
        dailyCategories={dailyCategories}
        weeklyTasks={weeklyTasks}
        monthlyTasks={monthlyTasks}
        taskCategories={taskCategories}
      />
    </main>
  );
}
