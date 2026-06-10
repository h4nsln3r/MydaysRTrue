import type { HTMLAttributes } from "react";
import Link from "next/link";
import { Card } from "@/components/Card/Card";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { GymSessionForWeek } from "@/lib/gym";
import {
  formatDayShort,
  formatWeekdayShort,
  isoWeekdayFromLocalISO,
} from "@/lib/date";
import type { Habit, HabitStatus } from "@/lib/habits";
import type { WeekHabitSummary } from "@/lib/habits.server";
import type { WeekSummary } from "@/lib/water.server";
import { waterDayStatus, type WaterDayStatus } from "@/lib/water";
import type { WeeklyTaskForWeek } from "@/lib/tasks";
import styles from "./week-progress.module.scss";

interface Props {
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
}

const WATER_LABEL: Record<WaterDayStatus, string> = {
  future: "Kommande dag",
  good: "Vattenmål uppnått",
  almost: "Nästan uppnått vattenmål",
  low: "Långt från vattenmål",
};

const HABIT_STATUS_LABEL: Record<HabitStatus | "empty", string> = {
  yes: "Uppnått",
  half: "Delvis",
  no: "Nej",
  empty: "Ej loggat",
};

export function WeekProgressBoard({
  week,
  habitWeek,
  gymSessions,
  cardioSessions,
  tasks,
}: Props) {
  const gymDone = gymSessions.filter((s) => s.placement.doneAt).length;
  const cardioDone = cardioSessions.filter((s) => s.placement.doneAt).length;
  const placedTasks = tasks.filter((t) => t.placement);
  const tasksDone = placedTasks.filter((t) => t.placement?.doneAt).length;
  const pastDays = habitWeek.days.filter((d) => !d.isFuture).length;

  const gymByWeekday = new Map<number, GymSessionForWeek[]>();
  for (const s of gymSessions) {
    const list = gymByWeekday.get(s.placement.weekday) ?? [];
    list.push(s);
    gymByWeekday.set(s.placement.weekday, list);
  }

  const cardioByWeekday = new Map<number, CardioSessionForWeek[]>();
  for (const s of cardioSessions) {
    const list = cardioByWeekday.get(s.placement.weekday) ?? [];
    list.push(s);
    cardioByWeekday.set(s.placement.weekday, list);
  }

  const tasksByWeekday = new Map<number, WeeklyTaskForWeek[]>();
  for (const t of tasks) {
    if (!t.placement) continue;
    const list = tasksByWeekday.get(t.placement.weekday) ?? [];
    list.push(t);
    tasksByWeekday.set(t.placement.weekday, list);
  }

  const habitDayByDate = new Map(habitWeek.days.map((d) => [d.date, d]));

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
          <span className={styles.summaryLabel}>Cardio</span>
          <span className={styles.summaryValue}>
            <span className={styles.summaryBig}>{cardioDone}</span>
            <span className={styles.summarySlash}>
              / {cardioSessions.length}
            </span>
          </span>
          {cardioSessions.length > 0 ? (
            <div className={styles.summaryBar} aria-hidden>
              <div
                className={[styles.summaryFill, styles.summaryFillCardio]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  width: `${Math.round((cardioDone / cardioSessions.length) * 100)}%`,
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

      {habitWeek.habits.length > 0 ? (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.h2}>Dagliga spårare</h2>
            <span className={styles.legend}>
              <HabitStatusDot status="yes" compact aria-hidden />
              <HabitStatusDot status="half" compact aria-hidden />
              <HabitStatusDot status="no" compact aria-hidden />
            </span>
          </header>

          <div className={styles.habitSummaryGrid}>
            {habitWeek.habits.map((h) => (
              <div key={h.id} className={styles.habitSummaryChip}>
                <span className={styles.habitSummaryIcon} aria-hidden>
                  {h.icon}
                </span>
                <span className={styles.habitSummaryMeta}>
                  <span className={styles.habitSummaryLabel}>{h.label}</span>
                  <span className={styles.habitSummaryCount}>
                    <span className={styles.habitSummaryBig}>
                      {habitWeek.yesByHabit[h.id] ?? 0}
                    </span>
                    <span className={styles.habitSummarySlash}>
                      / {pastDays || "—"}
                    </span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
            const dayCardio = cardioByWeekday.get(weekday) ?? [];
            const dayTasks = tasksByWeekday.get(weekday) ?? [];
            const dayTasksDone = dayTasks.filter((t) => t.placement?.doneAt)
              .length;
            const waterStatus = waterDayStatus(d);
            const habitDay = habitDayByDate.get(d.date);

            const className = [
              styles.dayRow,
              d.isFuture ? styles.dayRowFuture : "",
              d.isToday ? styles.dayRowToday : "",
            ]
              .filter(Boolean)
              .join(" ");

            const inner = (
              <>
                <div className={styles.dayRowMain}>
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
                    <span className={styles.dayDate}>
                      {formatDayShort(d.date)}
                    </span>
                  </div>

                  <WaterDayIcon status={waterStatus} />

                <div className={styles.dayTraining}>
                  {dayGym.length === 0 && dayCardio.length === 0 ? (
                    <span className={styles.dayMuted}>—</span>
                  ) : (
                    <>
                      {dayGym.length > 0 ? (
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
                      ) : null}
                      {dayCardio.length > 0 ? (
                        <ul className={styles.gymList} aria-label="Cardiopass">
                          {dayCardio.map((s) => (
                            <li
                              key={s.id}
                              className={[
                                styles.gymChip,
                                styles.cardioChip,
                                s.placement.doneAt ? styles.gymChipDone : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              title={
                                s.placement.note
                                  ? `${s.label}: ${s.placement.note}`
                                  : s.label
                              }
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
                      ) : null}
                    </>
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
                </div>

                {habitDay && habitWeek.habits.length > 0 ? (
                  <div className={styles.dayHabits} aria-label="Dagliga spårare">
                    {habitWeek.habits.map((h) => (
                      <HabitDayChip
                        key={h.id}
                        habit={h}
                        status={habitDay.statuses[h.id] ?? null}
                        isFuture={d.isFuture}
                      />
                    ))}
                  </div>
                ) : null}
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

function HabitDayChip({
  habit,
  status,
  isFuture,
}: {
  habit: Habit;
  status: HabitStatus | null;
  isFuture: boolean;
}) {
  const label = isFuture
    ? "Kommande dag"
    : HABIT_STATUS_LABEL[status ?? "empty"];

  return (
    <span
      className={[
        styles.habitChip,
        isFuture ? styles.habitChipFuture : "",
        status ? styles[`habitChip_${status}`] : styles.habitChip_empty,
      ]
        .filter(Boolean)
        .join(" ")}
      title={`${habit.label}: ${label}`}
      aria-label={`${habit.label}: ${label}`}
    >
      <span className={styles.habitChipIcon} aria-hidden>
        {habit.icon}
      </span>
      {!isFuture ? (
        <HabitStatusDot status={status} compact className={styles.habitChipDot} />
      ) : null}
    </span>
  );
}

function HabitStatusDot({
  status,
  compact = false,
  className,
  ...rest
}: {
  status: HabitStatus | null;
  compact?: boolean;
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  const resolved = status ?? "empty";
  return (
    <span
      className={[
        styles.habitDot,
        styles[`habitDot_${resolved}`],
        compact ? styles.habitDotCompact : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
      {...rest}
    />
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
