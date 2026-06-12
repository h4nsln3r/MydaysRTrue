import Link from "next/link";
import { formatDayShort, formatWeekdayShort, isoWeekdayFromLocalISO } from "@/lib/date";
import { formatWaterTemp, type BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { GymSessionForWeek } from "@/lib/gym";
import type { Habit, HabitStatus } from "@/lib/habits";
import type { WeekHabitSummary } from "@/lib/habits.server";
import type { WeekSummary, WeekDay } from "@/lib/water.server";
import { waterDayStatus, type WaterDayStatus } from "@/lib/water";
import type { WeeklyTaskForWeek } from "@/lib/tasks";
import { formatWeightKg } from "@/lib/format";
import type { WeightWeekPlan } from "@/lib/weight";
import styles from "./week-progress.module.scss";

interface Props {
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  weightPlan: WeightWeekPlan;
}

const WATER_LABEL: Record<WaterDayStatus, string> = {
  future: "Kommande",
  good: "Mål uppnått",
  almost: "Nästan",
  low: "Lågt",
};

const HABIT_STATUS_LABEL: Record<HabitStatus | "empty", string> = {
  yes: "Ja",
  half: "Delvis",
  no: "Nej",
  empty: "—",
};

const WEEKDAY_HEAD = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export function WeekProgressBoard({
  week,
  habitWeek,
  gymSessions,
  cardioSessions,
  bathingSessions,
  tasks,
  weightPlan,
}: Props) {
  const pastDays = habitWeek.days.filter((d) => !d.isFuture).length;

  const gymByWeekday = groupByWeekday(gymSessions);
  const cardioByWeekday = groupByWeekday(cardioSessions);
  const bathingByWeekday = groupByWeekday(bathingSessions);
  const tasksByWeekday = groupTasksByWeekday(tasks);
  const habitDayByDate = new Map(habitWeek.days.map((d) => [d.date, d]));

  const placedGym = gymSessions.filter((s) => s.placement.weekday != null);
  const placedCardio = cardioSessions.filter((s) => s.placement.weekday != null);
  const placedBathing = bathingSessions.filter((s) => s.placement.weekday != null);
  const placedTasks = tasks.filter((t) => t.placement);
  const gymDone = placedGym.filter((s) => s.placement.doneAt).length;
  const cardioDone = placedCardio.filter((s) => s.placement.doneAt).length;
  const bathingDone = placedBathing.filter((s) => s.placement.doneAt).length;
  const tasksDone = placedTasks.filter((t) => t.placement?.doneAt).length;
  const weightActive = weightPlan.enabled && weightPlan.weekday != null;
  const weightDone = Boolean(weightPlan.log);
  const colSpan = week.days.length + 2;

  return (
    <div className={styles.board}>
      <div className={styles.legendBar} aria-label="Förklaring">
        <span className={styles.legendGroup}>
          <span className={styles.legendTitle}>Vanor</span>
          <StatusSwatch status="yes" />
          <StatusSwatch status="half" />
          <StatusSwatch status="no" />
          <StatusSwatch status="empty" />
        </span>
        <span className={styles.legendGroup}>
          <span className={styles.legendTitle}>Vatten</span>
          <WaterSwatch status="good" />
          <WaterSwatch status="almost" />
          <WaterSwatch status="low" />
        </span>
        <span className={styles.legendGroup}>
          <span className={styles.legendTitle}>Träning</span>
          <span className={styles.legendMark}>✓ klar</span>
          <span className={styles.legendMarkDim}>○ planerad</span>
        </span>
      </div>

      <div className={styles.spreadsheetWrap}>
        <table className={styles.sheet}>
          <thead>
            <tr>
              <th className={[styles.cornerCell, styles.stickyCol].join(" ")} scope="col">
                Kategori
              </th>
              {week.days.map((d, i) => (
                <DayHeader key={d.date} day={d} fallbackLabel={WEEKDAY_HEAD[i] ?? ""} />
              ))}
              <th className={[styles.totalHead, styles.stickyColRight].join(" ")} scope="col">
                ∑
              </th>
            </tr>
          </thead>
          <tbody>
            <SectionRow label="Dagligt" colSpan={colSpan} />

            <tr>
              <RowLabel sticky icon="💧" label="Vatten" />
              {week.days.map((d) => (
                <td
                  key={d.date}
                  className={cellClass(
                    styles.dataCell,
                    d.isFuture && styles.cellFuture,
                    d.isToday && styles.cellToday,
                    styles[`waterCell_${waterDayStatus(d)}`],
                  )}
                  title={`${formatDayShort(d.date)}: ${WATER_LABEL[waterDayStatus(d)]}`}
                >
                  <WaterMark status={waterDayStatus(d)} />
                </td>
              ))}
              <TotalCell
                value={week.daysHit}
                total={pastDays}
                highlight={week.daysHit === pastDays && pastDays > 0}
              />
            </tr>

            {habitWeek.habits.map((h) => (
              <tr key={h.id}>
                <RowLabel sticky icon={h.icon} label={h.label} />
                {week.days.map((d) => {
                  const habitDay = habitDayByDate.get(d.date);
                  const status = habitDay?.statuses[h.id] ?? null;
                  return (
                    <td
                      key={d.date}
                      className={cellClass(
                        styles.dataCell,
                        d.isFuture && styles.cellFuture,
                        d.isToday && styles.cellToday,
                        !d.isFuture && styles[`habitCell_${status ?? "empty"}`],
                      )}
                      title={`${h.label}, ${formatDayShort(d.date)}: ${
                        d.isFuture ? "Kommande" : HABIT_STATUS_LABEL[status ?? "empty"]
                      }`}
                    >
                      {!d.isFuture ? <StatusMark status={status} /> : null}
                    </td>
                  );
                })}
                <TotalCell
                  value={habitWeek.yesByHabit[h.id] ?? 0}
                  total={pastDays}
                  highlight={(habitWeek.yesByHabit[h.id] ?? 0) === pastDays && pastDays > 0}
                />
              </tr>
            ))}

            <SectionRow label="Träning & hälsa" colSpan={colSpan} />

            <TrainingRow
              icon="🏋️"
              label="Gym"
              days={week.days}
              byWeekday={gymByWeekday}
              done={gymDone}
              total={placedGym.length}
              renderSession={(s) => ({
                icon: s.icon,
                done: Boolean(s.placement.doneAt),
                title: s.label,
              })}
            />

            <TrainingRow
              icon="🏃"
              label="Cardio"
              days={week.days}
              byWeekday={cardioByWeekday}
              done={cardioDone}
              total={placedCardio.length}
              chipClass={styles.cardioChip}
              renderSession={(s) => ({
                icon: s.icon,
                done: Boolean(s.placement.doneAt),
                title: s.placement.note ? `${s.label}: ${s.placement.note}` : s.label,
              })}
            />

            <TrainingRow
              icon="🧖"
              label="Bad & bastu"
              days={week.days}
              byWeekday={bathingByWeekday}
              done={bathingDone}
              total={placedBathing.length}
              chipClass={styles.bathingChip}
              renderSession={(s) => ({
                icon: s.icon,
                done: Boolean(s.placement.doneAt),
                title:
                  s.placement.waterTempC != null
                    ? `${s.label}: ${formatWaterTemp(s.placement.waterTempC)}`
                    : s.description
                      ? `${s.label}: ${s.description}`
                      : s.label,
              })}
            />

            {weightPlan.enabled ? (
              <tr>
                <RowLabel sticky icon="⚖️" label="Vikt" />
                {week.days.map((d) => {
                  const weekday = isoWeekdayFromLocalISO(d.date);
                  const scheduled = weightPlan.weekday === weekday;
                  const logged =
                    scheduled && weightPlan.log?.localDate === d.date;
                  return (
                    <td
                      key={d.date}
                      className={cellClass(
                        styles.dataCell,
                        d.isFuture && styles.cellFuture,
                        d.isToday && styles.cellToday,
                        scheduled && !d.isFuture && logged && styles.habitCell_yes,
                        scheduled && !d.isFuture && !logged && styles.habitCell_empty,
                      )}
                      title={
                        !scheduled
                          ? undefined
                          : logged && weightPlan.log
                            ? `Vikt: ${formatWeightKg(weightPlan.log.weightKg)}`
                            : "Planerad vägning"
                      }
                    >
                      {scheduled && !d.isFuture ? (
                        logged ? (
                          <span className={styles.doneMark} aria-label="Loggad">
                            ✓
                          </span>
                        ) : (
                          <span className={styles.plannedMark} aria-label="Planerad">
                            ○
                          </span>
                        )
                      ) : null}
                    </td>
                  );
                })}
                <TotalCell
                  value={weightActive ? (weightDone ? 1 : 0) : null}
                  total={weightActive ? 1 : null}
                  muted={!weightActive}
                  mutedLabel={!weightActive ? "Av" : !weightDone && weightActive ? "0/1" : undefined}
                  highlight={weightDone}
                />
              </tr>
            ) : null}

            <SectionRow label="Uppgifter" colSpan={colSpan} />

            <tr>
              <RowLabel sticky icon="📋" label="Veckouppgifter" />
              {week.days.map((d) => {
                const weekday = isoWeekdayFromLocalISO(d.date);
                const dayTasks = tasksByWeekday.get(weekday) ?? [];
                const dayDone = dayTasks.filter((t) => t.placement?.doneAt).length;
                const allDone = dayTasks.length > 0 && dayDone === dayTasks.length;
                return (
                  <td
                    key={d.date}
                    className={cellClass(
                      styles.dataCell,
                      styles.taskCell,
                      d.isFuture && styles.cellFuture,
                      d.isToday && styles.cellToday,
                      allDone && styles.taskCellDone,
                    )}
                  >
                    {dayTasks.length === 0 ? (
                      <span className={styles.emptyMark}>—</span>
                    ) : (
                      <span className={styles.taskFraction}>
                        {dayDone}/{dayTasks.length}
                      </span>
                    )}
                  </td>
                );
              })}
              <TotalCell
                value={tasksDone}
                total={placedTasks.length || null}
                muted={placedTasks.length === 0}
                mutedLabel={placedTasks.length === 0 ? "—" : undefined}
                highlight={placedTasks.length > 0 && tasksDone === placedTasks.length}
              />
            </tr>
          </tbody>
          <tfoot>
            <tr className={styles.footerRow}>
              <td className={[styles.footerLabel, styles.stickyCol].join(" ")}>Veckans total</td>
              {week.days.map((d) => (
                <td
                  key={d.date}
                  className={cellClass(
                    styles.footerCell,
                    d.isFuture && styles.cellFuture,
                    d.isToday && styles.cellToday,
                  )}
                >
                  {!d.isFuture ? (
                    <DayScore
                      day={d}
                      habitDay={habitDayByDate.get(d.date)}
                      habits={habitWeek.habits}
                      gym={gymByWeekday.get(isoWeekdayFromLocalISO(d.date)) ?? []}
                      cardio={cardioByWeekday.get(isoWeekdayFromLocalISO(d.date)) ?? []}
                      bathing={bathingByWeekday.get(isoWeekdayFromLocalISO(d.date)) ?? []}
                      tasks={tasksByWeekday.get(isoWeekdayFromLocalISO(d.date)) ?? []}
                      weightScheduled={
                        weightPlan.enabled && weightPlan.weekday === isoWeekdayFromLocalISO(d.date)
                      }
                      weightLogged={
                        weightPlan.enabled &&
                        weightPlan.weekday === isoWeekdayFromLocalISO(d.date) &&
                        weightPlan.log?.localDate === d.date
                      }
                    />
                  ) : null}
                </td>
              ))}
              <td className={[styles.footerCell, styles.footerTotal, styles.stickyColRight].join(" ")}>
                <span className={styles.footerTotalValue}>
                  {summaryScore({
                    gymDone,
                    gymTotal: placedGym.length,
                    cardioDone,
                    cardioTotal: placedCardio.length,
                    bathingDone,
                    bathingTotal: placedBathing.length,
                    tasksDone,
                    tasksTotal: placedTasks.length,
                    waterHit: week.daysHit,
                    waterTotal: pastDays,
                    habitYes: Object.values(habitWeek.yesByHabit).reduce((a, b) => a + b, 0),
                    habitTotal: habitWeek.habits.length * pastDays,
                    weightDone: weightActive && weightDone ? 1 : 0,
                    weightTotal: weightActive ? 1 : 0,
                  })}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DayHeader({ day, fallbackLabel }: { day: WeekDay; fallbackLabel: string }) {
  const label = formatWeekdayShort(day.date);
  const dayNum = parseLocalDayNum(day.date);
  const className = cellClass(
    styles.dayHead,
    day.isToday && styles.dayHeadToday,
    day.isFuture && styles.dayHeadFuture,
  );

  const inner = (
    <>
      <span className={styles.dayHeadWeekday}>{label || fallbackLabel}</span>
      <span className={styles.dayHeadDate}>{dayNum}</span>
    </>
  );

  if (day.isFuture) {
    return (
      <th className={className} scope="col">
        {inner}
      </th>
    );
  }

  return (
    <th className={className} scope="col">
      <Link
        href={day.isToday ? "/" : `/day/${day.date}`}
        className={styles.dayHeadLink}
        aria-label={formatDayShort(day.date)}
      >
        {inner}
      </Link>
    </th>
  );
}

function SectionRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className={styles.sectionRow}>
      <td colSpan={colSpan}>{label}</td>
    </tr>
  );
}

function RowLabel({
  icon,
  label,
  sticky,
}: {
  icon: string;
  label: string;
  sticky?: boolean;
}) {
  return (
    <th
      className={[styles.rowLabel, sticky ? styles.stickyCol : ""].filter(Boolean).join(" ")}
      scope="row"
    >
      <span className={styles.rowIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.rowText}>{label}</span>
    </th>
  );
}

function TotalCell({
  value,
  total,
  highlight,
  muted,
  mutedLabel,
}: {
  value: number | null;
  total: number | null;
  highlight?: boolean;
  muted?: boolean;
  mutedLabel?: string;
}) {
  return (
    <td
      className={cellClass(
        styles.totalCell,
        highlight && styles.totalCellDone,
        muted && styles.totalCellMuted,
      )}
    >
      {muted && mutedLabel ? (
        <span className={styles.emptyMark}>{mutedLabel}</span>
      ) : value != null && total != null ? (
        <span className={styles.totalFraction}>
          <span className={styles.totalValue}>{value}</span>
          <span className={styles.totalSlash}>/{total}</span>
        </span>
      ) : (
        <span className={styles.emptyMark}>—</span>
      )}
    </td>
  );
}

function TrainingRow<T extends { id: string; placement: { weekday: number | null; doneAt: string | null } }>({
  icon,
  label,
  days,
  byWeekday,
  done,
  total,
  chipClass,
  renderSession,
}: {
  icon: string;
  label: string;
  days: WeekDay[];
  byWeekday: Map<number, T[]>;
  done: number;
  total: number;
  chipClass?: string;
  renderSession: (item: T) => { icon: string; done: boolean; title: string };
}) {
  return (
    <tr>
      <RowLabel sticky icon={icon} label={label} />
      {days.map((d) => {
        const sessions = byWeekday.get(isoWeekdayFromLocalISO(d.date)) ?? [];
        return (
          <td
            key={d.date}
            className={cellClass(
              styles.dataCell,
              styles.trainingCell,
              d.isFuture && styles.cellFuture,
              d.isToday && styles.cellToday,
            )}
          >
            {sessions.length === 0 ? (
              <span className={styles.emptyMark}>—</span>
            ) : (
              <ul className={styles.sessionList}>
                {sessions.map((s) => {
                  const meta = renderSession(s);
                  return (
                    <li
                      key={s.id}
                      className={cellClass(
                        styles.sessionChip,
                        chipClass,
                        meta.done && styles.sessionChipDone,
                      )}
                      title={meta.title}
                    >
                      <span aria-hidden>{meta.icon}</span>
                      {meta.done ? (
                        <span className={styles.sessionCheck} aria-hidden>
                          ✓
                        </span>
                      ) : (
                        <span className={styles.sessionPending} aria-hidden>
                          ○
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </td>
        );
      })}
      <TotalCell
        value={done}
        total={total || null}
        muted={total === 0}
        mutedLabel={total === 0 ? "—" : undefined}
        highlight={total > 0 && done === total}
      />
    </tr>
  );
}

function DayScore({
  day,
  habitDay,
  habits,
  gym,
  cardio,
  bathing,
  tasks,
  weightScheduled,
  weightLogged,
}: {
  day: WeekDay;
  habitDay: { statuses: Record<string, HabitStatus | null> } | undefined;
  habits: Habit[];
  gym: GymSessionForWeek[];
  cardio: CardioSessionForWeek[];
  bathing: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  weightScheduled: boolean;
  weightLogged: boolean;
}) {
  let hit = 0;
  let total = 0;

  if (waterDayStatus(day) === "good") hit += 1;
  total += 1;

  for (const h of habits) {
    total += 1;
    if (habitDay?.statuses[h.id] === "yes") hit += 1;
  }

  for (const s of [...gym, ...cardio, ...bathing]) {
    total += 1;
    if (s.placement.doneAt) hit += 1;
  }

  if (tasks.length > 0) {
    total += 1;
    if (tasks.every((t) => t.placement?.doneAt)) hit += 1;
  }

  if (weightScheduled) {
    total += 1;
    if (weightLogged) hit += 1;
  }

  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;

  return (
    <span
      className={cellClass(
        styles.dayScore,
        pct >= 80 && styles.dayScoreGood,
        pct >= 50 && pct < 80 && styles.dayScoreMid,
        pct < 50 && styles.dayScoreLow,
      )}
      title={`${hit}/${total} klart (${pct}%)`}
    >
      {pct}%
    </span>
  );
}

function StatusMark({ status }: { status: HabitStatus | null }) {
  const resolved = status ?? "empty";
  const label = HABIT_STATUS_LABEL[resolved];
  return (
    <span className={cellClass(styles.statusMark, styles[`statusMark_${resolved}`])} aria-label={label}>
      {resolved === "yes" ? "✓" : resolved === "half" ? "½" : resolved === "no" ? "✗" : "·"}
    </span>
  );
}

function StatusSwatch({ status }: { status: HabitStatus | "empty" }) {
  return (
    <span
      className={cellClass(styles.swatch, styles[`swatch_${status}`])}
      aria-hidden
    />
  );
}

function WaterMark({ status }: { status: WaterDayStatus }) {
  if (status === "future") return null;
  return (
    <span className={cellClass(styles.waterMark, styles[`waterMark_${status}`])} aria-hidden>
      {status === "good" ? "✓" : status === "almost" ? "~" : "!"}
    </span>
  );
}

function WaterSwatch({ status }: { status: WaterDayStatus }) {
  return (
    <span
      className={cellClass(styles.swatch, styles[`swatch_water_${status}`])}
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellClass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function parseLocalDayNum(localDate: string): number {
  return Number(localDate.split("-")[2]);
}

function groupByWeekday<T extends { placement: { weekday: number | null } }>(
  items: T[],
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    if (item.placement.weekday == null) continue;
    const list = map.get(item.placement.weekday) ?? [];
    list.push(item);
    map.set(item.placement.weekday, list);
  }
  return map;
}

function groupTasksByWeekday(tasks: WeeklyTaskForWeek[]): Map<number, WeeklyTaskForWeek[]> {
  const map = new Map<number, WeeklyTaskForWeek[]>();
  for (const t of tasks) {
    if (t.placement?.weekday == null) continue;
    const list = map.get(t.placement.weekday) ?? [];
    list.push(t);
    map.set(t.placement.weekday, list);
  }
  return map;
}

function summaryScore(parts: {
  gymDone: number;
  gymTotal: number;
  cardioDone: number;
  cardioTotal: number;
  bathingDone: number;
  bathingTotal: number;
  tasksDone: number;
  tasksTotal: number;
  waterHit: number;
  waterTotal: number;
  habitYes: number;
  habitTotal: number;
  weightDone: number;
  weightTotal: number;
}): string {
  const hit =
    parts.gymDone +
    parts.cardioDone +
    parts.bathingDone +
    parts.tasksDone +
    parts.waterHit +
    parts.habitYes +
    parts.weightDone;
  const total =
    parts.gymTotal +
    parts.cardioTotal +
    parts.bathingTotal +
    parts.tasksTotal +
    parts.waterTotal +
    parts.habitTotal +
    parts.weightTotal;
  if (total === 0) return "—";
  return `${hit}/${total}`;
}
