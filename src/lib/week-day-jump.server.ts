import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getBathingWeekSummary } from "@/lib/bathing.server";
import { getCardioWeekSummary } from "@/lib/cardio.server";
import { addDaysISO, isoWeekdayFromLocalISO, todayLocalISO } from "@/lib/date";
import { getGymWeekSummary } from "@/lib/gym.server";
import { getWeekHabitSummary } from "@/lib/habits.server";
import { getSportWeekSummary } from "@/lib/sport.server";
import { getWeekSummary } from "@/lib/tasks.server";
import { getWeeklySummary } from "@/lib/water.server";
import { getWeightWeekPlan } from "@/lib/weight.server";
import {
  computeWeekDayScore,
  type WeekDayJumpDayStatus,
} from "@/lib/week-day-score";

export type { WeekDayJumpDayStatus };

export async function getWeekDayJumpStatuses(
  weekStart: string,
): Promise<WeekDayJumpDayStatus[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const today = todayLocalISO();

  const [week, habitWeek, weeklyTasks, gymWeek, cardioWeek, sportWeek, bathingWeek, weightPlan] =
    await Promise.all([
      getWeeklySummary(user.id, weekStart),
      getWeekHabitSummary(user.id, weekStart),
      getWeekSummary(user.id, weekStart),
      getGymWeekSummary(user.id, weekStart),
      getCardioWeekSummary(user.id, weekStart),
      getSportWeekSummary(user.id, weekStart),
      getBathingWeekSummary(user.id, weekStart),
      getWeightWeekPlan(user.id, weekStart),
    ]);

  const habitByDate = new Map(habitWeek.days.map((d) => [d.date, d]));

  const sessionsByWeekday = new Map<number, boolean[]>();
  const pushSession = (weekday: number | null, done: boolean) => {
    if (weekday == null) return;
    const list = sessionsByWeekday.get(weekday) ?? [];
    list.push(done);
    sessionsByWeekday.set(weekday, list);
  };

  for (const s of gymWeek.sessions) {
    pushSession(s.placement.weekday, Boolean(s.placement.doneAt));
  }
  for (const s of cardioWeek.sessions) {
    pushSession(s.placement.weekday, Boolean(s.placement.doneAt));
  }
  for (const s of sportWeek.sessions) {
    pushSession(s.placement.weekday, Boolean(s.placement.doneAt));
  }
  for (const s of bathingWeek.placedSessions) {
    pushSession(s.placement.weekday, Boolean(s.placement.doneAt));
  }

  const tasksByWeekday = new Map<number, boolean[]>();
  for (const t of weeklyTasks.tasks) {
    const weekday = t.placement?.weekday;
    if (weekday == null) continue;
    const list = tasksByWeekday.get(weekday) ?? [];
    list.push(Boolean(t.placement?.doneAt));
    tasksByWeekday.set(weekday, list);
  }

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(weekStart, i);
    const weekday = isoWeekdayFromLocalISO(date);
    const waterDay = week.days.find((d) => d.date === date);
    const habitDay = habitByDate.get(date);
    const taskFlags = tasksByWeekday.get(weekday) ?? [];
    const isFuture = date > today;

    const score = computeWeekDayScore({
      isFuture,
      water: {
        goalMet: waterDay?.goalMet ?? false,
        progress: waterDay?.progress ?? 0,
      },
      habitStatuses: habitWeek.habits.map((h) => habitDay?.statuses[h.id] ?? null),
      sessionsDone: sessionsByWeekday.get(weekday) ?? [],
      tasksAllDone: taskFlags.length > 0 ? taskFlags.every(Boolean) : null,
      weightScheduled: weightPlan.enabled && weightPlan.weekday === weekday,
      weightLogged:
        weightPlan.enabled &&
        weightPlan.weekday === weekday &&
        weightPlan.log?.localDate === date,
    });

    return {
      date,
      band: score.band,
      pct: score.pct,
      hit: score.hit,
      total: score.total,
    };
  });
}
