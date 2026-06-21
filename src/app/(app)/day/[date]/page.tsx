import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { JournalDaySection } from "@/components/JournalDaySection/JournalDaySection";
import { WorkDayCard } from "@/components/WorkDayCard/WorkDayCard";
import { DayPlanPanel } from "@/components/DayPlanPanel/DayPlanPanel";
import { DailyTrackersBoard } from "@/components/DailyTrackersBoard/DailyTrackersBoard";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { TrainingDaySection } from "@/components/TrainingDaySection/TrainingDaySection";
import { WeeklyTasksDayCard } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import { createClient } from "@/lib/supabase/server";
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
import { getDailyJournal } from "@/lib/journal.server";
import { getWorkDailyLog } from "@/lib/work.server";
import { getDailyMedia } from "@/lib/media.server";
import { getBathingSessionsForDate } from "@/lib/bathing.server";
import { getCardioSessionsForDate } from "@/lib/cardio.server";
import { getGymSessionsForDate } from "@/lib/gym.server";
import { getWeightForDate } from "@/lib/weight.server";
import { getCategories, getWeeklyTasksForDate } from "@/lib/tasks.server";
import { parseLocalISO, todayLocalISO, weekStartISO } from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import { DayNav, dayPageHref } from "@/components/DayNav/DayNav";
import styles from "../../dashboard.module.scss";

export const dynamic = "force-dynamic";

interface DayPageProps {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function DayPage({ params, searchParams }: DayPageProps) {
  const { date } = await params;
  const view = parsePeriodView((await searchParams).view);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const today = todayLocalISO();
  if (date === today) redirect(view === "plan" ? "/?view=plan" : "/");
  if (date > today) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
    media,
    mobileGames,
    mood,
  ] = await Promise.all([
    getDailySummary(user.id, date),
    getDailyHabits(user.id, date),
    getDailyMeals(user.id, date),
    getDailySnacks(user.id, date),
    getDailyIntake(user.id, date),
    getGymSessionsForDate(user.id, date),
    getCardioSessionsForDate(user.id, date),
    getBathingSessionsForDate(user.id, date),
    getWeightForDate(user.id, date),
    getWeeklyTasksForDate(user.id, date),
    getCategories(user.id),
    getDayPlanSettings(user.id),
    getDailyActivityLog(user.id, date),
    getDailyMedia(user.id, date),
    getDailyMobileGames(user.id, date),
    getDailyMood(user.id, date),
  ]);

  const work = await getWorkDailyLog(user.id, date);

  const journal = await getDailyJournal(user.id, {
    localDate: date,
    gymSessions: gymDay.sessions,
    cardioSessions: cardioDay.sessions,
    bathingSessions: bathingDay.sessions,
    tasks: weeklyTasksDay.tasks,
    mood: mood.mood,
    weightKg: weightDay.log?.weightKg ?? null,
    work,
  });

  const backToWeek = `/week?start=${weekStartISO(parseLocalISO(date))}`;

  const hasIncompleteWeekly = weeklyTasksDay.tasks.some(
    (t) => !t.placement?.doneAt,
  );

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <DayNav date={date} today={today} view={view} />
          <h1 className={styles.h1}>
            Looking <span className={styles.accent}>back</span>
          </h1>
        </div>
        <Link href={backToWeek} className={styles.badge} aria-label="Back to week">
          ← Week
        </Link>
      </header>

      <ProgressPlanTabs
        view={view}
        progressHref={dayPageHref(date, today, "progress")}
        planHref={dayPageHref(date, today, "plan")}
      />

      {view === "progress" ? (
        <>
          {(() => {
            const weeklySection = (
              <section className={styles.section}>
                <WeeklyTasksDayCard
                  weekStart={weeklyTasksDay.weekStart}
                  tasks={weeklyTasksDay.tasks}
                  categories={weeklyTasksDay.categories}
                  date={date}
                  today={today}
                  title="Veckouppgifter"
                  hideWhenEmpty
                  showWeekLink={false}
                  enableQuickAdd
                />
              </section>
            );

            const training = (
              <TrainingDaySection
                weekStart={gymDay.weekStart}
                gymSessions={gymDay.sessions}
                cardioSessions={cardioDay.sessions}
                bathingSessions={bathingDay.sessions}
                weightContext={weightDay}
                bathingWeekday={bathingDay.weekday}
                enableExtraBath
              />
            );

            return hasIncompleteWeekly ? (
              <>
                {weeklySection}
                {training}
              </>
            ) : (
              <>
                {training}
                {weeklySection}
              </>
            );
          })()}

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Dagen</h2>
              <Link
                href={dayPageHref(date, today, "plan")}
                className={styles.muted}
              >
                Planera
              </Link>
            </header>
            <DailyTrackersBoard
              date={date}
              habits={habits}
              summary={summary}
              meals={meals}
              snacks={snacks}
              intake={intake}
              activityLog={activityLog}
              goals={dayPlan.goals}
              media={media}
              mobileGames={mobileGames}
              mood={mood}
            />
          </section>

          <section className={styles.section}>
            <WorkDayCard date={date} work={work} />
          </section>

          <section className={styles.section}>
            <JournalDaySection date={date} journal={journal} />
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Vattenlogg</h2>
              <span className={styles.muted}>{summary.logs.length} entries</span>
            </header>
            {summary.logs.length === 0 ? (
              <Card className={styles.empty}>
                <p>No entries logged this day.</p>
                <Link href="/">
                  <Button size="md" variant="outline">
                    Back to today
                  </Button>
                </Link>
              </Card>
            ) : (
              <ul className={styles.logList}>
                {summary.logs.map((log) => (
                  <WaterLogItem key={log.id} log={log} />
                ))}
              </ul>
            )}
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
