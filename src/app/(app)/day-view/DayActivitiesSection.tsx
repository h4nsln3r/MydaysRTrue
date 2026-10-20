import { DayActivitiesCard } from "@/components/DayActivitiesCard/DayActivitiesCard";
import { getAuthUser } from "@/lib/auth.server";
import { getCodingProjects } from "@/lib/coding.server";
import { getDayQuickAddSources } from "@/lib/day-quick-add.server";
import { getUserGames } from "@/lib/games.server";
import { getUserSports } from "@/lib/sports.server";
import { Suspense } from "react";
import {
  getCachedBathingSessionsForDate,
  getCachedCardioSessionsForDate,
  getCachedDailyActivityLog,
  getCachedDailyHabits,
  getCachedDailyIntake,
  getCachedDailyLiveEvents,
  getCachedDailyMeals,
  getCachedDailyMealPlans,
  getCachedDailyMedia,
  getCachedDailyPlanOrder,
  getCachedDailySnacks,
  getCachedDayPlanSettings,
  getCachedGymSessionsForDate,
  getCachedLeaveDayContext,
  getCachedMealBoxStock,
  getCachedMealRestaurants,
  getCachedMonthlyTasksForDate,
  getCachedSportSessionsForDate,
  getCachedWeeklyTasksForDate,
  getCachedWeightForDate,
  getCachedWorkDailyLog,
  getPlanRevealGate,
} from "./cached";
import { MarkPlanShown } from "./FadeIn";
import { PlanExtrasProvider, PlanExtrasPublisher } from "./PlanExtras";
import { EMPTY_PLAN_EXTRAS, type PlanListExtras } from "./plan-extras";

interface Props {
  date: string;
  today: string;
  upcoming?: boolean;
}

async function loadPlanExtras(userId: string): Promise<PlanListExtras> {
  try {
    const [codingProjects, games, sports, quickAddSources, savedRestaurants, mealBoxStock] =
      await Promise.all([
        getCodingProjects(userId),
        getUserGames(userId),
        getUserSports(userId),
        getDayQuickAddSources(userId),
        getCachedMealRestaurants(userId),
        getCachedMealBoxStock(userId),
      ]);
    return {
      codingProjects,
      games,
      sports,
      quickAddSources,
      savedRestaurants,
      mealBoxStock,
    };
  } catch (error) {
    console.error("Failed to load day-plan extras", error);
    return EMPTY_PLAN_EXTRAS;
  }
}

async function PlanExtrasLoader({ promise }: { promise: Promise<PlanListExtras> }) {
  const extras = await promise;
  return <PlanExtrasPublisher extras={extras} />;
}

/**
 * The day list only. Plus-menu data starts after the list queries, so it
 * does not hold the list back.
 */
export async function DayActivitiesSection({ date, today, upcoming = false }: Props) {
  const gate = getPlanRevealGate();
  try {
    return await renderDayActivities({ date, today, upcoming });
  } finally {
    gate.done();
  }
}

async function renderDayActivities({ date, today, upcoming = false }: Props) {
  const user = await getAuthUser();

  const [
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
    dayPlan,
    activityLog,
    media,
    liveEvents,
    work,
    leave,
    savedOrder,
  ] = await Promise.all([
    getCachedDailyHabits(user.id, date),
    getCachedDailyMeals(user.id, date),
    getCachedDailyMealPlans(user.id, date),
    getCachedDailySnacks(user.id, date),
    getCachedDailyIntake(user.id, date),
    getCachedGymSessionsForDate(user.id, date),
    getCachedCardioSessionsForDate(user.id, date),
    getCachedSportSessionsForDate(user.id, date),
    getCachedBathingSessionsForDate(user.id, date),
    getCachedWeightForDate(user.id, date),
    getCachedWeeklyTasksForDate(user.id, date),
    getCachedMonthlyTasksForDate(user.id, date),
    getCachedDayPlanSettings(user.id),
    getCachedDailyActivityLog(user.id, date),
    getCachedDailyMedia(user.id, date),
    getCachedDailyLiveEvents(user.id, date),
    getCachedWorkDailyLog(user.id, date),
    getCachedLeaveDayContext(user.id, date),
    getCachedDailyPlanOrder(user.id, date),
  ]);

  const { onLeave, leaveKind, tripDay } = leave;
  const extrasPromise = loadPlanExtras(user.id);

  return (
    <MarkPlanShown>
    <PlanExtrasProvider>
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
        date={date}
        today={today}
        planningMode={upcoming}
        hideWhenEmpty
        showWeekLink={false}
        enableQuickAdd={!upcoming}
      />
      <Suspense fallback={null}>
        <PlanExtrasLoader promise={extrasPromise} />
      </Suspense>
    </PlanExtrasProvider>
    </MarkPlanShown>
  );
}
