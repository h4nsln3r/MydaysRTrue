import "server-only";

import { cache } from "react";
import { getBathingSessionsForDate } from "@/lib/bathing.server";
import { getCardioSessionsForDate } from "@/lib/cardio.server";
import { getDailyPlanOrder } from "@/lib/day-plan.server";
import { getGymSessionsForDate } from "@/lib/gym.server";
import {
  getDailyActivityLog,
  getDailyHabits,
  getDailyMeals,
  getDailySnacks,
  getDayPlanSettings,
} from "@/lib/habits.server";
import { getDailyIntake } from "@/lib/intake.server";
import { getDailyLiveEvents } from "@/lib/live-events.server";
import { getLeaveDayContext } from "@/lib/leave.server";
import { getMealBoxStock } from "@/lib/meal-box.server";
import { getDailyMealPlans, getMealRestaurants } from "@/lib/meals.server";
import { getDailyMedia } from "@/lib/media.server";
import { getDailyMood } from "@/lib/mood.server";
import { getSportSessionsForDate } from "@/lib/sport.server";
import { getMonthlyTasksForDate, getWeeklyTasksForDate } from "@/lib/tasks.server";
import { getDailySummary } from "@/lib/water.server";
import { getWeightForDate } from "@/lib/weight.server";
import { getWorkDailyLog } from "@/lib/work.server";

/** Shared by the heading, the plan card and the journal within one request. */
export const getCachedLeaveDayContext = cache(getLeaveDayContext);

/** Shared by the tracker board and the water log. */
export const getCachedDailySummary = cache(getDailySummary);

/** Shared by the tracker board and the journal. */
export const getCachedDailyMood = cache(getDailyMood);

/** Shared by the plan list and the tracker board. */
export const getCachedDailyHabits = cache(getDailyHabits);
export const getCachedDailyMeals = cache(getDailyMeals);
export const getCachedDailyMealPlans = cache(getDailyMealPlans);
export const getCachedDailySnacks = cache(getDailySnacks);
export const getCachedDailyIntake = cache(getDailyIntake);
export const getCachedDailyActivityLog = cache(getDailyActivityLog);
export const getCachedDayPlanSettings = cache(getDayPlanSettings);
export const getCachedMealRestaurants = cache(getMealRestaurants);
export const getCachedMealBoxStock = cache(getMealBoxStock);

/** Shared by the plan list and the journal. */
export const getCachedGymSessionsForDate = cache(getGymSessionsForDate);
export const getCachedCardioSessionsForDate = cache(getCardioSessionsForDate);
export const getCachedSportSessionsForDate = cache(getSportSessionsForDate);
export const getCachedBathingSessionsForDate = cache(getBathingSessionsForDate);
export const getCachedWeightForDate = cache(getWeightForDate);
export const getCachedWeeklyTasksForDate = cache(getWeeklyTasksForDate);
export const getCachedMonthlyTasksForDate = cache(getMonthlyTasksForDate);
export const getCachedWorkDailyLog = cache(getWorkDailyLog);

/** Plan list only, but cached so a refresh in the same request stays deduped. */
export const getCachedDailyMedia = cache(getDailyMedia);
export const getCachedDailyLiveEvents = cache(getDailyLiveEvents);
export const getCachedDailyPlanOrder = cache(getDailyPlanOrder);

/**
 * Trackers, journal and water wait on this so their queries start only after
 * the plan list has its data. Otherwise the lighter sections finish first.
 */
export const getPlanRevealGate = cache(() => {
  let done: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    done = resolve;
  });
  return { promise, done };
});
