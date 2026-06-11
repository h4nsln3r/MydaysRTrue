import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { getHabits } from "@/lib/habits.server";
import { getCardioTemplates } from "@/lib/cardio.server";
import { getGymTemplates } from "@/lib/gym.server";
import {
  getCategories,
  getMonthlyTasks,
  getWeeklyTasks,
} from "@/lib/tasks.server";
import { getWeightDefaultWeekday } from "@/lib/weight.server";
import { ProfileForm } from "./ProfileForm";
import { SignOutButton } from "./SignOutButton";
import { HabitsManager } from "./HabitsManager";
import { CategoryEditor } from "./CategoryEditor";
import { WeeklyDefaultsEditor } from "./WeeklyDefaultsEditor";
import { WeeklyTasksEditor } from "./WeeklyTasksEditor";
import { MonthlyTasksEditor } from "./MonthlyTasksEditor";
import styles from "./profile.module.scss";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    habits,
    dailyCategories,
    weeklyCategories,
    monthlyCategories,
    weeklyTasks,
    monthlyTasks,
    gymTemplates,
    cardioTemplates,
    weightDefaultWeekday,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, daily_water_goal_ml")
      .eq("id", user.id)
      .maybeSingle(),
    getHabits(user.id),
    getCategories(user.id, "daily"),
    getCategories(user.id, "weekly"),
    getCategories(user.id, "monthly"),
    getWeeklyTasks(user.id),
    getMonthlyTasks(user.id),
    getGymTemplates(user.id),
    getCardioTemplates(user.id),
    getWeightDefaultWeekday(user.id),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Profile</p>
        <h1 className={styles.title}>
          {profile?.display_name || user.email?.split("@")[0] || "You"}
        </h1>
        <p className={styles.email}>{user.email}</p>
      </header>

      <Card accent>
        <ProfileForm
          initialDisplayName={profile?.display_name ?? ""}
          initialDailyGoalMl={profile?.daily_water_goal_ml ?? 2500}
        />
      </Card>

      <Card>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Daily</p>
            <h3 className={styles.h3}>Habits & categories</h3>
            <p className={styles.muted}>
              Things you check off each day, optionally grouped.
            </p>
          </div>
        </header>
        <div className={styles.stack}>
          <HabitsManager habits={habits} categories={dailyCategories} />
          <CategoryEditor scope="daily" categories={dailyCategories} />
        </div>
      </Card>

      <Card>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Weekly</p>
            <h3 className={styles.h3}>Tasks & categories</h3>
            <p className={styles.muted}>
              Mallar du placerar på dagar i veckovyn — sätt standarddag per aktivitet.
            </p>
          </div>
        </header>
        <div className={styles.stack}>
          <WeeklyDefaultsEditor
            gymTemplates={gymTemplates}
            cardioTemplates={cardioTemplates}
            weeklyTasks={weeklyTasks}
            weightDefaultWeekday={weightDefaultWeekday}
          />
          <WeeklyTasksEditor tasks={weeklyTasks} categories={weeklyCategories} />
          <CategoryEditor scope="weekly" categories={weeklyCategories} />
        </div>
      </Card>

      <Card>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Monthly</p>
            <h3 className={styles.h3}>Tasks & categories</h3>
            <p className={styles.muted}>
              Things you do once a month, with an optional reminder day.
            </p>
          </div>
        </header>
        <div className={styles.stack}>
          <MonthlyTasksEditor
            tasks={monthlyTasks}
            categories={monthlyCategories}
          />
          <CategoryEditor scope="monthly" categories={monthlyCategories} />
        </div>
      </Card>

      <Card>
        <div className={styles.signoutWrap}>
          <div>
            <h3 className={styles.h3}>Sign out</h3>
            <p className={styles.muted}>End your session on this device.</p>
          </div>
          <SignOutButton />
        </div>
      </Card>
    </main>
  );
}
