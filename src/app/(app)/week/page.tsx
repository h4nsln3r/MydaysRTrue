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
import { getLeavePeriodsInRange, getTripDaysInRange } from "@/lib/leave.server";

import { getUnifiedWeekPlan } from "@/lib/week-plan.server";
import { getDayQuickAddSources } from "@/lib/day-quick-add.server";
import { isQuickAddWeeklyTask, toDayQuickAddTask } from "@/lib/day-quick-add";
import { getUserGames } from "@/lib/games.server";
import { getUserSports } from "@/lib/sports.server";
import { getWeekMealsSummary } from "@/lib/meal-box.server";
import { getMealRestaurants } from "@/lib/meals.server";
import { getWeekMediaSummary } from "@/lib/media.server";
import { getWeekProgressLayout } from "@/lib/week-progress-layout.server";
import { WEEK_PROGRESS_HABIT_KEYS } from "@/lib/habits";

import {
  addDaysISO,
  parseLocalISO,
  todayLocalISO,
  weekStartISO,
} from "@/lib/date";
import { maxPlanWeekStart } from "@/lib/month-plan-horizon";

import { UnifiedWeekBoard } from "./UnifiedWeekBoard";

import { WeekProgressBoard } from "./WeekProgressBoard";

import { WeekMealsBoard } from "./WeekMealsBoard";

import { collectWeekExpenses, collectWeekShopping } from "@/lib/expenses";
import { getWeekCompletions } from "@/lib/completions.server";
import { WeekCompletionsList } from "./WeekCompletionsList";
import { monthlyTasksWithWeekCompletions } from "@/lib/monthly-bills";

import { WeekNav } from "@/components/WeekNav/WeekNav";
import { PeriodInsights } from "@/components/PeriodInsights/PeriodInsights";
import {
  buildPeriodInsights,
  doneTrainingSessions,
  insightDaysFromHabits,
  insightMonthlyExpensesFromTasks,
  insightSavingsFromTasks,
  insightSpendsFromEntries,
} from "@/lib/insights";
import { getAttendedLiveMoments } from "@/lib/insights.server";

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
  const maxWeek =
    view === "plan" ? maxPlanWeekStart(today) : nextWeekStart;
  const start = requested > maxWeek ? maxWeek : requested;

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
    mealRestaurants,
    mediaWeek,
    weekProgressLayout,
    weekCompletions,
    workByDate,
    games,
    sports,
    quickAddSources,
    tripByDate,
    leavePeriods,
    liveMoments,
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
    getMealRestaurants(user.id),
    getWeekMediaSummary(user.id, start),
    getWeekProgressLayout(user.id, [...WEEK_PROGRESS_HABIT_KEYS]),
    getWeekCompletions(user.id, start),
    getWorkLogsForWeek(user.id, start),
    getUserGames(user.id),
    getUserSports(user.id),
    getDayQuickAddSources(user.id),
    getTripDaysInRange(user.id, start, addDaysISO(start, 6)),
    getLeavePeriodsInRange(user.id, start, addDaysISO(start, 6)),
    getAttendedLiveMoments(user.id, start, addDaysISO(start, 6)),
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
    workByDate,
    tripByDate,
  });

  const weekEnd = addDaysISO(start, 6);
  const weekInsights = buildPeriodInsights({
    scope: "week",
    start,
    end: weekEnd,
    today,
    days: insightDaysFromHabits({
      days: habitWeek.days,
      workByDate,
      leavePeriods,
      today,
    }),
    sessions: doneTrainingSessions({
      gym: gymWeek.sessions,
      cardio: cardioWeek.sessions,
      sport: sportWeek.sessions,
      bathing: bathingWeek.placedSessions,
    }).filter((session) => session.date >= start && session.date <= weekEnd),
    moments: [
      ...liveMoments,
      ...weekCompletions
        .filter((item) => item.domain === "gig")
        .map((item) => ({
          date: item.date,
          label: `spelningen ${item.title}`,
        })),
    ],
    completions: weekCompletions.map((item) => ({
      date: item.date,
      title: item.title,
      subtitle: item.subtitle,
    })),
    leavePeriods,
    spends: [
      ...insightSpendsFromEntries(
        collectWeekExpenses(weeklyTasks.tasks, weeklyTasks.categories).entries,
        "expense",
      ),
      ...insightSpendsFromEntries(
        collectWeekShopping(weeklyTasks.tasks, weeklyTasks.categories).entries,
        "shopping",
      ),
      ...insightMonthlyExpensesFromTasks(
        monthlyBillsWeek.tasks,
        monthlyBillsWeek.categories,
        start,
        weekEnd,
      ),
      ...insightSavingsFromTasks(monthlyBillsWeek.tasks, start, weekEnd),
    ],
  });

  return (
    <main className={styles.main} key={start}>
      <WeekNav
        weekStart={start}
        currentWeekStart={currentWeekStart}
        view={view}
        maxWeekStart={maxWeek}
      />

      {view === "progress" ? (
        <>
          <PeriodInsights model={weekInsights} />
          <WeekCompletionsList weekStart={start} completions={weekCompletions} />
          <WeekMealsBoard summary={mealsWeek} savedRestaurants={mealRestaurants} />
          <WeekProgressBoard
          key={start}
          week={week}
          habitWeek={habitWeek}
          mealsWeek={mealsWeek}
          mediaWeek={mediaWeek}
          gymSessions={gymWeek.sessions}
          cardioSessions={cardioWeek.sessions}
          sportSessions={sportWeek.sessions}
          bathingSessions={bathingWeek.placedSessions}
          tasks={weeklyTasks.tasks}
          taskCategories={weeklyTasks.categories}
          weightPlan={weightPlan}
          journalWeek={journalWeek}
          layout={weekProgressLayout}
          workByDate={workByDate}
          savedRestaurants={mealRestaurants}
          sports={sports}
          monthlyTasks={monthlyTasksWithWeekCompletions(monthlyBillsWeek)}
          monthlyCategories={monthlyBillsWeek.categories}
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
            games={games}
            sports={sports}
            quickAddTasks={weeklyTasks.tasks
              .filter((task) => isQuickAddWeeklyTask(task))
              .map(toDayQuickAddTask)}
            quickAddSources={quickAddSources}
          />
        </section>
      )}
    </main>
  );
}
