import Link from "next/link";
import { JournalDaySection } from "@/components/JournalDaySection/JournalDaySection";
import { DayPlanPanel } from "@/components/DayPlanPanel/DayPlanPanel";
import { DailyTrackersBoard } from "@/components/DailyTrackersBoard/DailyTrackersBoard";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { DayActivitiesCard } from "@/components/DayActivitiesCard/DayActivitiesCard";
import { getAuthUser } from "@/lib/auth.server";
import { getDailyPlanOrder } from "@/lib/day-plan.server";
import { getDailySummary } from "@/lib/water.server";
import {
  getDailyActivityLog,
  getDayPlanSettings,
  getDailyHabits,
  getDailyMeals,
  getDailySnacks,
} from "@/lib/habits.server";
import { getDailyIntake } from "@/lib/intake.server";
import { getDailyMobileGames } from "@/lib/mobile-games.server";
import { getDailyMood } from "@/lib/mood.server";
import { getDailySmokeFree } from "@/lib/smoke-free.server";
import { getDailyJournal } from "@/lib/journal.server";
import { getWorkDailyLog } from "@/lib/work.server";
import { getDailyMedia } from "@/lib/media.server";
import { getDailyLiveEvents } from "@/lib/live-events.server";
import { getBathingSessionsForDate } from "@/lib/bathing.server";
import { getCardioSessionsForDate } from "@/lib/cardio.server";
import { getSportSessionsForDate } from "@/lib/sport.server";
import { getGymSessionsForDate } from "@/lib/gym.server";
import { getWeightForDate } from "@/lib/weight.server";
import { getCategories, getMonthlyTasksForDate, getWeeklyTasksForDate } from "@/lib/tasks.server";
import { getMealRestaurants } from "@/lib/meals.server";
import { getMealBoxStock } from "@/lib/meal-box.server";
import { todayLocalISO } from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import { DayNav, dayPageHref } from "@/components/DayNav/DayNav";
import styles from "./dashboard.module.scss";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function DashboardPage({ searchParams }: HomePageProps) {
  const user = await getAuthUser();

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
    sportDay,
    bathingDay,
    weightDay,
    weeklyTasksDay,
    monthlyTasksDay,
    allCategories,
    dayPlan,
    activityLog,
    media,
    liveEvents,
    mobileGames,
    mood,
    smokeFree,
  ] = await Promise.all([
    getDailySummary(user.id, today),
    getDailyHabits(user.id, today),
    getDailyMeals(user.id, today),
    getDailySnacks(user.id, today),
    getDailyIntake(user.id, today),
    getGymSessionsForDate(user.id, today),
    getCardioSessionsForDate(user.id, today),
    getSportSessionsForDate(user.id, today),
    getBathingSessionsForDate(user.id, today),
    getWeightForDate(user.id, today),
    getWeeklyTasksForDate(user.id, today),
    getMonthlyTasksForDate(user.id, today),
    getCategories(user.id),
    getDayPlanSettings(user.id),
    getDailyActivityLog(user.id, today),
    getDailyMedia(user.id, today),
    getDailyLiveEvents(user.id, today),
    getDailyMobileGames(user.id, today),
    getDailyMood(user.id, today),
    getDailySmokeFree(user.id, today),
  ]);

  const work = await getWorkDailyLog(user.id, today);
  const savedOrder = await getDailyPlanOrder(user.id, today);
  const savedRestaurants = await getMealRestaurants(user.id);
  const mealBoxStock = await getMealBoxStock(user.id);

  const journal = await getDailyJournal(user.id, {
    localDate: today,
    gymSessions: gymDay.sessions,
    cardioSessions: cardioDay.sessions,
    sportSessions: sportDay.sessions,
    bathingSessions: bathingDay.sessions,
    tasks: weeklyTasksDay.weekTasks,
    monthlyTasks: monthlyTasksDay.tasks,
    mood: mood.mood,
    weightKg: weightDay.log?.weightKg ?? null,
    work,
  });

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <DayNav date={today} today={today} view={view} />
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
          <section className={styles.section}>
            <DayActivitiesCard
              weekStart={weeklyTasksDay.weekStart}
              tasks={weeklyTasksDay.tasks}
              onHoldTasks={weeklyTasksDay.onHoldTasks}
              monthlyTasks={monthlyTasksDay.tasks}
              monthStart={monthlyTasksDay.monthStart}
              gymSessions={gymDay.sessions}
              cardioSessions={cardioDay.sessions}
              sportSessions={sportDay.sessions}
              bathingSessions={bathingDay.sessions}
              weight={weightDay}
              habits={habits}
              meals={meals}
              snacks={snacks}
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              intake={intake}
              work={work}
              activityLog={activityLog}
              goals={dayPlan.goals}
              media={media}
              liveEvents={liveEvents}
              savedOrder={savedOrder}
              categories={weeklyTasksDay.categories}
              date={today}
              today={today}
              title="Dagens plan"
              hideWhenEmpty
              showWeekLink={false}
              enableQuickAdd
              bathingWeekday={bathingDay.weekday}
              enableExtraBath
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
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              intake={intake}
              activityLog={activityLog}
              goals={dayPlan.goals}
              mobileGames={mobileGames}
              mood={mood}
              smokeFree={smokeFree}
              waterPlusHref="/water"
              waterPlusLabel="Open water page"
            />
          </section>

          <section className={styles.section}>
            <JournalDaySection date={today} journal={journal} />
          </section>
        </>
      ) : (
        <>
          <section className={styles.section}>
            <DayActivitiesCard
              weekStart={weeklyTasksDay.weekStart}
              tasks={weeklyTasksDay.tasks}
              onHoldTasks={weeklyTasksDay.onHoldTasks}
              monthlyTasks={monthlyTasksDay.tasks}
              monthStart={monthlyTasksDay.monthStart}
              gymSessions={gymDay.sessions}
              cardioSessions={cardioDay.sessions}
              sportSessions={sportDay.sessions}
              bathingSessions={bathingDay.sessions}
              weight={weightDay}
              habits={habits}
              meals={meals}
              snacks={snacks}
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              intake={intake}
              work={work}
              activityLog={activityLog}
              goals={dayPlan.goals}
              media={media}
              liveEvents={liveEvents}
              savedOrder={savedOrder}
              categories={weeklyTasksDay.categories}
              date={today}
              today={today}
              title="Dagens plan"
              hideWhenEmpty
              showWeekLink={false}
              enableQuickAdd
              bathingWeekday={bathingDay.weekday}
            />
          </section>
          <DayPlanPanel
            habits={dayPlan.habits}
            goals={dayPlan.goals}
            categories={allCategories}
          />
        </>
      )}
    </main>
  );
}
