import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DayPlanPanel } from "@/components/DayPlanPanel/DayPlanPanel";
import { DailyTrackersBoard } from "@/components/DailyTrackersBoard/DailyTrackersBoard";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { TrainingDaySection } from "@/components/TrainingDaySection/TrainingDaySection";
import { WeeklyTasksDayCard } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import { getDailySummary } from "@/lib/water.server";
import {
  getDailyActivityLog,
  getDayPlanSettings,
  getDailyHabits,
  getDailyMeals,
  getDailySnacks,
} from "@/lib/habits.server";
import { getDailyIntake } from "@/lib/intake.server";
import { getBathingSessionsForDate } from "@/lib/bathing.server";
import { getCardioSessionsForDate } from "@/lib/cardio.server";
import { getGymSessionsForDate } from "@/lib/gym.server";
import { getWeightForDate } from "@/lib/weight.server";
import { getCategories, getWeeklyTasksForDate } from "@/lib/tasks.server";
import { todayLocalISO } from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import { DayNav, dayPageHref } from "@/components/DayNav/DayNav";
import styles from "./dashboard.module.scss";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function DashboardPage({ searchParams }: HomePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const view = parsePeriodView((await searchParams).view);
  const today = todayLocalISO();

  const [
    summary,
    habits,
    meals,
    snacks,
    intake,
    gymDay,
    cardioDay,
    bathingDay,
    weightDay,
    weeklyTasksDay,
    allCategories,
    dayPlan,
    activityLog,
  ] = await Promise.all([
    getDailySummary(user.id, today),
    getDailyHabits(user.id, today),
    getDailyMeals(user.id, today),
    getDailySnacks(user.id, today),
    getDailyIntake(user.id, today),
    getGymSessionsForDate(user.id, today),
    getCardioSessionsForDate(user.id, today),
    getBathingSessionsForDate(user.id, today),
    getWeightForDate(user.id, today),
    getWeeklyTasksForDate(user.id, today),
    getCategories(user.id),
    getDayPlanSettings(user.id),
    getDailyActivityLog(user.id, today),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <DayNav date={today} today={today} view={view} />
          <h1 className={styles.h1}>
            Stay <span className={styles.accent}>hydrated</span>
          </h1>
        </div>
        {view === "progress" ? (
          <Link
            href="/add-water"
            className={styles.iconBadge}
            aria-label="Manual water entry"
            title="Manual log"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 20h4l10-10-4-4L4 16v4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="m13.5 6.5 4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        ) : null}
      </header>

      <ProgressPlanTabs
        view={view}
        progressHref={dayPageHref(today, today, "progress")}
        planHref={dayPageHref(today, today, "plan")}
      />

      {view === "progress" ? (
        <>
          <TrainingDaySection
            weekStart={gymDay.weekStart}
            gymSessions={gymDay.sessions}
            cardioSessions={cardioDay.sessions}
            bathingSessions={bathingDay.sessions}
            weightContext={weightDay}
            gymTitle="Gym idag"
            cardioTitle="Cardio idag"
            bathingTitle="Bad & bastu idag"
            weightTitle="Vikt idag"
          />

          <section className={styles.section}>
            <WeeklyTasksDayCard
              weekStart={weeklyTasksDay.weekStart}
              tasks={weeklyTasksDay.tasks}
              categories={weeklyTasksDay.categories}
              title="Veckouppgifter idag"
              hideWhenEmpty
              showWeekLink={false}
            />
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Dagen</h2>
              <Link href="/?view=plan" className={styles.muted}>
                Planera
              </Link>
            </header>
            <DailyTrackersBoard
              date={today}
              habits={habits}
              summary={summary}
              meals={meals}
              snacks={snacks}
              intake={intake}
              activityLog={activityLog}
              goals={dayPlan.goals}
              waterPlusHref="/water"
              waterPlusLabel="Open water page"
            />
          </section>
        </>
      ) : (
        <DayPlanPanel
          habits={dayPlan.habits}
          goals={dayPlan.goals}
          categories={allCategories}
        />
      )}
    </main>
  );
}
