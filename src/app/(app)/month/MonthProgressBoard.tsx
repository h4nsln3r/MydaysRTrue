import Link from "next/link";
import type { Habit, HabitStatus } from "@/lib/habits";
import type { MonthDay, MonthSummary } from "@/lib/habits.server";
import {
  formatMonthlyTaskDetail,
  type MonthlyTaskForMonth,
} from "@/lib/tasks";
import { dateInMonth, formatBillAmountKr, isMonthlyBill, monthStartFromDate, resolveMonthlyTaskSchedule } from "@/lib/monthly-bills";
import { formatDayShort } from "@/lib/date";
import type { MonthlyFinanceSnapshot } from "@/lib/monthly-finance";
import type { TaskCategory } from "@/lib/tasks";
import { MonthlyFinanceTable } from "./MonthlyFinanceTable";
import { MonthlyBillsSummary } from "./MonthlyBillsSummary";
import styles from "./month-progress.module.scss";

interface Props {
  summary: MonthSummary;
  monthStart: string;
  monthlyTasks: MonthlyTaskForMonth[];
  monthlyDone: number;
  monthlyTotal: number;
  today: string;
  financeSnapshot: MonthlyFinanceSnapshot | null;
  financeTaskId: string | null;
  salaryTaskId?: string | null;
  salaryAmount?: number | null;
  categories: TaskCategory[];
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
  monthStart,
  monthlyTasks,
  monthlyDone,
  monthlyTotal,
  today,
  financeSnapshot,
  financeTaskId,
  salaryTaskId = null,
  salaryAmount = null,
  categories,
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
                    <DayScore
                      day={d}
                      habits={summary.habits}
                      monthlyTasks={monthlyTasks}
                    />
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

      <MonthlyFinanceTable
        monthStart={monthStart}
        financeTaskId={financeTaskId}
        snapshot={financeSnapshot}
        salaryTaskId={salaryTaskId}
        salaryAmount={salaryAmount}
        readOnly
      />

      <MonthlyBillsSummary tasks={monthlyTasks} categories={categories} />

      {hasTasks ? (
        <MonthlyTasksSummary
          tasks={monthlyTasks}
          categories={categories}
          monthStart={monthStart}
          today={today}
        />
      ) : null}
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

function MonthlyTasksSummary({
  tasks,
  categories,
  monthStart,
  today,
}: {
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
  monthStart: string;
  today: string;
}) {
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <aside className={styles.monthlyAside} aria-label="Månadsuppgifter">
      <p className={styles.monthlyAsideTitle}>Månadsuppgifter</p>
      <div className={styles.monthlyGrid}>
        {tasks.map((task) => (
          <MonthlyTaskCard
            key={task.id}
            task={task}
            category={task.categoryId ? catById.get(task.categoryId) ?? null : null}
            categories={categories}
            monthStart={monthStart}
            today={today}
          />
        ))}
      </div>
    </aside>
  );
}

function MonthlyTaskCard({
  task,
  category,
  categories,
  monthStart,
  today,
}: {
  task: MonthlyTaskForMonth;
  category: TaskCategory | null;
  categories: TaskCategory[];
  monthStart: string;
  today: string;
}) {
  const done = Boolean(task.completion?.doneAt);
  const schedule = resolveMonthlyTaskSchedule(task, task.completion, monthStart);
  const scheduledDay = schedule.dayOfMonth;
  const scheduledDate =
    scheduledDay != null ? dateInMonth(monthStart, scheduledDay) : null;
  const billAmountLabel = formatBillAmountKr(task);
  const isBill = isMonthlyBill(task, categories);
  const isFuture = scheduledDate ? scheduledDate > today : false;
  const isToday = scheduledDate === today;
  const planHref = `/month?m=${monthStart.slice(0, 7)}&view=plan`;
  const dayHref =
    scheduledDate == null
      ? planHref
      : isToday
        ? "/"
        : `/day/${scheduledDate}`;

  let status: "done" | "planned" | "missed" | "unplaced" = "unplaced";
  if (schedule.isPlanned) {
    if (done) status = "done";
    else if (scheduledDate && (isFuture || isToday)) status = "planned";
    else if (scheduledDate) status = "missed";
    else status = "planned";
  }

  return (
    <div
      className={cellClass(
        styles.monthlyCard,
        status === "done" && styles.monthlyCard_done,
        status === "planned" && styles.monthlyCard_planned,
        status === "missed" && styles.monthlyCard_missed,
        status === "unplaced" && styles.monthlyCard_unplaced,
      )}
    >
      <div className={styles.monthlyCardMain}>
        <span className={styles.monthlyCardIcon} aria-hidden>
          {task.icon}
        </span>
        <div className={styles.monthlyCardBody}>
          <p className={styles.monthlyCardKicker}>{task.title}</p>
          {category ? (
            <p className={styles.monthlyCardCategory}>
              {category.icon} {category.name}
            </p>
          ) : null}
          {isBill && billAmountLabel ? (
            <p className={styles.monthlyCardDetail}>{billAmountLabel}</p>
          ) : null}
          {status === "unplaced" ? (
            <p className={styles.monthlyCardDetail}>Ej planerad den här månaden</p>
          ) : scheduledDay != null ? (
            <p className={styles.monthlyCardDetail}>
              Dag {scheduledDay}
              {scheduledDate ? (
                <span className={styles.monthlyCardDate}>
                  {" "}
                  · {formatDayShort(scheduledDate)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className={styles.monthlyCardDetail}>Planerad vecka (ingen specifik dag)</p>
          )}
          {done && formatMonthlyTaskDetail(task, task.completion) ? (
            <p className={styles.monthlyCardHint}>
              {formatMonthlyTaskDetail(task, task.completion)}
            </p>
          ) : done && task.completion?.note ? (
            <p className={styles.monthlyCardHint}>{task.completion.note}</p>
          ) : status === "planned" ? (
            <p className={styles.monthlyCardHint}>Planerad uppgift</p>
          ) : status === "missed" ? (
            <p className={styles.monthlyCardHint}>Inte klar ännu</p>
          ) : null}
        </div>
      </div>

      <div className={styles.monthlyCardAside}>
        {status === "done" ? (
          <span className={styles.monthlyStatusDone} aria-label="Klar">
            ✓
          </span>
        ) : status === "planned" ? (
          <span className={styles.monthlyStatusPlanned} aria-label="Planerad">
            ○
          </span>
        ) : status === "missed" ? (
          <span className={styles.monthlyStatusMissed} aria-label="Saknas">
            !
          </span>
        ) : null}
        <Link
          href={status === "done" && scheduledDate ? dayHref : planHref}
          className={styles.monthlyCardLink}
        >
          {status === "unplaced"
            ? "Öppna månadsplan"
            : done
              ? "Visa dag"
              : "Öppna månadsplan"}
        </Link>
      </div>
    </div>
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

function DayScore({
  day,
  habits,
  monthlyTasks,
}: {
  day: MonthDay;
  habits: Habit[];
  monthlyTasks: MonthlyTaskForMonth[];
}) {
  let hit = 0;
  let total = 0;

  for (const h of habits) {
    total += 1;
    if (day.statuses[h.id] === "yes") hit += 1;
  }

  for (const task of monthlyTasks) {
    const monthStart = monthStartFromDate(day.date);
    const schedule = resolveMonthlyTaskSchedule(
      task,
      task.completion,
      monthStart,
    );
    if (schedule.dayOfMonth === day.dayOfMonth) {
      total += 1;
      if (task.completion?.doneAt) hit += 1;
    }
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
