import "server-only";
import { monthEndISO, weekStartsOverlappingRange } from "@/lib/date";
import { getBathingWeekSummary } from "@/lib/bathing.server";
import { getCardioWeekSummary } from "@/lib/cardio.server";
import { getGymWeekSummary } from "@/lib/gym.server";
import { getSportWeekSummary } from "@/lib/sport.server";
import { getWeekSummary } from "@/lib/tasks.server";
import type { MonthActivityProgress } from "@/lib/month-progress";

export async function getMonthActivityProgress(
  userId: string,
  monthStart: string,
): Promise<MonthActivityProgress> {
  const monthEnd = monthEndISO(monthStart);
  const weekStarts = weekStartsOverlappingRange(monthStart, monthEnd);

  const loaded = await Promise.all(
    weekStarts.map(async (weekStart) => {
      const [weekly, gym, cardio, sport, bathing] = await Promise.all([
        getWeekSummary(userId, weekStart),
        getGymWeekSummary(userId, weekStart),
        getCardioWeekSummary(userId, weekStart),
        getSportWeekSummary(userId, weekStart),
        getBathingWeekSummary(userId, weekStart),
      ]);
      return {
        weekStart,
        categories: weekly.categories,
        tasks: weekly.tasks,
        gym: gym.sessions,
        cardio: cardio.sessions,
        sport: sport.sessions,
        bathing: bathing.placedSessions,
      };
    }),
  );

  return {
    monthStart,
    monthEnd,
    categories: loaded[0]?.categories ?? [],
    weeks: loaded.map(({ categories: _c, ...week }) => week),
  };
}
