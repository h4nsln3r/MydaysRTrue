import Link from "next/link";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { getWeekHabitSummary } from "@/lib/habits.server";

import { getWeeklySummary } from "@/lib/water.server";

import { getWeekSummary } from "@/lib/tasks.server";

import { getCardioWeekSummary } from "@/lib/cardio.server";

import { getGymWeekSummary } from "@/lib/gym.server";

import { getWeightWeekPlan } from "@/lib/weight.server";

import { getUnifiedWeekPlan } from "@/lib/week-plan.server";

import {

  addDaysISO,

  formatWeekLabel,

  parseLocalISO,

  todayLocalISO,

  weekStartISO,

} from "@/lib/date";

import { UnifiedWeekBoard } from "./UnifiedWeekBoard";

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



  const [

    week,

    habitWeek,

    weeklyTasks,

    gymWeek,

    cardioWeek,

    weightPlan,

    unifiedPlan,

  ] = await Promise.all([

    getWeeklySummary(user.id, start),

    getWeekHabitSummary(user.id, start),

    getWeekSummary(user.id, start),

    getGymWeekSummary(user.id, start),

    getCardioWeekSummary(user.id, start),

    getWeightWeekPlan(user.id, start),

    getUnifiedWeekPlan(user.id, start),

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

          cardioSessions={cardioWeek.sessions}

          tasks={weeklyTasks.tasks}

          weightPlan={weightPlan}

        />

      ) : (

        <section className={styles.section}>

          <header className={styles.sectionHeader}>

            <h2 className={styles.h2}>Veckoplan</h2>

            <span className={styles.muted}>

              lägg till uppgifter · dra till rätt dag

            </span>

          </header>

          <UnifiedWeekBoard

            weekStart={start}

            plan={unifiedPlan}

            weightEnabled={weightPlan.enabled}

          />

        </section>

      )}

    </main>

  );

}


