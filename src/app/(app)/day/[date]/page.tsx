import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { DayPlanPanel } from "@/components/DayPlanPanel/DayPlanPanel";
import { DailyTrackersBoard } from "@/components/DailyTrackersBoard/DailyTrackersBoard";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import { GymDayCard } from "@/components/GymDayCard/GymDayCard";
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
import { getGymSessionsForDate } from "@/lib/gym.server";
import { getCategories } from "@/lib/tasks.server";
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
    allCategories,
    dayPlan,
    activityLog,
  ] = await Promise.all([
    getDailySummary(user.id, date),
    getDailyHabits(user.id, date),
    getDailyMeals(user.id, date),
    getDailySnacks(user.id, date),
    getDailyIntake(user.id, date),
    getGymSessionsForDate(user.id, date),
    getCategories(user.id),
    getDayPlanSettings(user.id),
    getDailyActivityLog(user.id, date),
  ]);

  const backToWeek = `/week?start=${weekStartISO(parseLocalISO(date))}`;

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
          <section className={styles.section}>
            <GymDayCard weekStart={gymDay.weekStart} sessions={gymDay.sessions} />
          </section>

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
            />
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Log</h2>
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
