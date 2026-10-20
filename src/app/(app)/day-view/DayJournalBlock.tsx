import { JournalDaySection } from "@/components/JournalDaySection/JournalDaySection";
import { getAuthUser } from "@/lib/auth.server";
import { getDailyJournal } from "@/lib/journal.server";
import styles from "../dashboard.module.scss";
import { RevealAfterPlan } from "./FadeIn";
import {
  getCachedBathingSessionsForDate,
  getCachedCardioSessionsForDate,
  getCachedDailyMood,
  getCachedGymSessionsForDate,
  getCachedLeaveDayContext,
  getCachedMonthlyTasksForDate,
  getCachedSportSessionsForDate,
  getCachedWeeklyTasksForDate,
  getCachedWeightForDate,
  getCachedWorkDailyLog,
  getPlanRevealGate,
} from "./cached";

export async function DayJournalBlock({ date }: { date: string }) {
  await getPlanRevealGate().promise;
  const user = await getAuthUser();
  const [
    gymDay,
    cardioDay,
    sportDay,
    bathingDay,
    weeklyTasksDay,
    monthlyTasksDay,
    weightDay,
    work,
    leave,
    mood,
  ] = await Promise.all([
    getCachedGymSessionsForDate(user.id, date),
    getCachedCardioSessionsForDate(user.id, date),
    getCachedSportSessionsForDate(user.id, date),
    getCachedBathingSessionsForDate(user.id, date),
    getCachedWeeklyTasksForDate(user.id, date),
    getCachedMonthlyTasksForDate(user.id, date),
    getCachedWeightForDate(user.id, date),
    getCachedWorkDailyLog(user.id, date),
    getCachedLeaveDayContext(user.id, date),
    getCachedDailyMood(user.id, date),
  ]);

  const journal = await getDailyJournal(user.id, {
    localDate: date,
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
    tripDay: leave.tripDay,
  });

  return (
    <RevealAfterPlan>
      <section className={styles.section}>
        <JournalDaySection date={date} journal={journal} />
      </section>
    </RevealAfterPlan>
  );
}
