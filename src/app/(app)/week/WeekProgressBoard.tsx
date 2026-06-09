import Link from "next/link";
import { Card } from "@/components/Card/Card";
import type { GymSessionForWeek } from "@/lib/gym";
import {
  formatDayShort,
  formatWeekdayShort,
  isoWeekdayFromLocalISO,
} from "@/lib/date";
import type { WeekSummary } from "@/lib/water.server";
import { waterDayStatus, type WaterDayStatus } from "@/lib/water";
import type { WeeklyTaskForWeek } from "@/lib/tasks";
import styles from "./week-progress.module.scss";

interface Props {
  week: WeekSummary;
  gymSessions: GymSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
}

const WATER_LABEL: Record<WaterDayStatus, string> = {
  future: "Kommande dag",
  good: "Vattenmål uppnått",
  almost: "Nästan uppnått vattenmål",
  low: "Långt från vattenmål",
};

export function WeekProgressBoard({ week, gymSessions, tasks }: Props) {
  const gymDone = gymSessions.filter((s) => s.placement.doneAt).length;
  const placedTasks = tasks.filter((t) => t.placement);
  const tasksDone = placedTasks.filter((t) => t.placement?.doneAt).length;

  const gymByWeekday = new Map<number, GymSessionForWeek[]>();
  for (const s of gymSessions) {
    const list = gymByWeekday.get(s.placement.weekday) ?? [];
    list.push(s);
    gymByWeekday.set(s.placement.weekday, list);
  }

  const tasksByWeekday = new Map<number, WeeklyTaskForWeek[]>();
  for (const t of tasks) {
    if (!t.placement) continue;
    const list = tasksByWeekday.get(t.placement.weekday) ?? [];
    list.push(t);
    tasksByWeekday.set(t.placement.weekday, list);
  }

  return (
    <div className={styles.board}>
      <div className={styles.summaryGrid}>
        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Gym</span>
          <span className={styles.summaryValue}>
            <span className={styles.summaryBig}>{gymDone}</span>
            <span className={styles.summarySlash}>/ {gymSessions.length}</span>
          </span>
          {gymSessions.length > 0 ? (
            <div className={styles.summaryBar} aria-hidden>
              <div
                className={styles.summaryFill}
                style={{
                  width: `${Math.round((gymDone / gymSessions.length) * 100)}%`,
                }}
              />
            </div>
          ) : null}
        </Card>

        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Uppgifter</span>
          <span className={styles.summaryValue}>
            <span className={styles.summaryBig}>{tasksDone}</span>
            <span className={styles.summarySlash}>
              / {placedTasks.length || "—"}
            </span>
          </span>
          {placedTasks.length > 0 ? (
            <div className={styles.summaryBar} aria-hidden>
              <div
                className={[styles.summaryFill, styles.summaryFillTasks]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  width: `${Math.round((tasksDone / placedTasks.length) * 100)}%`,
                }}
              />
            </div>
          ) : null}
        </Card>
      </div>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Dag för dag</h2>
          <span className={styles.legend}>
            <WaterDayIcon status="good" compact aria-hidden />
            <WaterDayIcon status="almost" compact aria-hidden />
            <WaterDayIcon status="low" compact aria-hidden />
          </span>
        </header>

        <ul className={styles.dayList}>
          {week.days.map((d) => {
            const weekday = isoWeekdayFromLocalISO(d.date);
            const dayGym = gymByWeekday.get(weekday) ?? [];
            const dayTasks = tasksByWeekday.get(weekday) ?? [];
            const dayTasksDone = dayTasks.filter((t) => t.placement?.doneAt)
              .length;
            const waterStatus = waterDayStatus(d);

            const className = [
              styles.dayRow,
              d.isFuture ? styles.dayRowFuture : "",
              d.isToday ? styles.dayRowToday : "",
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

                <WaterDayIcon status={waterStatus} />

                <div className={styles.dayGym}>
                  {dayGym.length === 0 ? (
                    <span className={styles.dayMuted}>—</span>
                  ) : (
                    <ul className={styles.gymList} aria-label="Gympass">
                      {dayGym.map((s) => (
                        <li
                          key={s.id}
                          className={[
                            styles.gymChip,
                            s.placement.doneAt ? styles.gymChipDone : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={s.label}
                        >
                          <span aria-hidden>{s.icon}</span>
                          {s.placement.doneAt ? (
                            <span className={styles.gymCheck} aria-hidden>
                              ✓
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={styles.dayTasks}>
                  {dayTasks.length === 0 ? (
                    <span className={styles.dayMuted}>—</span>
                  ) : (
                    <span
                      className={[
                        styles.taskCount,
                        dayTasksDone === dayTasks.length
                          ? styles.taskCountDone
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {dayTasksDone}/{dayTasks.length}
                    </span>
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
    </div>
  );
}

function WaterDayIcon({
  status,
  compact = false,
}: {
  status: WaterDayStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={[
        styles.waterIcon,
        styles[`waterIcon_${status}`],
        compact ? styles.waterIconCompact : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={compact ? undefined : WATER_LABEL[status]}
      title={WATER_LABEL[status]}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2.5c-3.2 4.8-7 9.1-7 13.2a7 7 0 1 0 14 0c0-4.1-3.8-8.4-7-13.2Z" />
      </svg>
    </span>
  );
}
