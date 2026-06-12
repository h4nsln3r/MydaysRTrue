import Link from "next/link";
import type { Habit, HabitStatus } from "@/lib/habits";
import type { MonthDay, MonthSummary } from "@/lib/habits.server";
import type { MonthlyTaskForMonth } from "@/lib/tasks";
import { effectiveScheduledDay } from "@/lib/monthly-bills";
import styles from "./month-progress.module.scss";

interface Props {
  summary: MonthSummary;
  monthlyTasks: MonthlyTaskForMonth[];
  monthlyDone: number;
  monthlyTotal: number;
  today: string;
}

const HABIT_STATUS_LABEL: Record<HabitStatus | "empty", string> = {
  yes: "Ja",
  half: "Delvis",
  no: "Nej",
  empty: "—",
};

const WEEKDAY_HEAD = ["M", "T", "O", "T", "F", "L", "S"];

export function MonthProgressBoard({
  summary,
  monthlyTasks,
  monthlyDone,
  monthlyTotal,
  today,
}: Props) {
  const pastDays = summary.days.filter((d) => !d.isFuture).length;
  const colSpan = summary.days.length + 2;
  const hasTasks = monthlyTasks.length > 0;

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
        {hasTasks ? (
          <span className={styles.legendGroup}>
            <span className={styles.legendTitle}>Uppgifter</span>
            <span className={styles.legendMark}>✓ klar</span>
            <span className={styles.legendMarkDim}>○ planerad</span>
          </span>
        ) : null}
        {monthlyTotal > 0 ? (
          <span className={styles.legendGroup}>
            <span className={styles.legendTitle}>Månad</span>
            <span className={styles.legendStat}>
              {monthlyDone}/{monthlyTotal} klara
            </span>
          </span>
        ) : null}
      </div>

      <div className={styles.spreadsheetWrap}>
        <table className={styles.sheet}>
          <thead>
            <tr>
              <th className={[styles.cornerCell, styles.stickyCol].join(" ")} scope="col">
                Kategori
              </th>
              {summary.days.map((d) => (
                <DayHeader key={d.date} day={d} today={today} />
              ))}
              <th className={[styles.totalHead, styles.stickyColRight].join(" ")} scope="col">
                ∑
              </th>
            </tr>
            <tr className={styles.weekdayRow}>
              <th className={[styles.weekdayCorner, styles.stickyCol].join(" ")} scope="col" />
              {summary.days.map((d) => (
                <th
                  key={`wd-${d.date}`}
                  className={cellClass(
                    styles.weekdayHead,
                    d.isToday && styles.weekdayHeadToday,
                    d.isFuture && styles.weekdayHeadFuture,
                  )}
                  scope="col"
                >
                  {WEEKDAY_HEAD[d.weekday - 1] ?? ""}
                </th>
              ))}
              <th className={[styles.weekdayCorner, styles.stickyColRight].join(" ")} scope="col" />
            </tr>
          </thead>
          <tbody>
            <SectionRow label="Dagliga spårare" colSpan={colSpan} />

            {summary.habits.map((h) => (
              <tr key={h.id}>
                <RowLabel sticky icon={h.icon} label={h.label} />
                {summary.days.map((d) => {
                  const status = d.statuses[h.id] ?? null;
                  return (
                    <td
                      key={d.date}
                      className={cellClass(
                        styles.dataCell,
                        d.isFuture && styles.cellFuture,
                        d.isToday && styles.cellToday,
                        !d.isFuture && styles[`habitCell_${status ?? "empty"}`],
                      )}
                      title={`${h.label}, dag ${d.dayOfMonth}: ${
                        d.isFuture ? "Kommande" : HABIT_STATUS_LABEL[status ?? "empty"]
                      }`}
                    >
                      {!d.isFuture ? <StatusMark status={status} /> : null}
                    </td>
                  );
                })}
                <TotalCell
                  value={summary.yesByHabit[h.id] ?? 0}
                  total={pastDays}
                  highlight={(summary.yesByHabit[h.id] ?? 0) === pastDays && pastDays > 0}
                />
              </tr>
            ))}

            {hasTasks ? (
              <>
                <SectionRow label="Månadsuppgifter" colSpan={colSpan} />
                {monthlyTasks.map((task) => (
                  <TaskRow key={task.id} task={task} days={summary.days} />
                ))}
              </>
            ) : null}
          </tbody>
          <tfoot>
            <tr className={styles.footerRow}>
              <td className={[styles.footerLabel, styles.stickyCol].join(" ")}>Dagsresultat</td>
              {summary.days.map((d) => (
                <td
                  key={d.date}
                  className={cellClass(
                    styles.footerCell,
                    d.isFuture && styles.cellFuture,
                    d.isToday && styles.cellToday,
                  )}
                >
                  {!d.isFuture ? (
                    <DayScore day={d} habits={summary.habits} />
                  ) : null}
                </td>
              ))}
              <td className={[styles.footerCell, styles.footerTotal, styles.stickyColRight].join(" ")}>
                <span className={styles.footerTotalValue}>
                  {monthTotalScore(summary, monthlyDone, monthlyTotal)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function DayHeader({ day, today }: { day: MonthDay; today: string }) {
  const className = cellClass(
    styles.dayHead,
    day.isToday && styles.dayHeadToday,
    day.isFuture && styles.dayHeadFuture,
  );

  const inner = <span className={styles.dayHeadNum}>{day.dayOfMonth}</span>;

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
        href={day.date === today ? "/" : `/day/${day.date}`}
        className={styles.dayHeadLink}
        aria-label={`Dag ${day.dayOfMonth}`}
      >
        {inner}
      </Link>
    </th>
  );
}

function TaskRow({
  task,
  days,
}: {
  task: MonthlyTaskForMonth;
  days: MonthDay[];
}) {
  const done = Boolean(task.completion?.doneAt);
  const scheduledDay = effectiveScheduledDay(task, task.completion);

  return (
    <tr>
      <RowLabel sticky icon={task.icon} label={task.title} />
      {days.map((d) => {
        const isScheduled = scheduledDay === d.dayOfMonth;
        if (!isScheduled) {
          return (
            <td
              key={d.date}
              className={cellClass(styles.dataCell, d.isFuture && styles.cellFuture, d.isToday && styles.cellToday)}
            />
          );
        }

        return (
          <td
            key={d.date}
            className={cellClass(
              styles.dataCell,
              styles.taskCell,
              d.isFuture && styles.cellFuture,
              d.isToday && styles.cellToday,
              !d.isFuture && done && styles.taskCellDone,
              !d.isFuture && !done && styles.taskCellScheduled,
            )}
            title={task.title}
          >
            {!d.isFuture ? (
              done ? (
                <span className={styles.doneMark} aria-label="Klar">
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
        value={done ? 1 : 0}
        total={1}
        highlight={done}
        muted={scheduledDay != null && !done}
      />
    </tr>
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
      title={label}
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
}: {
  value: number;
  total: number | null;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={cellClass(
        styles.totalCell,
        highlight && styles.totalCellDone,
        muted && styles.totalCellMuted,
      )}
    >
      {total != null ? (
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

function DayScore({ day, habits }: { day: MonthDay; habits: Habit[] }) {
  let hit = 0;
  let total = 0;

  for (const h of habits) {
    total += 1;
    if (day.statuses[h.id] === "yes") hit += 1;
  }

  if (total === 0) return <span className={styles.emptyMark}>—</span>;

  const pct = Math.round((hit / total) * 100);

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
  return <span className={cellClass(styles.swatch, styles[`swatch_${status}`])} aria-hidden />;
}

function cellClass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function monthTotalScore(
  summary: MonthSummary,
  monthlyDone: number,
  monthlyTotal: number,
): string {
  const pastDays = summary.days.filter((d) => !d.isFuture).length;
  const habitYes = Object.values(summary.yesByHabit).reduce((a, b) => a + b, 0);
  const habitTotal = summary.habits.length * pastDays;
  const hit = habitYes + monthlyDone;
  const total = habitTotal + monthlyTotal;
  if (total === 0) return "—";
  return `${hit}/${total}`;
}
