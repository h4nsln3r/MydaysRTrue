import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { createClient } from "@/lib/supabase/server";
import { getMonthSummary, shiftMonth } from "@/lib/habits.server";
import { todayLocalISO } from "@/lib/date";
import type { Habit, HabitStatus } from "@/lib/habits";
import type { MonthDay } from "@/lib/habits.server";
import styles from "./month.module.scss";

export const dynamic = "force-dynamic";

interface MonthPageProps {
  searchParams: Promise<{ m?: string }>;
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

const WEEKDAY_HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function MonthPage({ searchParams }: MonthPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
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

  const summary = await getMonthSummary(user.id, year, month);
  const today = todayLocalISO();

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);
  const canGoForward =
    next.year < todayYM.year ||
    (next.year === todayYM.year && next.month <= todayYM.month);
  const isCurrent = year === todayYM.year && month === todayYM.month;

  // Group days into weeks (Mon..Sun) for the mobile strip view.
  const weeks = groupIntoWeeks(summary.days);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {isCurrent ? "This month" : "Past month"}
        </p>
        <div className={styles.monthNav}>
          <Link
            href={`/month?m=${prev.year}-${String(prev.month).padStart(2, "0")}`}
            className={styles.navBtn}
            aria-label="Previous month"
          >
            ‹
          </Link>
          <h1 className={styles.h1}>{formatMonthLabel(year, month)}</h1>
          {canGoForward ? (
            <Link
              href={`/month?m=${next.year}-${String(next.month).padStart(2, "0")}`}
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

      <Card accent className={styles.summary}>
        <div className={styles.summaryStats}>
          {summary.habits.map((h) => (
            <div key={h.id} className={styles.statBlock}>
              <span className={styles.statLabel}>
                <span className={styles.statIcon} aria-hidden>
                  {h.icon}
                </span>
                {h.label}
              </span>
              <span className={styles.statValue}>
                <span className={styles.statBig}>
                  {summary.yesByHabit[h.id] ?? 0}
                </span>
                <span className={styles.statSlash}>
                  / {summary.days.filter((d) => !d.isFuture).length}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className={styles.legend} aria-label="Legend">
          <span className={styles.legendItem}>
            <span className={[styles.legendDot, styles.legendDotYes].join(" ")} />
            Yes
          </span>
          <span className={styles.legendItem}>
            <span className={[styles.legendDot, styles.legendDotHalf].join(" ")} />
            Half
          </span>
          <span className={styles.legendItem}>
            <span className={[styles.legendDot, styles.legendDotNo].join(" ")} />
            No
          </span>
          <span className={styles.legendItem}>
            <span className={[styles.legendDot, styles.legendDotEmpty].join(" ")} />
            Empty
          </span>
        </div>
      </Card>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Habits tracked</h2>
          <Link href="/profile" className={styles.muted}>
            Edit
          </Link>
        </header>
        <div className={styles.habitChips}>
          {summary.habits.map((h) => (
            <span
              key={h.id}
              className={styles.habitChip}
              style={{ borderColor: h.accent }}
            >
              <span className={styles.chipIcon} aria-hidden>
                {h.icon}
              </span>
              {h.label}
            </span>
          ))}
        </div>
      </section>

      {/* Mobile: vertical list of week strips */}
      <section className={styles.mobileWeeks} aria-label="Days by week">
        {weeks.map((wk, idx) => (
          <WeekStrip
            key={idx}
            days={wk}
            habits={summary.habits}
            today={today}
          />
        ))}
      </section>

      {/* Desktop: full calendar grid */}
      <section className={styles.desktopCalendar} aria-label="Month calendar">
        <div className={styles.calendarHead}>
          {WEEKDAY_HEAD.map((d) => (
            <div key={d} className={styles.calendarHeadCell}>
              {d}
            </div>
          ))}
        </div>
        <div className={styles.calendarGrid}>
          {paddedCalendar(summary.days).map((cell, i) =>
            cell ? (
              <DayCell
                key={cell.date}
                day={cell}
                habits={summary.habits}
                today={today}
              />
            ) : (
              <span
                key={`pad-${i}`}
                className={[styles.dayCell, styles.dayCellEmpty].join(" ")}
                aria-hidden
              />
            ),
          )}
        </div>
      </section>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function groupIntoWeeks(days: MonthDay[]): MonthDay[][] {
  if (days.length === 0) return [];
  const weeks: MonthDay[][] = [];
  let current: MonthDay[] = [];
  for (const d of days) {
    if (current.length === 0) {
      // First day of the month — pad left so the strip lines up Mon..Sun.
      for (let i = 1; i < d.weekday; i++) {
        current.push(makePadDay(d.date, i - d.weekday));
      }
    }
    current.push(d);
    if (d.weekday === 7) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    // Pad right to fill the week.
    while (current.length < 7) {
      current.push(makePadDay("", 0, true));
    }
    weeks.push(current);
  }
  return weeks;
}

function makePadDay(_anchor: string, _offset: number, trailing = false): MonthDay {
  return {
    date: trailing ? "" : "",
    isFuture: false,
    isToday: false,
    dayOfMonth: 0,
    weekday: 0,
    statuses: {},
  };
}

function paddedCalendar(days: MonthDay[]): (MonthDay | null)[] {
  if (days.length === 0) return [];
  const first = days[0];
  const padBefore = first.weekday - 1; // Monday=1 → 0 pads
  const result: (MonthDay | null)[] = [];
  for (let i = 0; i < padBefore; i++) result.push(null);
  result.push(...days);
  while (result.length % 7 !== 0) result.push(null);
  return result;
}

// ----------------------------------------------------------------------------
// Cell components
// ----------------------------------------------------------------------------

interface WeekStripProps {
  days: MonthDay[];
  habits: Habit[];
  today: string;
}

function WeekStrip({ days, habits, today }: WeekStripProps) {
  const inMonthDays = days.filter((d) => d.dayOfMonth > 0);
  const first = inMonthDays[0];
  const last = inMonthDays[inMonthDays.length - 1];
  const label = first && last ? `${first.dayOfMonth}–${last.dayOfMonth}` : "";
  return (
    <div className={styles.weekStripWrap}>
      <div className={styles.weekStripLabel}>
        <span>Week</span>
        <span>{label}</span>
      </div>
      <div className={styles.weekStrip}>
        {days.map((d, i) =>
          d.dayOfMonth === 0 ? (
            <span
              key={`pad-${i}`}
              className={[styles.dayCell, styles.dayCellEmpty].join(" ")}
              aria-hidden
            />
          ) : (
            <DayCell key={d.date} day={d} habits={habits} today={today} />
          ),
        )}
      </div>
    </div>
  );
}

interface DayCellProps {
  day: MonthDay;
  habits: Habit[];
  today: string;
}

function DayCell({ day, habits, today }: DayCellProps) {
  const className = [
    styles.dayCell,
    day.isFuture ? styles.dayCellFuture : "",
    day.isToday ? styles.dayCellToday : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dots = (
    <div className={styles.dots}>
      {habits.map((h) => {
        const status = day.statuses[h.id] ?? null;
        return (
          <span
            key={h.id}
            className={[styles.dot, dotClass(status)].join(" ")}
            aria-label={`${h.label} ${status ?? "empty"}`}
            title={`${h.label}: ${status ?? "empty"}`}
          />
        );
      })}
    </div>
  );

  const inner = (
    <>
      <span
        className={[styles.dayNum, day.isToday ? styles.dayNumToday : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {day.dayOfMonth}
      </span>
      {dots}
    </>
  );

  if (day.isFuture) {
    return (
      <div className={className} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={day.date === today ? "/" : `/day/${day.date}`}
      className={className}
      aria-label={`View ${day.date}`}
    >
      {inner}
    </Link>
  );
}

function dotClass(status: HabitStatus | null): string {
  switch (status) {
    case "yes":
      return styles.dot_yes;
    case "half":
      return styles.dot_half;
    case "no":
      return styles.dot_no;
    default:
      return styles.dot_empty;
  }
}
