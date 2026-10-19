import { JournalDaySection } from "@/components/JournalDaySection/JournalDaySection";
import { DayPlanPanel } from "@/components/DayPlanPanel/DayPlanPanel";
import { DailyTrackersBoard } from "@/components/DailyTrackersBoard/DailyTrackersBoard";
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
  getSugarFreeStreakBefore,
} from "@/lib/habits.server";
import { getDailyIntake } from "@/lib/intake.server";
import { getDailyMobileGames } from "@/lib/mobile-games.server";
import { getDailyMood } from "@/lib/mood.server";
import { getDailySmokeFree, getSmokeFreeStreakBefore } from "@/lib/smoke-free.server";
import { getDailyJournal } from "@/lib/journal.server";
import { getWorkDailyLog } from "@/lib/work.server";
import { habitDayContext } from "@/lib/habits";
import { formatTripDayTitle } from "@/lib/leave";
import { getLeaveDayContext } from "@/lib/leave.server";
import { getDailyMedia } from "@/lib/media.server";
import { getDailyLiveEvents } from "@/lib/live-events.server";
import { getBathingSessionsForDate } from "@/lib/bathing.server";
import { getCardioSessionsForDate } from "@/lib/cardio.server";
import { getSportSessionsForDate } from "@/lib/sport.server";
import { getGymSessionsForDate } from "@/lib/gym.server";
import { getWeightForDate } from "@/lib/weight.server";
import { getCategories, getMonthlyTasksForDate, getWeeklyTasksForDate } from "@/lib/tasks.server";
import { getCodingProjects } from "@/lib/coding.server";
import { getUserGames } from "@/lib/games.server";
import { getUserSports } from "@/lib/sports.server";
import { getDayQuickAddSources } from "@/lib/day-quick-add.server";
import { getDailyMealPlans, getMealRestaurants } from "@/lib/meals.server";
import { getMealBoxStock } from "@/lib/meal-box.server";
import { todayLocalISO } from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import { DayNav } from "@/components/DayNav/DayNav";
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
    mealPlans,
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
    streakBefore,
    sugarStreakBefore,
    codingProjects,
    games,
    sports,
    quickAddSources,
  ] = await Promise.all([
    getDailySummary(user.id, today),
    getDailyHabits(user.id, today),
    getDailyMeals(user.id, today),
    getDailyMealPlans(user.id, today),
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
    getSmokeFreeStreakBefore(user.id, today),
    getSugarFreeStreakBefore(user.id, today),
    getCodingProjects(user.id),
    getUserGames(user.id),
    getUserSports(user.id),
    getDayQuickAddSources(user.id),
  ]);

  const work = await getWorkDailyLog(user.id, today);
  const { onLeave, leaveKind, tripDay } = await getLeaveDayContext(user.id, today);
  const dayContext = habitDayContext({
    localDate: today,
    leaveKind,
    workKind: work.kind,
  });
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
    moodNote: mood.note,
    moodLoggedAt: mood.loggedAt,
    weightKg: weightDay.log?.weightKg ?? null,
    work,
    tripDay,
  });

  return (
    <main className={[styles.main, tripDay ? styles.tripDay : ""].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <DayNav
            date={today}
            today={today}
            view={view}
            heading={
              tripDay
                ? formatTripDayTitle(tripDay.title, tripDay.dayIndex, tripDay.dayCount)
                : undefined
            }
          />
        </div>
      </header>

      {view === "progress" ? (
        <>
          <div className={styles.dashboard}>
          <section className={styles.section}>
            <DayActivitiesCard
              weekStart={weeklyTasksDay.weekStart}
              tasks={weeklyTasksDay.tasks}
              monthlyTasks={monthlyTasksDay.tasks}
              monthStart={monthlyTasksDay.monthStart}
              gymSessions={gymDay.sessions}
              cardioSessions={cardioDay.sessions}
              sportSessions={sportDay.sessions}
              bathingSessions={bathingDay.sessions}
              weight={weightDay}
              habits={habits}
              meals={meals}
              mealPlans={mealPlans}
              snacks={snacks}
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              intake={intake}
              work={work}
              onLeave={onLeave}
              leaveKind={leaveKind}
              tripDay={tripDay}
              activityLog={activityLog}
              goals={dayPlan.goals}
              media={media}
              liveEvents={liveEvents}
              savedOrder={savedOrder}
              categories={weeklyTasksDay.categories}
              addableTasks={weeklyTasksDay.addableTasks}
              quickAddSources={quickAddSources}
              date={today}
              today={today}
              hideWhenEmpty
              showWeekLink={false}
              enableQuickAdd
              codingProjects={codingProjects}
              games={games}
              sports={sports}
            />
          </section>

          <section className={styles.section}>
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
              streakBefore={streakBefore}
              sugarStreakBefore={sugarStreakBefore}
              dayContext={dayContext}
              waterPlusHref="/water"
              waterPlusLabel="Open water page"
            />
          </section>
          </div>

          <section className={styles.section}>
            <JournalDaySection date={today} journal={journal} />
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
