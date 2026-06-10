import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWeekHabitSummary } from "@/lib/habits.server";
import { getWeeklySummary } from "@/lib/water.server";
import { getCategories, getWeekSummary } from "@/lib/tasks.server";
import { AddTaskPanel } from "@/components/AddTaskPanel/AddTaskPanel";
import { getGymWeekSummary } from "@/lib/gym.server";
import { GymWeekBoard } from "./GymWeekBoard";
import {
  addDaysISO,
  formatWeekLabel,
  parseLocalISO,
  todayLocalISO,
  weekStartISO,
} from "@/lib/date";
import { WeeklyTasksBoard } from "./WeeklyTasksBoard";
import { WeekProgressBoard } from "./WeekProgressBoard";
import {
  WeekViewTabs,
  weekNavHref,
  type WeekView,
} from "./WeekViewTabs";
import styles from "./week.module.scss";

export const dynamic = "force-dynamic";

interface WeekPageProps {
  searchParams: Promise<{ start?: string; view?: string }>;
}

function parseView(raw: string | undefined): WeekView {
  return raw === "plan" ? "plan" : "progress";
}

export default async function WeekPage({ searchParams }: WeekPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const today = todayLocalISO();
  const currentWeekStart = weekStartISO();
  const view = parseView(params.view);

  const requested =
    params.start && /^\d{4}-\d{2}-\d{2}$/.test(params.start)
      ? weekStartISO(parseLocalISO(params.start))
      : currentWeekStart;

  const start = requested > currentWeekStart ? currentWeekStart : requested;

  const [week, habitWeek, weeklyTasks, gymWeek, allCategories] =
    await Promise.all([
      getWeeklySummary(user.id, start),
      getWeekHabitSummary(user.id, start),
      getWeekSummary(user.id, start),
      getGymWeekSummary(user.id, start),
      getCategories(user.id),
    ]);
  const prevStart = addDaysISO(start, -7);
  const nextStart = addDaysISO(start, 7);
  const canGoForward = start < currentWeekStart;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {start === currentWeekStart ? "This week" : "Past week"}
        </p>
        <div className={styles.weekNav}>
          <Link
            href={weekNavHref(prevStart, view)}
            className={styles.navBtn}
            aria-label="Previous week"
          >
            ‹
          </Link>
          <h1 className={styles.h1}>{formatWeekLabel(start)}</h1>
          {canGoForward ? (
            <Link
              href={weekNavHref(nextStart, view)}
              className={styles.navBtn}
              aria-label="Next week"
            >
              ›
            </Link>
          ) : (
            <span
              className={[styles.navBtn, styles.navBtnDisabled].join(" ")}
              aria-hidden
            >
              ›
            </span>
          )}
        </div>
      </header>

      <WeekViewTabs weekStart={start} view={view} />

      {view === "progress" ? (
        <WeekProgressBoard
          week={week}
          habitWeek={habitWeek}
          gymSessions={gymWeek.sessions}
          tasks={weeklyTasks.tasks}
        />
      ) : (
        <>
          <AddTaskPanel categories={allCategories} defaultScope="weekly" />

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Gym</h2>
              <span className={styles.muted}>dra pass mellan dagar</span>
            </header>
            <GymWeekBoard weekStart={start} sessions={gymWeek.sessions} />
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Veckouppgifter</h2>
              <span className={styles.muted}>placera på dagar</span>
            </header>
            <WeeklyTasksBoard
              weekStart={start}
              tasks={weeklyTasks.tasks}
              categories={weeklyTasks.categories}
            />
          </section>
        </>
      )}
    </main>
  );
}
