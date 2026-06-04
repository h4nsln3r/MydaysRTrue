import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { createClient } from "@/lib/supabase/server";
import { getWeeklySummary } from "@/lib/water.server";
import { getWeekSummary } from "@/lib/tasks.server";
import { getGymWeekSummary } from "@/lib/gym.server";
import { GymWeekBoard } from "./GymWeekBoard";
import { formatMl } from "@/lib/water";
import {
  addDaysISO,
  formatDayShort,
  formatWeekLabel,
  formatWeekdayShort,
  parseLocalISO,
  todayLocalISO,
  weekStartISO,
} from "@/lib/date";
import { WeeklyTasksBoard } from "./WeeklyTasksBoard";
import styles from "./week.module.scss";

export const dynamic = "force-dynamic";

interface WeekPageProps {
  searchParams: Promise<{ start?: string }>;
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

  // Accept any valid YYYY-MM-DD; always re-align to that week's Monday so
  // bookmarks like `?start=2024-06-12` (a Wednesday) still land sanely.
  const requested =
    params.start && /^\d{4}-\d{2}-\d{2}$/.test(params.start)
      ? weekStartISO(parseLocalISO(params.start))
      : currentWeekStart;

  // Don't allow viewing weeks entirely in the future.
  const start = requested > currentWeekStart ? currentWeekStart : requested;

  const [week, weeklyTasks, gymWeek] = await Promise.all([
    getWeeklySummary(user.id, start),
    getWeekSummary(user.id, start),
    getGymWeekSummary(user.id, start),
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
            href={`/week?start=${prevStart}`}
            className={styles.navBtn}
            aria-label="Previous week"
          >
            ‹
          </Link>
          <h1 className={styles.h1}>{formatWeekLabel(start)}</h1>
          {canGoForward ? (
            <Link
              href={`/week?start=${nextStart}`}
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

      <Card accent className={styles.summary}>
        <div className={styles.summaryRow}>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>Total</span>
            <span className={styles.statValue}>{formatMl(week.totalMl)}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>Goals hit</span>
            <span className={styles.statValue}>
              <span className={styles.statBig}>{week.daysHit}</span>
              <span className={styles.statSlash}>/ 7</span>
            </span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>Daily goal</span>
            <span className={styles.statValue}>{formatMl(week.goalMl)}</span>
          </div>
        </div>
        <div className={styles.streakBar} role="list" aria-label="Weekly goal streak">
          {week.days.map((d) => (
            <span
              key={d.date}
              role="listitem"
              aria-label={`${formatWeekdayShort(d.date)} ${
                d.isFuture ? "upcoming" : d.goalMet ? "goal hit" : "not hit"
              }`}
              className={[
                styles.streakDot,
                d.isFuture ? styles.streakDotFuture : "",
                d.goalMet ? styles.streakDotHit : "",
                d.isToday ? styles.streakDotToday : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          ))}
        </div>
      </Card>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Days</h2>
          <span className={styles.muted}>tap to view</span>
        </header>
        <ul className={styles.dayList}>
          {week.days.map((d) => {
            const pct = Math.min(100, Math.round(d.progress * 100));
            const className = [
              styles.dayRow,
              d.isFuture ? styles.dayRowFuture : "",
              d.isToday ? styles.dayRowToday : "",
              d.goalMet ? styles.dayRowHit : "",
            ]
              .filter(Boolean)
              .join(" ");

            const inner = (
              <>
                <div className={styles.dayInfo}>
                  <span
                    className={[
                      styles.dayName,
                      d.isToday ? styles.dayNameToday : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {formatWeekdayShort(d.date)}
                  </span>
                  <span className={styles.dayDate}>{formatDayShort(d.date)}</span>
                </div>
                <div className={styles.dayProgress}>
                  <div className={styles.progressBar} aria-hidden>
                    <div
                      className={[
                        styles.progressFill,
                        d.goalMet ? styles.progressFillHit : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ width: `${d.isFuture ? 0 : pct}%` }}
                    />
                  </div>
                  <div className={styles.dayStats}>
                    {d.isFuture ? (
                      <span className={styles.daySlash}>— / {formatMl(d.goalMl)}</span>
                    ) : (
                      <>
                        <span
                          className={[
                            styles.dayAmount,
                            d.goalMet ? styles.dayAmountHit : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {formatMl(d.totalMl)}
                        </span>
                        <span className={styles.daySlash}>
                          / {formatMl(d.goalMl)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className={styles.dayStatus}>
                  {d.isFuture ? (
                    <span className={styles.statusFuture}>—</span>
                  ) : d.goalMet ? (
                    <span className={styles.statusOk} aria-label="Goal hit">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M5 12.5 10 17.5 19 7.5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : (
                    <span className={styles.statusPending}>{pct}%</span>
                  )}
                </div>
              </>
            );

            return (
              <li key={d.date}>
                {d.isFuture ? (
                  <div className={className} aria-disabled="true">
                    {inner}
                  </div>
                ) : (
                  <Link
                    href={d.isToday ? "/" : `/day/${d.date}`}
                    className={className}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Gym</h2>
          <span className={styles.muted}>5 pass · mån–fre som standard</span>
        </header>
        <GymWeekBoard weekStart={start} sessions={gymWeek.sessions} />
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Weekly tasks</h2>
          <Link href="/profile" className={styles.muted}>
            Edit
          </Link>
        </header>
        <WeeklyTasksBoard
          weekStart={start}
          tasks={weeklyTasks.tasks}
          categories={weeklyTasks.categories}
        />
      </section>
    </main>
  );
}
