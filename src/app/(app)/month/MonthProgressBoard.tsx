import Link from "next/link";
import type { Habit, HabitStatus } from "@/lib/habits";
import { formatHabitPoints, habitStatusPoints } from "@/lib/habits";
import type { MonthDay, MonthSummary } from "@/lib/habits.server";
import {
  formatMonthlyTaskDetail,
  isMonthlyTaskRepeatable,
  monthlyTaskCompletions,
  type MonthlyTaskForMonth,
  type TaskCategory,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import { dateInMonth, formatBillAmountKr, isMonthlyBill, isMonthlyAmountTask, isMonthlyTaskComplete, monthlyTaskVisualStatus, monthlyTasksOnLocalDate, resolveMonthlyTaskSchedule } from "@/lib/monthly-bills";
import { formatDayShort, mondaysInRange, placementLocalDate } from "@/lib/date";
import { monthlyTaskDisplayTitle, type MonthlyFinanceSnapshot } from "@/lib/monthly-finance";
import { FestProgressCard } from "./FestProgressCard";
import { MonthlyFinanceTable } from "./MonthlyFinanceTable";
import { MonthlyBillsSummary } from "./MonthlyBillsSummary";
import {
  ExpensesSummary,
  SpendSplitOverview,
} from "@/components/ExpensesSummary/ExpensesSummary";
import type { ExpenseSummary } from "@/lib/expenses";
import {
  WORK_KINDS,
  WORK_KIND_ICON,
  WORK_KIND_LABEL,
  summarizeWorkLogs,
  workKindCountTotal,
  type WorkDailyLog,
} from "@/lib/work";
import type { MonthActivityProgress } from "@/lib/month-progress";
import {
  cardioMonthGoal,
  filterPlacedToRange,
  groupMonthlyTasksForDates,
  itemsOnDate,
  scoreWeeklyTasksForMonth,
  weeklyCategoryRowsForMonth,
  weeklyTasksInMonthByDate,
} from "@/lib/month-progress";
import { WEEK_PROGRESS_TRAINING_META } from "@/lib/week-progress-layout";
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
  expenseSummary: ExpenseSummary;
  shoppingSummary: ExpenseSummary;
  workByDate: Map<string, WorkDailyLog>;
  activity: MonthActivityProgress;
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
  expenseSummary,
  shoppingSummary,
  workByDate,
  activity,
}: Props) {
  const pastDays = summary.days.filter((d) => !d.isFuture).length;
  const colSpan = summary.days.length + 2;
  const hasTasks = monthlyTasks.length > 0;
  const workCounts = summarizeWorkLogs(workByDate.values());
  const workTotal = workKindCountTotal(workCounts);
  const monthEnd = activity.monthEnd;
  const mondayCount = mondaysInRange(monthStart, monthEnd).length;
  const gym = filterPlacedToRange(
    activity.weeks.flatMap((w) => w.gym),
    monthStart,
    monthEnd,
  );
  const cardio = filterPlacedToRange(
    activity.weeks.flatMap((w) => w.cardio),
    monthStart,
    monthEnd,
  );
  const sport = filterPlacedToRange(
    activity.weeks.flatMap((w) => w.sport),
    monthStart,
    monthEnd,
  );
  const bathing = filterPlacedToRange(
    activity.weeks.flatMap((w) => w.bathing),
    monthStart,
    monthEnd,
  );
  const gymDone = gym.filter((s) => s.placement.doneAt).length;
  const cardioDone = cardio.filter((s) => s.placement.doneAt).length;
  const cardioTotal = cardioMonthGoal(mondayCount);
  const sportDone = sport.filter((s) => s.placement.doneAt).length;
  const bathingDone = bathing.filter((s) => s.placement.doneAt).length;
  const weeklyRows = weeklyCategoryRowsForMonth(
    activity.weeks,
    activity.categories,
    monthStart,
    monthEnd,
  );
  const weeklyExpanded = weeklyTasksInMonthByDate(
    activity.weeks,
    monthStart,
    monthEnd,
  );
  const weeklyScore = scoreWeeklyTasksForMonth(
    activity.weeks,
    monthStart,
    monthEnd,
  );
  const monthlyRows = groupMonthlyTasksForDates(
    monthlyTasks,
    summary.days.map((d) => d.date),
    categories,
  );
  const weekScore = monthTotalScore({
    summary,
    monthlyDone,
    monthlyTotal,
    weeklyDone: weeklyScore.done,
    weeklyTotal: weeklyScore.total,
    gymDone,
    gymTotal: gym.length,
    cardioDone,
    cardioTotal,
    sportDone,
    sportTotal: sport.length,
    bathingDone,
    bathingTotal: bathing.length,
  });

  return (
    <div className={styles.board}>
      <SpendSplitOverview
        shopping={shoppingSummary}
        expenses={expenseSummary}
        title="Pengar denna månad"
      />
      <ExpensesSummary
        summary={shoppingSummary}
        title="Handling denna månad"
        icon="🛒"
        variant="shopping"
      />
      <ExpensesSummary
        summary={expenseSummary}
        title="Utgifter denna månad"
      />

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
        <span className={styles.legendGroup}>
          <span className={styles.legendTitle}>Jobb</span>
          {WORK_KINDS.map((kind) => (
            <span key={kind} className={styles.legendMarkDim}>
              {WORK_KIND_ICON[kind]} {WORK_KIND_LABEL[kind]} {workCounts[kind]}
            </span>
          ))}
        </span>
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

            <tr>
              <RowLabel sticky icon="💼" label="Jobb" />
              {summary.days.map((d) => {
                const log = workByDate.get(d.date);
                const kind = log?.startedAt ? log.kind : null;
                return (
                  <td
                    key={d.date}
                    className={cellClass(
                      styles.dataCell,
                      d.isFuture && styles.cellFuture,
                      d.isToday && styles.cellToday,
                    )}
                    title={
                      d.isFuture
                        ? "Kommande"
                        : kind
                          ? WORK_KIND_LABEL[kind]
                          : "Ej ifylld"
                    }
                  >
                    {!d.isFuture && kind ? (
                      <span aria-label={WORK_KIND_LABEL[kind]}>
                        {WORK_KIND_ICON[kind]}
                      </span>
                    ) : !d.isFuture ? (
                      <span className={styles.legendMarkDim}>·</span>
                    ) : null}
                  </td>
                );
              })}
              <TotalCell
                value={workTotal}
                total={null}
                muted={workTotal === 0}
              />
            </tr>

            <SectionRow label="Träning & hälsa" colSpan={colSpan} />
            <SessionCountRow
              icon={WEEK_PROGRESS_TRAINING_META.gym.icon}
              label={WEEK_PROGRESS_TRAINING_META.gym.label}
              days={summary.days}
              sessions={gym}
              done={gymDone}
              total={gym.length}
              extra={Math.max(0, gymDone - gym.length)}
            />
            <SessionCountRow
              icon={WEEK_PROGRESS_TRAINING_META.cardio.icon}
              label={WEEK_PROGRESS_TRAINING_META.cardio.label}
              days={summary.days}
              sessions={cardio}
              done={cardioDone}
              total={cardioTotal}
              extra={Math.max(0, cardioDone - cardioTotal)}
            />
            <SessionCountRow
              icon={WEEK_PROGRESS_TRAINING_META.sport.icon}
              label={WEEK_PROGRESS_TRAINING_META.sport.label}
              days={summary.days}
              sessions={sport}
              done={sportDone}
              total={sport.length}
              extra={Math.max(0, sportDone - sport.length)}
            />
            <SessionCountRow
              icon={WEEK_PROGRESS_TRAINING_META.bathing.icon}
              label={WEEK_PROGRESS_TRAINING_META.bathing.label}
              days={summary.days}
              sessions={bathing}
              done={bathingDone}
              total={bathing.length}
              extra={Math.max(0, bathingDone - bathing.length)}
            />

            {weeklyRows.length > 0 ? (
              <>
                <SectionRow label="Veckouppgifter" colSpan={colSpan} />
                {weeklyRows.map((group) => (
                  <TaskCountRow
                    key={group.category?.id ?? "weekly-uncategorized"}
                    icon={group.category?.icon ?? "📋"}
                    label={group.category?.name ?? "Övrigt"}
                    days={summary.days}
                    byDate={group.byDate}
                    done={group.done}
                    total={group.total}
                    extra={group.extra}
                    itemDone={(t) => Boolean(t.placement?.doneAt)}
                  />
                ))}
              </>
            ) : null}

            {monthlyRows.length > 0 ? (
              <>
                <SectionRow label="Månadsuppgifter" colSpan={colSpan} />
                {monthlyRows.map((group) => (
                  <TaskCountRow
                    key={group.category?.id ?? "monthly-uncategorized"}
                    icon={group.category?.icon ?? "📅"}
                    label={group.category?.name ?? "Övrigt"}
                    days={summary.days}
                    byDate={group.byDate}
                    done={group.done}
                    total={group.total}
                    extra={Math.max(0, group.done - group.total)}
                    itemDone={(t) => isMonthlyTaskComplete(t, t.completion)}
                  />
                ))}
              </>
            ) : null}

          </tbody>
          <tfoot>
            <tr className={styles.footerRow}>
              <td className={[styles.footerLabel, styles.stickyCol].join(" ")}>Månadens total</td>
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
                      weeklyTasks={weeklyExpanded}
                      gym={gym}
                      cardio={cardio}
                      sport={sport}
                      bathing={bathing}
                    />
                  ) : null}
                </td>
              ))}
              <td
                className={cellClass(
                  styles.footerCell,
                  styles.footerTotal,
                  styles.stickyColRight,
                  weekScore.extra > 0 && styles.footerTotalCrush,
                )}
              >
                <span
                  className={styles.footerTotalValue}
                  title={
                    weekScore.extra > 0
                      ? `${weekScore.label} · +${formatHabitPoints(weekScore.extra)} extra`
                      : undefined
                  }
                >
                  {weekScore.label}
                  {weekScore.extra > 0 ? (
                    <span className={styles.footerTotalExtra}>
                      +{formatHabitPoints(weekScore.extra)}
                    </span>
                  ) : null}
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
        {tasks.map((task) =>
          isMonthlyTaskRepeatable(task) ? (
            <FestProgressCard
              key={task.id}
              task={task}
              category={task.categoryId ? catById.get(task.categoryId) ?? null : null}
              monthStart={monthStart}
            />
          ) : (
            <MonthlyTaskCard
              key={task.id}
              task={task}
              category={task.categoryId ? catById.get(task.categoryId) ?? null : null}
              categories={categories}
              monthStart={monthStart}
              today={today}
            />
          ),
        )}
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
  const festOccasions = isMonthlyTaskRepeatable(task)
    ? monthlyTaskCompletions(task).filter(
        (c) =>
          !c.isUnscheduled &&
          (c.scheduledDayOfMonth != null || c.doneAt != null),
      )
    : [];
  const schedule = resolveMonthlyTaskSchedule(task, task.completion, monthStart, {
    includeWhenDone: true,
  });
  const scheduledDay = schedule.dayOfMonth;
  const scheduledDate =
    scheduledDay != null ? dateInMonth(monthStart, scheduledDay) : null;
  const billAmountLabel = formatBillAmountKr(task);
  const amountDetail = formatMonthlyTaskDetail(task, task.completion);
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

  const status = isMonthlyTaskRepeatable(task)
    ? festOccasions.length === 0
      ? "unplaced"
      : festOccasions.every((c) => isMonthlyTaskComplete(task, c))
        ? "done"
        : "planned"
    : monthlyTaskVisualStatus(task, task.completion, monthStart, today);

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
          <p className={styles.monthlyCardKicker}>{monthlyTaskDisplayTitle(task)}</p>
          {category ? (
            <p className={styles.monthlyCardCategory}>
              {category.icon} {category.name}
            </p>
          ) : null}
          {isBill && billAmountLabel ? (
            <p className={styles.monthlyCardDetail}>{billAmountLabel}</p>
          ) : isMonthlyAmountTask(task) && amountDetail ? (
            <p className={styles.monthlyCardDetail}>{amountDetail}</p>
          ) : null}
          {isMonthlyTaskRepeatable(task) ? (
            <p className={styles.monthlyCardDetail}>
              {festOccasions.length === 0
                ? "Inga tillfällen den här månaden"
                : festOccasions
                    .map(
                      (c) =>
                        c.occasion?.trim() ||
                        (c.scheduledDayOfMonth != null
                          ? `Dag ${c.scheduledDayOfMonth}`
                          : "Fest"),
                    )
                    .join(" · ")}
            </p>
          ) : status === "unplaced" ? (
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
          {status === "done" && (amountDetail || task.completion?.note) ? (
            <p className={styles.monthlyCardHint}>
              {amountDetail ?? task.completion?.note}
            </p>
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
            : status === "done"
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
  extra = 0,
  highlight,
  crush,
  muted,
}: {
  value: number;
  total: number | null;
  extra?: number;
  highlight?: boolean;
  crush?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={cellClass(
        styles.totalCell,
        highlight && styles.totalCellDone,
        crush && styles.totalCellCrush,
        muted && styles.totalCellMuted,
      )}
    >
      {total != null ? (
        <span className={styles.totalFraction}>
          <span className={styles.totalValue}>{formatHabitPoints(value)}</span>
          <span className={styles.totalSlash}>/{total}</span>
          {extra > 0 ? (
            <span className={styles.totalExtra}>+{formatHabitPoints(extra)}</span>
          ) : null}
        </span>
      ) : value > 0 ? (
        <span className={styles.totalValue}>{value}</span>
      ) : (
        <span className={styles.emptyMark}>—</span>
      )}
    </td>
  );
}

function SessionCountRow<
  T extends { placement: { weekStart: string; weekday: number | null; doneAt: string | null } },
>({
  icon,
  label,
  days,
  sessions,
  done,
  total,
  extra,
}: {
  icon: string;
  label: string;
  days: MonthDay[];
  sessions: T[];
  done: number;
  total: number;
  extra: number;
}) {
  return (
    <tr>
      <RowLabel sticky icon={icon} label={label} />
      {days.map((d) => {
        const dayItems = itemsOnDate(sessions, d.date);
        const dayDone = dayItems.filter((s) => s.placement.doneAt).length;
        const allDone = dayItems.length > 0 && dayDone === dayItems.length;
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
            {dayItems.length === 0 ? (
              <span className={styles.emptyMark}>—</span>
            ) : (
              <span className={styles.taskFraction}>
                {dayDone}/{dayItems.length}
              </span>
            )}
          </td>
        );
      })}
      <TotalCell
        value={done}
        total={total || null}
        extra={extra}
        muted={total === 0 && done === 0}
        highlight={total > 0 && done >= total}
        crush={extra > 0}
      />
    </tr>
  );
}

function TaskCountRow<T>({
  icon,
  label,
  days,
  byDate,
  done,
  total,
  extra,
  itemDone,
}: {
  icon: string;
  label: string;
  days: MonthDay[];
  byDate: Map<string, T[]>;
  done: number;
  total: number;
  extra: number;
  itemDone: (item: T) => boolean;
}) {
  return (
    <tr>
      <RowLabel sticky icon={icon} label={label} />
      {days.map((d) => {
        const dayItems = byDate.get(d.date) ?? [];
        const dayDone = dayItems.filter(itemDone).length;
        const allDone = dayItems.length > 0 && dayDone === dayItems.length;
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
            {dayItems.length === 0 ? (
              <span className={styles.emptyMark}>—</span>
            ) : (
              <span className={styles.taskFraction}>
                {dayDone}/{dayItems.length}
              </span>
            )}
          </td>
        );
      })}
      <TotalCell
        value={done}
        total={total || null}
        extra={extra}
        muted={total === 0 && done === 0}
        highlight={total > 0 && done >= total}
        crush={extra > 0}
      />
    </tr>
  );
}

function DayScore({
  day,
  habits,
  monthlyTasks,
  weeklyTasks,
  gym,
  cardio,
  sport,
  bathing,
}: {
  day: MonthDay;
  habits: Habit[];
  monthlyTasks: MonthlyTaskForMonth[];
  weeklyTasks: WeeklyTaskForWeek[];
  gym: Array<{ placement: { weekStart: string; weekday: number | null; doneAt: string | null } }>;
  cardio: Array<{ placement: { weekStart: string; weekday: number | null; doneAt: string | null } }>;
  sport: Array<{ placement: { weekStart: string; weekday: number | null; doneAt: string | null } }>;
  bathing: Array<{ placement: { weekStart: string; weekday: number | null; doneAt: string | null } }>;
}) {
  let hit = 0;
  let total = 0;

  for (const h of habits) {
    total += 1;
    hit += habitStatusPoints(day.statuses[h.id]);
  }

  for (const session of [
    ...itemsOnDate(gym, day.date),
    ...itemsOnDate(cardio, day.date),
    ...itemsOnDate(sport, day.date),
    ...itemsOnDate(bathing, day.date),
  ]) {
    total += 1;
    if (session.placement.doneAt) hit += 1;
  }

  const dayWeekly = weeklyTasks.filter(
    (t) => t.placement && placementLocalDate(t.placement) === day.date,
  );
  if (dayWeekly.length > 0) {
    total += 1;
    if (dayWeekly.every((t) => t.placement?.doneAt)) hit += 1;
  }

  for (const task of monthlyTasksOnLocalDate(monthlyTasks, day.date, undefined, {
    includeWhenDone: true,
  })) {
    total += 1;
    if (isMonthlyTaskComplete(task, task.completion)) hit += 1;
  }

  if (total === 0) return <span className={styles.emptyMark}>—</span>;

  const pct = Math.round((hit / total) * 100);
  const crushed = pct >= 100 && total > 0;

  return (
    <span
      className={cellClass(
        styles.dayScore,
        crushed && styles.dayScoreGood,
        !crushed && pct >= 80 && styles.dayScoreGood,
        pct >= 50 && pct < 80 && styles.dayScoreMid,
        pct < 50 && styles.dayScoreLow,
      )}
      title={`${formatHabitPoints(hit)}/${total} klart (${pct}%)`}
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

function extraOverGoal(done: number, total: number): number {
  return Math.max(0, done - total);
}

function monthTotalScore(parts: {
  summary: MonthSummary;
  monthlyDone: number;
  monthlyTotal: number;
  weeklyDone: number;
  weeklyTotal: number;
  gymDone: number;
  gymTotal: number;
  cardioDone: number;
  cardioTotal: number;
  sportDone: number;
  sportTotal: number;
  bathingDone: number;
  bathingTotal: number;
}): { hit: number; total: number; extra: number; label: string } {
  const pastDays = parts.summary.days.filter((d) => !d.isFuture).length;
  const habitYes = Object.values(parts.summary.yesByHabit).reduce(
    (a, b) => a + b,
    0,
  );
  const habitTotal = parts.summary.habits.length * pastDays;
  const hit =
    habitYes +
    parts.monthlyDone +
    parts.weeklyDone +
    parts.gymDone +
    parts.cardioDone +
    parts.sportDone +
    parts.bathingDone;
  const total =
    habitTotal +
    parts.monthlyTotal +
    parts.weeklyTotal +
    parts.gymTotal +
    parts.cardioTotal +
    parts.sportTotal +
    parts.bathingTotal;
  const extra =
    extraOverGoal(parts.weeklyDone, parts.weeklyTotal) +
    extraOverGoal(parts.monthlyDone, parts.monthlyTotal) +
    extraOverGoal(parts.gymDone, parts.gymTotal) +
    extraOverGoal(parts.cardioDone, parts.cardioTotal) +
    extraOverGoal(parts.sportDone, parts.sportTotal) +
    extraOverGoal(parts.bathingDone, parts.bathingTotal) +
    extraOverGoal(habitYes, habitTotal);
  return {
    hit,
    total,
    extra,
    label: total === 0 ? "—" : `${formatHabitPoints(hit)}/${total}`,
  };
}
