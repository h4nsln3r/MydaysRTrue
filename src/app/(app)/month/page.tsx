import Link from "next/link";
import { AddTaskPanel } from "@/components/AddTaskPanel/AddTaskPanel";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { getAuthUser } from "@/lib/auth.server";
import { getMonthSummary, shiftMonth } from "@/lib/habits.server";
import { getMealsInRange } from "@/lib/meal-box.server";
import { getMealRestaurants } from "@/lib/meals.server";
import { getMediaContextsInRange } from "@/lib/media.server";
import { getMonthMedia } from "@/lib/media.server";
import { getMonthLiveEvents } from "@/lib/live-events.server";
import { getMonthGigs } from "@/lib/gigs.server";
import { LiveEventsMonthSummary } from "@/components/LiveEventsMonthSummary/LiveEventsMonthSummary";
import { GigsMonthSummary } from "@/components/GigsMonthSummary/GigsMonthSummary";
import { MediaMonthSummary } from "@/components/MediaMonthSummary/MediaMonthSummary";
import {
  clampMonthNavigation,
  isFutureMonth,
  maxPlanMonthStart,
  todayYearMonth,
} from "@/lib/month-plan-horizon";
import { getCategories, getMonthFinanceSnapshot, getMonthTaskSummary } from "@/lib/tasks.server";
import { getMonthActivityProgress } from "@/lib/month-progress.server";
import { collectMonthExpenses, collectMonthShopping } from "@/lib/expenses";
import { SALARY_TASK_KEY } from "@/lib/monthly-finance";
import { isMonthlyTaskComplete } from "@/lib/monthly-bills";
import {
  isMonthlyTaskRepeatable,
  monthlyTaskCompletions,
} from "@/lib/tasks";
import { todayLocalISO } from "@/lib/date";
import { getWorkLogsInRange } from "@/lib/work.server";
import { getLeavePeriodsInRange } from "@/lib/leave.server";
import { getCompletionsInRange } from "@/lib/completions.server";
import { isGigPlayed } from "@/lib/gigs";
import { isLiveEventAttended } from "@/lib/live-events";
import { PeriodInsights } from "@/components/PeriodInsights/PeriodInsights";
import {
  buildPeriodInsights,
  doneTrainingSessions,
  insightDaysFromHabits,
  insightSavingsFromTasks,
  insightSpendsFromEntries,
  insightWealth,
} from "@/lib/insights";
import { liveMomentLabel } from "@/lib/insights.server";
import { parsePeriodView, type PeriodView } from "@/lib/period-view";
import { MonthProgressBoard } from "./MonthProgressBoard";
import { MonthlyFinanceTable } from "./MonthlyFinanceTable";
import { MonthlyBillsSummary } from "./MonthlyBillsSummary";
import { MonthlyTasksBoard } from "./MonthlyTasksBoard";
import styles from "./month.module.scss";

export const dynamic = "force-dynamic";

interface MonthPageProps {
  searchParams: Promise<{ m?: string; view?: string }>;
}

function monthNavHref(year: number, month: number, view: PeriodView): string {
  const m = `${year}-${String(month).padStart(2, "0")}`;
  return `/month?m=${m}&view=${view}`;
}

const MONTH_QS_RE = /^(\d{4})-(\d{2})$/;

export default async function MonthPage({ searchParams }: MonthPageProps) {
  const user = await getAuthUser();

  const params = await searchParams;
  const view = parsePeriodView(params.view);
  const today = todayLocalISO();
  const todayYM = todayYearMonth(today);

  let year = todayYM.year;
  let month = todayYM.month;
  if (params.m && MONTH_QS_RE.test(params.m)) {
    const [, y, m] = MONTH_QS_RE.exec(params.m)!;
    year = Number(y);
    month = Number(m);
  }

  const clamped = clampMonthNavigation(year, month, view, today);
  year = clamped.year;
  month = clamped.month;

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const prev = shiftMonth(year, month, -1);
  const prevMonthStart = `${prev.year}-${String(prev.month).padStart(2, "0")}-01`;
  const [summary, monthlyTasks, allCategories, monthMedia, monthLive, monthGigs, activity, workByDate, mealsRange, mediaContexts, savedRestaurants, leavePeriods, monthCompletions, previousFinance] =
    await Promise.all([
    getMonthSummary(user.id, year, month),
    getMonthTaskSummary(user.id, monthStart),
    getCategories(user.id),
    getMonthMedia(user.id, monthStart),
    getMonthLiveEvents(user.id, monthStart),
    getMonthGigs(user.id, monthStart),
    getMonthActivityProgress(user.id, monthStart),
    getWorkLogsInRange(user.id, monthStart, monthEnd),
    getMealsInRange(user.id, monthStart, monthEnd),
    getMediaContextsInRange(user.id, monthStart, monthEnd),
    getMealRestaurants(user.id),
    getLeavePeriodsInRange(user.id, monthStart, monthEnd),
    getCompletionsInRange(user.id, monthStart, monthEnd),
    getMonthFinanceSnapshot(user.id, prevMonthStart),
  ]);
  const weeklyTasks = activity.weeks.flatMap((w) => w.tasks);
  const spendCategories =
    activity.categories.length > 0 ? activity.categories : monthlyTasks.categories;
  const spendSummaries = {
    expenses: collectMonthExpenses({
      weeklyTasks,
      categories: spendCategories,
      monthStart,
      monthlyTasks: monthlyTasks.tasks,
    }),
    shopping: collectMonthShopping({
      weeklyTasks,
      categories: spendCategories,
      monthStart,
    }),
  };
  let monthlyDone = 0;
  let monthlyTotal = 0;
  for (const t of monthlyTasks.tasks) {
    if (isMonthlyTaskRepeatable(t)) {
      const inst = monthlyTaskCompletions(t).filter(
        (c) =>
          !c.isUnscheduled &&
          (c.scheduledDayOfMonth != null || c.doneAt != null),
      );
      monthlyTotal += inst.length;
      monthlyDone += inst.filter((c) => isMonthlyTaskComplete(t, c)).length;
    } else {
      monthlyTotal += 1;
      if (isMonthlyTaskComplete(t, t.completion)) monthlyDone += 1;
    }
  }
  const isFuturePlan = view === "plan" && isFutureMonth(monthStart, today);
  const financeTask = monthlyTasks.tasks.find((t) => t.key === "finance_ekonomi");
  const salaryTask = monthlyTasks.tasks.find((t) => t.key === SALARY_TASK_KEY);

  const next = shiftMonth(year, month, +1);
  const maxPlan = maxPlanMonthStart(today);
  const maxPlanYear = Number(maxPlan.slice(0, 4));
  const maxPlanMonth = Number(maxPlan.slice(5, 7));
  const monthInsights = buildPeriodInsights({
    scope: "month",
    start: monthStart,
    end: monthEnd,
    today,
    days: insightDaysFromHabits({
      days: summary.days,
      workByDate,
      leavePeriods,
      today,
    }),
    sessions: activity.weeks
      .flatMap((week) =>
        doneTrainingSessions({
          gym: week.gym,
          cardio: week.cardio,
          sport: week.sport,
          bathing: week.bathing,
        }),
      )
      .filter((session) => session.date >= monthStart && session.date <= monthEnd),
    moments: [
      ...monthLive.events
        .filter((event) => isLiveEventAttended(event))
        .map((event) => ({
          date: event.eventDate,
          label: liveMomentLabel(event.kind, event.title),
        })),
      ...monthGigs.gigs
        .filter((gig) => isGigPlayed(gig))
        .map((gig) => ({
          date: gig.eventDate,
          label: `spelningen ${gig.title}`,
        })),
    ],
    completions: monthCompletions.map((item) => ({
      date: item.date,
      title: item.title,
      subtitle: item.subtitle,
    })),
    leavePeriods,
    spends: [
      ...insightSpendsFromEntries(spendSummaries.expenses.entries, "expense"),
      ...insightSpendsFromEntries(spendSummaries.shopping.entries, "shopping"),
      ...insightSavingsFromTasks(monthlyTasks.tasks, monthStart, monthEnd),
    ],
    wealth: insightWealth(monthlyTasks.financeSnapshot, previousFinance),
  });

  const canGoForward =
    view === "plan"
      ? next.year < maxPlanYear ||
        (next.year === maxPlanYear && next.month <= maxPlanMonth)
      : next.year < todayYM.year ||
        (next.year === todayYM.year && next.month <= todayYM.month);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.monthNav}>
          <Link
            href={monthNavHref(prev.year, prev.month, view)}
            className={styles.navBtn}
            aria-label="Previous month"
          >
            ‹
          </Link>
          <div className={styles.titleCell}>
            <ProgressPlanTabs
              view={view}
              progressHref={monthNavHref(year, month, "progress")}
              planHref={monthNavHref(year, month, "plan")}
            />
          </div>
          {canGoForward ? (
            <Link
              href={monthNavHref(next.year, next.month, view)}
              className={styles.navBtn}
              aria-label="Next month"
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

      {view === "progress" ? (
        <>
        <PeriodInsights model={monthInsights} />
        <MonthProgressBoard
            summary={summary}
            monthStart={monthStart}
            monthlyTasks={monthlyTasks.tasks}
            monthlyDone={monthlyDone}
            monthlyTotal={monthlyTotal}
            today={today}
            financeSnapshot={monthlyTasks.financeSnapshot}
            financeTaskId={financeTask?.id ?? null}
            salaryTaskId={salaryTask?.id ?? null}
            salaryAmount={salaryTask?.completion?.amount ?? null}
            categories={monthlyTasks.categories}
            expenseSummary={spendSummaries.expenses}
            shoppingSummary={spendSummaries.shopping}
            workByDate={workByDate}
            activity={activity}
            mealDays={mealsRange.days}
            mealBoxStock={mealsRange.stock}
            savedRestaurants={savedRestaurants}
            mediaContexts={mediaContexts}
        />
        <section className={styles.section}>
          <MediaMonthSummary monthMedia={monthMedia} year={year} />
        </section>
        <section className={styles.section}>
          <LiveEventsMonthSummary monthLive={monthLive} year={year} />
        </section>
        <section className={styles.section}>
          <GigsMonthSummary monthGigs={monthGigs} year={year} />
        </section>
        </>
      ) : (
        <>
          <AddTaskPanel
            categories={allCategories}
            defaultScope="monthly"
            monthStart={monthStart}
            allowOneOff
          />

          <MonthlyFinanceTable
            monthStart={monthStart}
            financeTaskId={financeTask?.id ?? null}
            snapshot={monthlyTasks.financeSnapshot}
            salaryTaskId={salaryTask?.id ?? null}
            salaryAmount={salaryTask?.completion?.amount ?? null}
            planOnly={isFuturePlan}
          />

          <MonthlyBillsSummary
            tasks={monthlyTasks.tasks}
            categories={monthlyTasks.categories}
          />

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.h2}>Månadsuppgifter</h2>
              <span className={styles.muted}>att placera · klarmarkera</span>
            </header>
            <MonthlyTasksBoard
              monthStart={monthStart}
              tasks={monthlyTasks.tasks}
              categories={monthlyTasks.categories}
              isFuturePlan={isFuturePlan}
            />
          </section>
        </>
      )}
    </main>
  );
}
