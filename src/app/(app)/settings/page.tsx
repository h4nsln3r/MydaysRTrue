import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { createClient } from "@/lib/supabase/server";
import { getHabits } from "@/lib/habits.server";
import { getCardioTemplates } from "@/lib/cardio.server";
import { getSportTemplates } from "@/lib/sport.server";
import { getGymTemplates } from "@/lib/gym.server";
import {
  getCategories,
  getMonthlyTasks,
  getWeeklyTasks,
} from "@/lib/tasks.server";
import { getWeightDefaultWeekday } from "@/lib/weight.server";
import { HabitsManager } from "../profile/HabitsManager";
import { CategoryEditor } from "../profile/CategoryEditor";
import { WeeklyDefaultsEditor } from "../profile/WeeklyDefaultsEditor";
import { WeeklyTasksEditor } from "../profile/WeeklyTasksEditor";
import { MonthlyTasksEditor } from "../profile/MonthlyTasksEditor";
import styles from "../profile/profile.module.scss";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    habits,
    dailyCategories,
    taskCategories,
    weeklyTasks,
    monthlyTasks,
    gymTemplates,
    cardioTemplates,
    sportTemplates,
    weightDefaultWeekday,
  ] = await Promise.all([
    getHabits(user.id),
    getCategories(user.id, "daily"),
    getCategories(user.id, "task"),
    getWeeklyTasks(user.id),
    getMonthlyTasks(user.id),
    getGymTemplates(user.id),
    getCardioTemplates(user.id),
    getSportTemplates(user.id),
    getWeightDefaultWeekday(user.id),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Settings</p>
        <h1 className={styles.title}>Inställningar</h1>
        <p className={styles.muted}>
          Vanor, kategorier, mallar och annat du styr appen med.
        </p>
      </header>

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
            <p className={styles.cardEyebrow}>Mat</p>
            <h3 className={styles.h3}>Matlådor</h3>
            <p className={styles.muted}>
              Justera vad som finns kvar i kylen eller lägg till nya rätter.
            </p>
          </div>
        </header>
        <div className={styles.stack}>
          <Link href="/profile/meal-boxes" className={styles.tasksOverviewLink}>
            <span className={styles.tasksOverviewText}>
              <span className={styles.tasksOverviewTitle}>
                Hantera matlådor i kylen
              </span>
              <span className={styles.muted}>
                Sätt antal kvar, ta bort gamla eller lägg till manuellt.
              </span>
            </span>
            <span className={styles.tasksOverviewArrow} aria-hidden>
              →
            </span>
          </Link>
        </div>
      </Card>

      <Card>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Vecka & månad</p>
            <h3 className={styles.h3}>Kategorier</h3>
            <p className={styles.muted}>
              Delade kategorier — samma uppsättning används av både vecko- och
              månadsuppgifter.
            </p>
          </div>
        </header>
        <div className={styles.stack}>
          <CategoryEditor scope="task" categories={taskCategories} />
          <Link href="/profile/tasks" className={styles.tasksOverviewLink}>
            <span className={styles.tasksOverviewText}>
              <span className={styles.tasksOverviewTitle}>
                Uppgifter per kategori
              </span>
              <span className={styles.muted}>
                Vecko- och månadsuppgifter samlade — slå av eller på permanenta
                mallar.
              </span>
            </span>
            <span className={styles.tasksOverviewArrow} aria-hidden>
              →
            </span>
          </Link>
        </div>
      </Card>

      <Card>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Weekly</p>
            <h3 className={styles.h3}>Veckomallar</h3>
            <p className={styles.muted}>
              Permanenta mallar du placerar i veckovyn. Engångsuppgifter skapas
              via «Lägg till uppgift» i veckoplanen.
            </p>
          </div>
        </header>
        <div className={styles.stack}>
          <WeeklyDefaultsEditor
            gymTemplates={gymTemplates}
            cardioTemplates={cardioTemplates}
            sportTemplates={sportTemplates}
            weeklyTasks={weeklyTasks}
            taskCategories={taskCategories}
            weightDefaultWeekday={weightDefaultWeekday}
          />
          <WeeklyTasksEditor tasks={weeklyTasks} categories={taskCategories} />
        </div>
      </Card>

      <Card>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Monthly</p>
            <h3 className={styles.h3}>Månadsmallar</h3>
            <p className={styles.muted}>
              Permanenta månadsuppgifter med valfri standarddag. Engångsuppgifter
              skapas i månadsvyn.
            </p>
          </div>
        </header>
        <div className={styles.stack}>
          <MonthlyTasksEditor tasks={monthlyTasks} categories={taskCategories} />
        </div>
      </Card>
    </main>
  );
}
