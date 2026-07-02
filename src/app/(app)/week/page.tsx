import { getAuthUser } from "@/lib/auth.server";

import { getWeekHabitSummary } from "@/lib/habits.server";

import { getWeeklySummary } from "@/lib/water.server";

import { getWeekSummary, getMonthlyBillsForWeek } from "@/lib/tasks.server";

import { getBathingWeekSummary } from "@/lib/bathing.server";

import { getCardioWeekSummary } from "@/lib/cardio.server";

import { getSportWeekSummary } from "@/lib/sport.server";

import { getGymWeekSummary } from "@/lib/gym.server";

import { getWeightWeekPlan } from "@/lib/weight.server";

import { getWeekJournalSummary } from "@/lib/journal.server";

import { getWorkLogsForWeek } from "@/lib/work.server";

import { getUnifiedWeekPlan } from "@/lib/week-plan.server";
import { getWeekMealsSummary } from "@/lib/meal-box.server";

import {
  addDaysISO,
  formatWeekLabel,
  parseLocalISO,
  todayLocalISO,
  weekStartISO,
} from "@/lib/date";

import { UnifiedWeekBoard } from "./UnifiedWeekBoard";

import { WeekProgressBoard } from "./WeekProgressBoard";

import { WeekMealsBoard } from "./WeekMealsBoard";

import { WeekViewTabs } from "./WeekViewTabs";

import { WeekNav } from "@/components/WeekNav/WeekNav";

import styles from "./week.module.scss";

export const dynamic = "force-dynamic";

interface WeekPageProps {
  searchParams: Promise<{ start?: string; view?: string }>;
}

function parseView(raw: string | undefined): "progress" | "plan" {
  return raw === "plan" ? "plan" : "progress";
}

export default async function WeekPage({ searchParams }: WeekPageProps) {
  const user = await getAuthUser();

  const params = await searchParams;
  const today = todayLocalISO();
  const currentWeekStart = weekStartISO();
  const view = parseView(params.view);

  const requested =
    params.start && /^\d{4}-\d{2}-\d{2}$/.test(params.start)
      ? weekStartISO(parseLocalISO(params.start))
      : currentWeekStart;

  const nextWeekStart = addDaysISO(currentWeekStart, 7);
  const start =
    requested > nextWeekStart ? nextWeekStart : requested;

  const [
    week,
    habitWeek,
    weeklyTasks,
    monthlyBillsWeek,
    gymWeek,
    cardioWeek,
    sportWeek,
    bathingWeek,
    weightPlan,
    unifiedPlan,
    mealsWeek,
  ] = await Promise.all([
    getWeeklySummary(user.id, start),
    getWeekHabitSummary(user.id, start),
    getWeekSummary(user.id, start),
    getMonthlyBillsForWeek(user.id, start),
    getGymWeekSummary(user.id, start),
    getCardioWeekSummary(user.id, start),
    getSportWeekSummary(user.id, start),
    getBathingWeekSummary(user.id, start),
    getWeightWeekPlan(user.id, start),
    getUnifiedWeekPlan(user.id, start),
    getWeekMealsSummary(user.id, start),
  ]);

  const journalWeek = await getWeekJournalSummary(user.id, {
    weekStart: start,
    gymSessions: gymWeek.sessions,
    cardioSessions: cardioWeek.sessions,
    sportSessions: sportWeek.sessions,
    bathingSessions: bathingWeek.placedSessions,
    tasks: weeklyTasks.tasks,
    monthlyBillsWeek,
    weightPlan,
    workByDate: await getWorkLogsForWeek(user.id, start),
  });

  return (
    <main className={styles.main} key={start}>
      <WeekNav
        weekStart={start}
        currentWeekStart={currentWeekStart}
        view={view}
        title={formatWeekLabel(start)}
      />

      <WeekViewTabs weekStart={start} view={view} />

      {view === "progress" ? (
        <>
          <WeekMealsBoard summary={mealsWeek} />
          <WeekProgressBoard
          key={start}
          week={week}
          habitWeek={habitWeek}
          gymSessions={gymWeek.sessions}
          cardioSessions={cardioWeek.sessions}
          sportSessions={sportWeek.sessions}
          bathingSessions={bathingWeek.placedSessions}
          tasks={weeklyTasks.tasks}
          taskCategories={weeklyTasks.categories}
          weightPlan={weightPlan}
          journalWeek={journalWeek}
        />
        </>
      ) : (
        <section className={styles.section} key={`plan-${start}`}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.h2}>Veckoplan</h2>
            <span className={styles.muted}>
              lägg till uppgifter · dra till rätt dag
            </span>
          </header>
          <UnifiedWeekBoard
            key={start}
            weekStart={start}
            plan={unifiedPlan}
            weightEnabled={weightPlan.enabled}
          />
        </section>
      )}
    </main>
  );
}
