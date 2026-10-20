import { DailyTrackersBoard } from "@/components/DailyTrackersBoard/DailyTrackersBoard";
import { getAuthUser } from "@/lib/auth.server";
import { habitDayContext } from "@/lib/habits";
import { getSugarFreeStreakBefore } from "@/lib/habits.server";
import { getDailyMobileGames } from "@/lib/mobile-games.server";
import { getDailySmokeFree, getSmokeFreeStreakBefore } from "@/lib/smoke-free.server";
import { RevealAfterPlan } from "./FadeIn";
import {
  getCachedDailyActivityLog,
  getCachedDailyHabits,
  getCachedDailyIntake,
  getCachedDailyMeals,
  getCachedDailyMood,
  getCachedDailySnacks,
  getCachedDailySummary,
  getCachedDayPlanSettings,
  getCachedLeaveDayContext,
  getCachedMealBoxStock,
  getCachedMealRestaurants,
  getCachedWorkDailyLog,
  getPlanRevealGate,
} from "./cached";

interface Props {
  date: string;
  waterPlusHref: string;
  waterPlusLabel: string;
}

export async function DayTrackersSection({
  date,
  waterPlusHref,
  waterPlusLabel,
}: Props) {
  await getPlanRevealGate().promise;
  const user = await getAuthUser();
  const [
    habits,
    meals,
    snacks,
    savedRestaurants,
    mealBoxStock,
    intake,
    activityLog,
    dayPlan,
    work,
    leave,
    summary,
    mobileGames,
    mood,
    smokeFree,
    streakBefore,
    sugarStreakBefore,
  ] = await Promise.all([
    getCachedDailyHabits(user.id, date),
    getCachedDailyMeals(user.id, date),
    getCachedDailySnacks(user.id, date),
    getCachedMealRestaurants(user.id),
    getCachedMealBoxStock(user.id),
    getCachedDailyIntake(user.id, date),
    getCachedDailyActivityLog(user.id, date),
    getCachedDayPlanSettings(user.id),
    getCachedWorkDailyLog(user.id, date),
    getCachedLeaveDayContext(user.id, date),
    getCachedDailySummary(user.id, date),
    getDailyMobileGames(user.id, date),
    getCachedDailyMood(user.id, date),
    getDailySmokeFree(user.id, date),
    getSmokeFreeStreakBefore(user.id, date),
    getSugarFreeStreakBefore(user.id, date),
  ]);

  const dayContext = habitDayContext({
    localDate: date,
    leaveKind: leave.leaveKind,
    workKind: work.kind,
  });

  return (
    <RevealAfterPlan>
      <DailyTrackersBoard
      date={date}
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
      waterPlusHref={waterPlusHref}
      waterPlusLabel={waterPlusLabel}
    />
    </RevealAfterPlan>
  );
}
