import Link from "next/link";
import { AddTaskPanel } from "@/components/AddTaskPanel/AddTaskPanel";
import { PeriodNavTitle } from "@/components/PeriodBadge/PeriodBadge";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { getAuthUser } from "@/lib/auth.server";
import { getMonthSummary, shiftMonth } from "@/lib/habits.server";
import { getCategories, getMonthTaskSummary } from "@/lib/tasks.server";
import { SALARY_TASK_KEY } from "@/lib/monthly-finance";
import { todayLocalISO } from "@/lib/date";
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

function todayYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default async function MonthPage({ searchParams }: MonthPageProps) {
  const user = await getAuthUser();

  const params = await searchParams;
  const view = parsePeriodView(params.view);
  const todayYM = todayYearMonth();

  let year = todayYM.year;
  let month = todayYM.month;
  if (params.m && MONTH_QS_RE.test(params.m)) {
    const [, y, m] = MONTH_QS_RE.exec(params.m)!;
    year = Number(y);
    month = Number(m);
  }
  // Don't allow viewing months entirely in the future.
  if (
    year > todayYM.year ||
    (year === todayYM.year && month > todayYM.month)
  ) {
    year = todayYM.year;
    month = todayYM.month;
  }

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const [summary, monthlyTasks, allCategories] = await Promise.all([
    getMonthSummary(user.id, year, month),
    getMonthTaskSummary(user.id, monthStart),
    getCategories(user.id),
  ]);
  const monthlyDone = monthlyTasks.tasks.filter(
    (t) => t.completion?.doneAt,
  ).length;
  const today = todayLocalISO();

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);
  const canGoForward =
    next.year < todayYM.year ||
    (next.year === todayYM.year && next.month <= todayYM.month);
  const isCurrent = year === todayYM.year && month === todayYM.month;
  const financeTask = monthlyTasks.tasks.find((t) => t.key === "finance_ekonomi");
  const salaryTask = monthlyTasks.tasks.find((t) => t.key === SALARY_TASK_KEY);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {isCurrent ? "This month" : "Past month"}
        </p>
        <div className={styles.monthNav}>
          <Link
            href={monthNavHref(prev.year, prev.month, view)}
            className={styles.navBtn}
            aria-label="Previous month"
          >
            ‹
          </Link>
          <h1 className={styles.h1}>
            <PeriodNavTitle
              kind="month"
              date={`${year}-${String(month).padStart(2, "0")}-01`}
            >
              {formatMonthLabel(year, month)}
            </PeriodNavTitle>
          </h1>
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

      <ProgressPlanTabs
        view={view}
        progressHref={monthNavHref(year, month, "progress")}
        planHref={monthNavHref(year, month, "plan")}
      />

      {view === "progress" ? (
        <MonthProgressBoard
            summary={summary}
            monthStart={monthStart}
            monthlyTasks={monthlyTasks.tasks}
            monthlyDone={monthlyDone}
            monthlyTotal={monthlyTasks.tasks.length}
            today={today}
            financeSnapshot={monthlyTasks.financeSnapshot}
            financeTaskId={financeTask?.id ?? null}
            salaryTaskId={salaryTask?.id ?? null}
            salaryAmount={salaryTask?.completion?.amount ?? null}
            categories={monthlyTasks.categories}
        />
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
            />
          </section>
        </>
      )}
    </main>
  );
}
