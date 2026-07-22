import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { JournalDaySection } from "@/components/JournalDaySection/JournalDaySection";
import { DayPlanPanel } from "@/components/DayPlanPanel/DayPlanPanel";
import { DailyTrackersBoard } from "@/components/DailyTrackersBoard/DailyTrackersBoard";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { DayActivitiesCard } from "@/components/DayActivitiesCard/DayActivitiesCard";
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
import { getDailySmokeFree } from "@/lib/smoke-free.server";
import { getDailyJournal } from "@/lib/journal.server";
import { getWorkDailyLog } from "@/lib/work.server";
import { isUserOnLeave } from "@/lib/leave.server";
import { getDailyMedia } from "@/lib/media.server";
import { getDailyLiveEvents } from "@/lib/live-events.server";
import { getBathingSessionsForDate } from "@/lib/bathing.server";
import { getCardioSessionsForDate } from "@/lib/cardio.server";
import { getSportSessionsForDate } from "@/lib/sport.server";
import { getGymSessionsForDate } from "@/lib/gym.server";
import { getWeightForDate } from "@/lib/weight.server";
import { getCategories, getMonthlyTasksForDate, getWeeklyTasksForDate } from "@/lib/tasks.server";
import { getDailyPlanOrder } from "@/lib/day-plan.server";
import { getMealRestaurants } from "@/lib/meals.server";
import { getMealBoxStock } from "@/lib/meal-box.server";
import { parseLocalISO, todayLocalISO, weekEndISO, weekStartISO } from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import { DayNav, dayPageHref } from "@/components/DayNav/DayNav";
import { QuickAddRow } from "../../QuickAddRow";
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
  if (date > weekEndISO(today)) notFound();

  const isUpcoming = date > today;

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
    getDailySummary(user.id, date),
    getDailyHabits(user.id, date),
    getDailyMeals(user.id, date),
    getDailySnacks(user.id, date),
    getDailyIntake(user.id, date),
    getGymSessionsForDate(user.id, date),
    getCardioSessionsForDate(user.id, date),
    getSportSessionsForDate(user.id, date),
    getBathingSessionsForDate(user.id, date),
    getWeightForDate(user.id, date),
    getWeeklyTasksForDate(user.id, date),
    getMonthlyTasksForDate(user.id, date),
    getCategories(user.id),
    getDayPlanSettings(user.id),
    getDailyActivityLog(user.id, date),
    getDailyMedia(user.id, date),
    getDailyLiveEvents(user.id, date),
    getDailyMobileGames(user.id, date),
    getDailyMood(user.id, date),
    getDailySmokeFree(user.id, date),
  ]);

  const work = await getWorkDailyLog(user.id, date);
  const onLeave = await isUserOnLeave(user.id, date);
  const savedOrder = await getDailyPlanOrder(user.id, date);
  const savedRestaurants = await getMealRestaurants(user.id);
  const mealBoxStock = await getMealBoxStock(user.id);

  const journal = await getDailyJournal(user.id, {
    localDate: date,
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

  const backToWeek = `/week?start=${weekStartISO(parseLocalISO(date))}`;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <DayNav date={date} today={today} view={view} />
          <h1 className={styles.h1}>
            {isUpcoming ? (
              <>
                Planera <span className={styles.accent}>dagen</span>
              </>
            ) : (
              <>
                Looking <span className={styles.accent}>back</span>
              </>
            )}
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
              snacks={snacks}
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              intake={intake}
              work={work}
              onLeave={onLeave}
              activityLog={activityLog}
              goals={dayPlan.goals}
              media={media}
              liveEvents={liveEvents}
              savedOrder={savedOrder}
              categories={weeklyTasksDay.categories}
              date={date}
              today={today}
              title="Dagens plan"
              planningMode={isUpcoming}
              hideWhenEmpty
              showWeekLink={false}
              enableQuickAdd={!isUpcoming}
              bathingWeekday={bathingDay.weekday}
              enableExtraBath={!isUpcoming}
            />
          </section>

          {!isUpcoming ? (
            <>
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
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              intake={intake}
              activityLog={activityLog}
              goals={dayPlan.goals}
              mobileGames={mobileGames}
              mood={mood}
              smokeFree={smokeFree}
              waterPlusHref={`/water?date=${date}`}
              waterPlusLabel="Lägg till vatten"
            />
          </section>

          <section className={styles.section}>
            <JournalDaySection date={date} journal={journal} />
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Vattenlogg</h2>
              <Link href={`/add-water?date=${date}`} className={styles.link}>
                Mer →
              </Link>
            </header>
            <QuickAddRow localDate={date} />
            {summary.logs.length === 0 ? (
              <Card className={styles.empty}>
                <p>Inget vatten loggat den här dagen.</p>
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
          ) : null}
        </>
      ) : (
        <>
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
              snacks={snacks}
              savedRestaurants={savedRestaurants}
              mealBoxStock={mealBoxStock}
              intake={intake}
              work={work}
              onLeave={onLeave}
              activityLog={activityLog}
              goals={dayPlan.goals}
              media={media}
              liveEvents={liveEvents}
              savedOrder={savedOrder}
              categories={weeklyTasksDay.categories}
              date={date}
              today={today}
              title="Dagens plan"
              hideWhenEmpty
              showWeekLink={false}
              planningMode={isUpcoming}
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
