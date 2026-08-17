import Link from "next/link";
import { Fragment } from "react";
import { addDaysISO, formatDayShort, formatWeekdayShort, isoWeekdayFromLocalISO } from "@/lib/date";
import { formatWaterTemp, type BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { SportSessionForWeek } from "@/lib/sport";
import { formatSportDetail } from "@/lib/sport";
import {
  GYM_WARMUP_ICON,
  GYM_WARMUP_LABEL,
  type GymSessionForWeek,
} from "@/lib/gym";
import type { Habit, HabitStatus } from "@/lib/habits";
import { formatHabitPoints } from "@/lib/habits";
import type { WeekHabitSummary } from "@/lib/habits.server";
import type { WeekJournalSummary } from "@/lib/journal";
import type { WeekSummary, WeekDay } from "@/lib/water.server";
import type { WaterDayStatus } from "@/lib/water";
import { computeWeekDayScore } from "@/lib/week-day-score";
import {
  expandWeeklyTaskPlacements,
  formatWeeklyTaskDetail,
  groupByCategory,
  musicSessionIcon,
  musicSessionTitle,
  scoreCategoryFromTaskGoals,
  weeklyTaskInstanceKey,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type TaskCategory,
  type Weekday,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import { collectWeekExpenses, collectWeekShopping } from "@/lib/expenses";
import { ExpensesSummary } from "@/components/ExpensesSummary/ExpensesSummary";
import { formatWeightKg } from "@/lib/format";
import type { WeightWeekPlan } from "@/lib/weight";
import { WEIGHT_TIME_LABEL } from "@/lib/weight";
import type { WeekMealsSummary } from "@/lib/meal-box.server";
import type { WeekMediaSummary } from "@/lib/media.server";
import { WeekDailyHabitRows } from "./WeekDailyHabitRows";
import { WeekJournalRow } from "./WeekJournalRow";
import { WeekTrainingChip } from "./WeekTrainingChip";
import type { AnyTrainingSession } from "./WeekTrainingLogDialog";
import { WeekMusicChip } from "./WeekMusicChip";
import {
  WEEK_PROGRESS_SECTION_LABEL,
  WEEK_PROGRESS_TRAINING_META,
  type WeekProgressLayout,
  type WeekProgressTrainingKey,
} from "@/lib/week-progress-layout";
import {
  WORK_KINDS,
  WORK_KIND_ICON,
  WORK_KIND_LABEL,
  summarizeWorkLogs,
  workKindCountTotal,
  type WorkDailyLog,
  type WorkKind,
} from "@/lib/work";
import styles from "./week-progress.module.scss";

interface Props {
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  mealsWeek: WeekMealsSummary;
  mediaWeek: WeekMediaSummary;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  taskCategories: TaskCategory[];
  weightPlan: WeightWeekPlan;
  journalWeek: WeekJournalSummary;
  layout: WeekProgressLayout;
  workByDate: Map<string, WorkDailyLog>;
}

const WEEKDAY_HEAD = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export function WeekProgressBoard({
  week,
  habitWeek,
  mealsWeek,
  mediaWeek,
  gymSessions,
  cardioSessions,
  sportSessions,
  bathingSessions,
  tasks,
  taskCategories,
  weightPlan,
  journalWeek,
  layout,
  workByDate,
}: Props) {
  const pastDays = habitWeek.days.filter((d) => !d.isFuture).length;

  const gymByWeekday = groupByWeekday(gymSessions);
  const cardioByWeekday = groupByWeekday(cardioSessions);
  const sportByWeekday = groupByWeekday(sportSessions);
  const bathingByWeekday = groupByWeekday(bathingSessions);
  const expandedTasks = expandWeeklyTaskPlacements(tasks);
  const tasksByWeekday = groupTasksByWeekday(expandedTasks);
  const habitDayByDate = new Map(habitWeek.days.map((d) => [d.date, d]));

  const placedGym = gymSessions.filter((s) => s.placement.weekday != null);
  const placedCardio = cardioSessions.filter((s) => s.placement.weekday != null);
  const placedSport = sportSessions.filter((s) => s.placement.weekday != null);
  const placedBathing = bathingSessions.filter((s) => s.placement.weekday != null);
  const taskGroups = groupByCategory(tasks, taskCategories).map(
    ({ category, items }) => {
      const scored = scoreWeeklyTasksForProgress(items);
      return {
        category,
        items: expandWeeklyTaskPlacements(items).filter(
          (t) => t.placement?.weekday != null,
        ),
        byWeekday: groupTasksByWeekday(expandWeeklyTaskPlacements(items)),
        done: scored.done,
        total: scored.total,
      };
    },
  );
  const taskScore = scoreWeeklyTasksForProgress(tasks);
  const tasksDone = taskScore.done;
  const tasksTotal = taskScore.total;
  const gymDone = placedGym.filter((s) => s.placement.doneAt).length;
  const cardioDone = placedCardio.filter((s) => s.placement.doneAt).length;
  const sportDone = placedSport.filter((s) => s.placement.doneAt).length;
  const bathingDone = placedBathing.filter((s) => s.placement.doneAt).length;
  const weightActive = weightPlan.enabled && weightPlan.weekday != null;
  const weightDone = Boolean(weightPlan.log);
  const expenseSummary = collectWeekExpenses(tasks, taskCategories);
  const shoppingSummary = collectWeekShopping(tasks, taskCategories);
  const today = week.days.find((d) => d.isToday)?.date ?? "";
  const colSpan = week.days.length + 2;
  const workCounts = summarizeWorkLogs(workByDate.values());
  const workTotal = workKindCountTotal(workCounts);

  return (
    <div className={styles.board}>
      <ExpensesSummary
        summary={shoppingSummary}
        title="Handling denna vecka"
        icon="🛒"
        variant="shopping"
      />
      <ExpensesSummary
        summary={expenseSummary}
        title="Utgifter denna vecka"
      />

      <div className={styles.legendBar} aria-label="Förklaring">
        <span className={styles.legendGroup}>
          <span className={styles.legendTitle}>Vanor</span>
          <LegendStatus status="crush" label=":D överträffat" />
          <LegendStatus status="yes" label="klar" />
          <LegendStatus status="half" label="delvis" />
          <LegendStatus status="no" label="inte klarat" />
          <LegendStatus status="empty" label="ej ifyllt" />
        </span>
        <span className={styles.legendGroup}>
          <span className={styles.legendTitle}>Vatten</span>
          <WaterSwatch status="good" />
          <WaterSwatch status="almost" />
          <WaterSwatch status="low" />
        </span>
        <span className={styles.legendGroup}>
          <span className={styles.legendTitle}>Jobb</span>
          {WORK_KINDS.map((kind) => (
            <span key={kind} className={styles.legendItem}>
              <span aria-hidden>{WORK_KIND_ICON[kind]}</span>
              <span className={styles.legendItemLabel}>
                {WORK_KIND_LABEL[kind]} {workCounts[kind]}
              </span>
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
              {week.days.map((d, i) => (
                <DayHeader key={d.date} day={d} fallbackLabel={WEEKDAY_HEAD[i] ?? ""} />
              ))}
              <th className={[styles.totalHead, styles.stickyColRight].join(" ")} scope="col">
                ∑
              </th>
            </tr>
          </thead>
          <tbody>
            {layout.sections.map((section) => (
              <Fragment key={section}>
                {section === "daily" ? (
                  <>
                    <SectionRow
                      label={WEEK_PROGRESS_SECTION_LABEL.daily}
                      colSpan={colSpan}
                    />
                    <WeekDailyHabitRows
                      week={week}
                      habitWeek={habitWeek}
                      mealsWeek={mealsWeek}
                      mediaWeek={mediaWeek}
                      dailyRows={layout.dailyRows}
                    />
                    <WorkKindRow
                      days={week.days}
                      workByDate={workByDate}
                      counts={workCounts}
                      total={workTotal}
                    />
                  </>
                ) : null}

                {section === "training" ? (
                  <>
                    <SectionRow
                      label={WEEK_PROGRESS_SECTION_LABEL.training}
                      colSpan={colSpan}
                    />
                    {layout.trainingRows.map((key) => (
                      <Fragment key={key}>
                        {renderTrainingRow(key, {
                          week,
                          gymByWeekday,
                          cardioByWeekday,
                          sportByWeekday,
                          bathingByWeekday,
                          gymDone,
                          placedGym,
                          cardioDone,
                          placedCardio,
                          sportDone,
                          placedSport,
                          bathingDone,
                          placedBathing,
                        })}
                      </Fragment>
                    ))}
                  </>
                ) : null}

                {section === "tasks" ? (
                  <>
                    <SectionRow
                      label={WEEK_PROGRESS_SECTION_LABEL.tasks}
                      colSpan={colSpan}
                    />
                    {taskGroups.length === 0 ? (
                      <tr>
                        <RowLabel sticky icon="📋" label="Veckouppgifter" />
                        {week.days.map((d) => (
                          <td
                            key={d.date}
                            className={cellClass(
                              styles.dataCell,
                              styles.taskCell,
                              d.isFuture && styles.cellFuture,
                              d.isToday && styles.cellToday,
                            )}
                          >
                            <span className={styles.emptyMark}>—</span>
                          </td>
                        ))}
                        <TotalCell
                          value={null}
                          total={null}
                          muted
                          mutedLabel="—"
                        />
                      </tr>
                    ) : (
                      taskGroups.map(({ category, byWeekday, done, total }) => (
                        <tr key={category?.id ?? "uncategorized"}>
                          <RowLabel
                            sticky
                            icon={category?.icon ?? "📋"}
                            label={category?.name ?? "Övrigt"}
                          />
                          {week.days.map((d) => {
                            const weekday = isoWeekdayFromLocalISO(d.date);
                            const dayTasks = byWeekday.get(weekday) ?? [];
                            const dayDone = dayTasks.filter(
                              (t) => t.placement?.doneAt,
                            ).length;
                            const allDone =
                              dayTasks.length > 0 &&
                              dayDone === dayTasks.length;
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
                            value={done}
                            total={total || null}
                            muted={total === 0}
                            mutedLabel={total === 0 ? "—" : undefined}
                            highlight={total > 0 && done === total}
                          />
                        </tr>
                      ))
                    )}
                  </>
                ) : null}

                {section === "journal" ? (
                  <>
                    <SectionRow
                      label={WEEK_PROGRESS_SECTION_LABEL.journal}
                      colSpan={colSpan}
                    />
                    <WeekJournalRow
                      days={week.days}
                      journalWeek={journalWeek}
                    />
                  </>
                ) : null}
              </Fragment>
            ))}
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
                      sport={sportByWeekday.get(isoWeekdayFromLocalISO(d.date)) ?? []}
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
                    sportDone,
                    sportTotal: placedSport.length,
                    bathingDone,
                    bathingTotal: placedBathing.length,
                    tasksDone,
                    tasksTotal,
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

      {taskGroups.length > 0 ? (
        <WeekCategoryRecap taskGroups={taskGroups} days={week.days} />
      ) : null}

      {weightPlan.enabled ? (
        <WeightWeekSummary plan={weightPlan} today={today} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TrainingRowContext {
  week: WeekSummary;
  gymByWeekday: Map<number, GymSessionForWeek[]>;
  cardioByWeekday: Map<number, CardioSessionForWeek[]>;
  sportByWeekday: Map<number, SportSessionForWeek[]>;
  bathingByWeekday: Map<number, BathingSessionForWeek[]>;
  gymDone: number;
  placedGym: GymSessionForWeek[];
  cardioDone: number;
  placedCardio: CardioSessionForWeek[];
  sportDone: number;
  placedSport: SportSessionForWeek[];
  bathingDone: number;
  placedBathing: BathingSessionForWeek[];
}

function renderTrainingRow(
  key: WeekProgressTrainingKey,
  ctx: TrainingRowContext,
) {
  const meta = WEEK_PROGRESS_TRAINING_META[key];

  switch (key) {
    case "gym":
      return (
        <TrainingRow
          type="gym"
          icon={meta.icon}
          label={meta.label}
          days={ctx.week.days}
          byWeekday={ctx.gymByWeekday}
          done={ctx.gymDone}
          total={ctx.placedGym.length}
          renderSession={(s) => ({
            icon: s.icon,
            done: Boolean(s.placement.doneAt),
            title: s.placement.warmup
              ? `${s.label} · ${GYM_WARMUP_LABEL[s.placement.warmup]}`
              : s.label,
            warmupIcon:
              s.placement.doneAt && s.placement.warmup
                ? GYM_WARMUP_ICON[s.placement.warmup]
                : undefined,
          })}
        />
      );
    case "cardio":
      return (
        <TrainingRow
          type="cardio"
          icon={meta.icon}
          label={meta.label}
          days={ctx.week.days}
          byWeekday={ctx.cardioByWeekday}
          done={ctx.cardioDone}
          total={ctx.placedCardio.length}
          chipClass={styles.cardioChip}
          renderSession={(s) => ({
            icon: s.icon,
            done: Boolean(s.placement.doneAt),
            title: s.placement.note ? `${s.label}: ${s.placement.note}` : s.label,
          })}
        />
      );
    case "sport":
      return (
        <TrainingRow
          type="sport"
          icon={meta.icon}
          label={meta.label}
          days={ctx.week.days}
          byWeekday={ctx.sportByWeekday}
          done={ctx.sportDone}
          total={ctx.placedSport.length}
          chipClass={styles.sportChip}
          renderSession={(s) => ({
            icon: s.icon,
            done: Boolean(s.placement.doneAt),
            title: formatSportDetail(s.placement) ?? s.label,
          })}
        />
      );
    case "bathing":
      return (
        <TrainingRow
          type="bathing"
          icon={meta.icon}
          label={meta.label}
          days={ctx.week.days}
          byWeekday={ctx.bathingByWeekday}
          done={ctx.bathingDone}
          total={ctx.placedBathing.length}
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
      );
  }
}

interface TaskGroupRecap {
  category: TaskCategory | null;
  items: WeeklyTaskForWeek[];
  byWeekday: Map<number, WeeklyTaskForWeek[]>;
  done: number;
  total: number;
}

function WeekCategoryRecap({
  taskGroups,
  days,
}: {
  taskGroups: TaskGroupRecap[];
  days: WeekDay[];
}) {
  return (
    <aside className={styles.categoryRecap} aria-label="Sammanfattning per kategori">
      <h3 className={styles.categoryRecapTitle}>Veckans uppgifter per kategori</h3>
      <div className={styles.categoryRecapGrid}>
        {taskGroups.map((group) => (
          <CategoryRecapCard
            key={group.category?.id ?? "uncategorized"}
            group={group}
            days={days}
          />
        ))}
      </div>
    </aside>
  );
}

function CategoryRecapCard({
  group,
  days,
}: {
  group: TaskGroupRecap;
  days: WeekDay[];
}) {
  const { category, items, byWeekday, done, total } = group;
  const backlog = items.filter(
    (t) => t.placement?.weekday == null && !t.placement?.onHold,
  );
  const placed = items.filter((t) => t.placement?.weekday != null);
  const doneItems = placed
    .filter((t) => t.placement?.doneAt)
    .sort((a, b) => {
      const wd =
        (a.placement?.weekday ?? 0) - (b.placement?.weekday ?? 0);
      if (wd !== 0) return wd;
      return a.sortOrder - b.sortOrder;
    });
  const pendingItems = placed
    .filter((t) => !t.placement?.doneAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const allDone = total > 0 && done === total;

  return (
    <article
      className={cellClass(
        styles.categoryCard,
        allDone && styles.categoryCard_done,
        done > 0 && done < total && styles.categoryCard_partial,
      )}
      style={
        category?.accent
          ? { borderLeftColor: category.accent }
          : undefined
      }
    >
      <header className={styles.categoryCardHeader}>
        <span className={styles.categoryCardIcon} aria-hidden>
          {category?.icon ?? "📋"}
        </span>
        <div className={styles.categoryCardHeading}>
          <h4 className={styles.categoryCardName}>
            {category?.name ?? "Övrigt"}
          </h4>
          <span
            className={cellClass(
              styles.categoryCardCounter,
              allDone && styles.categoryCardCounterDone,
            )}
          >
            {done}/{total} klara
          </span>
        </div>
      </header>

      <div className={styles.categoryWeekGrid} role="grid" aria-label="Veckan">
        {days.map((d) => {
          const weekday = isoWeekdayFromLocalISO(d.date) as Weekday;
          const dayTasks = byWeekday.get(weekday) ?? [];
          return (
            <div
              key={d.date}
              className={cellClass(
                styles.categoryDayCol,
                d.isToday && styles.categoryDayColToday,
                d.isFuture && styles.categoryDayColFuture,
              )}
              role="gridcell"
            >
              <span className={styles.categoryDayLabel}>
                {WEEKDAY_SHORT[weekday]}
              </span>
              <ul className={styles.categoryDayTasks}>
                {dayTasks.length === 0 ? (
                  <li className={styles.categoryDayEmpty} aria-hidden>
                    ·
                  </li>
                ) : (
                  dayTasks.map((t) => {
                    const taskDone = Boolean(t.placement?.doneAt);
                    if (t.completionKind === "music") {
                      return (
                        <WeekMusicChip
                          key={weeklyTaskInstanceKey(t)}
                          task={t}
                          localDate={d.date}
                        />
                      );
                    }
                    return (
                      <li
                        key={weeklyTaskInstanceKey(t)}
                        className={cellClass(
                          styles.categoryTaskChip,
                          taskDone && styles.categoryTaskChipDone,
                        )}
                        title={t.title}
                      >
                        <span aria-hidden>{t.icon}</span>
                        <span className={styles.categoryTaskChipMark} aria-hidden>
                          {taskDone ? "✓" : "○"}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {doneItems.length > 0 ? (
        <section className={styles.categorySection}>
          <p className={styles.categorySectionLabel}>Klart den här veckan</p>
          <ul className={styles.categoryDoneList}>
            {doneItems.map((t) => {
              const placement = t.placement!;
              const detail = formatWeeklyTaskDetail(placement);
              const dayLabel =
                placement.weekday != null
                  ? WEEKDAY_LONG[placement.weekday as Weekday]
                  : null;
              return (
                <li key={weeklyTaskInstanceKey(t)} className={styles.categoryDoneItem}>
                  <span className={styles.categoryDoneIcon} aria-hidden>
                    {musicSessionIcon(t, placement)}
                  </span>
                  <span className={styles.categoryDoneBody}>
                    <span className={styles.categoryDoneTitle}>
                      {musicSessionTitle(t, placement)}
                    </span>
                    {detail ? (
                      <span className={styles.categoryDoneDetail}>{detail}</span>
                    ) : null}
                  </span>
                  {dayLabel ? (
                    <span className={styles.categoryDoneDay}>{dayLabel}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {pendingItems.length > 0 ? (
        <section className={styles.categorySection}>
          <p className={styles.categorySectionLabel}>Kvar att göra</p>
          <ul className={styles.categoryPendingList}>
            {pendingItems.map((t) => {
              const wd = t.placement?.weekday;
              return (
                <li key={weeklyTaskInstanceKey(t)} className={styles.categoryPendingItem}>
                  <span aria-hidden>{musicSessionIcon(t, t.placement)}</span>
                  <span>{musicSessionTitle(t, t.placement)}</span>
                  {wd != null ? (
                    <span className={styles.categoryPendingDay}>
                      {WEEKDAY_LONG[wd as Weekday]}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {backlog.length > 0 ? (
        <section className={styles.categorySection}>
          <p className={styles.categorySectionLabel}>Ej placerad</p>
          <ul className={styles.categoryPendingList}>
            {backlog.map((t) => (
              <li
                key={weeklyTaskInstanceKey(t)}
                className={styles.categoryPendingItem}
              >
                <span aria-hidden>{musicSessionIcon(t, t.placement)}</span>
                <span>{musicSessionTitle(t, t.placement)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function WeightWeekSummary({
  plan,
  today,
}: {
  plan: WeightWeekPlan;
  today: string;
}) {
  const scheduledDate =
    plan.weekday != null
      ? addDaysISO(plan.weekStart, plan.weekday - 1)
      : null;
  const dayName =
    plan.weekday != null ? WEEKDAY_LONG[plan.weekday as Weekday] : null;
  const logged = Boolean(plan.log);
  const isFuture = scheduledDate ? scheduledDate > today : false;
  const isToday = scheduledDate === today;
  const planHref = `/week?start=${plan.weekStart}&view=plan`;
  const dayHref =
    scheduledDate == null
      ? planHref
      : isToday
        ? "/"
        : `/day/${scheduledDate}`;

  let status: "done" | "planned" | "missed" | "unplaced" = "unplaced";
  if (plan.weekday != null) {
    if (logged) status = "done";
    else if (isFuture || isToday) status = "planned";
    else status = "missed";
  }

  return (
    <aside className={styles.weightAside} aria-label="Veckovägning">
      <div
        className={cellClass(
          styles.weightCard,
          status === "done" && styles.weightCard_done,
          status === "planned" && styles.weightCard_planned,
          status === "missed" && styles.weightCard_missed,
          status === "unplaced" && styles.weightCard_unplaced,
        )}
      >
        <div className={styles.weightCardMain}>
          <span className={styles.weightCardIcon} aria-hidden>
            ⚖️
          </span>
          <div className={styles.weightCardBody}>
            <p className={styles.weightCardKicker}>Veckovägning</p>
            {status === "unplaced" ? (
              <p className={styles.weightCardDetail}>
                Ej placerad den här veckan
              </p>
            ) : (
              <p className={styles.weightCardDetail}>
                {dayName}
                {scheduledDate ? (
                  <span className={styles.weightCardDate}>
                    {" "}
                    · {formatDayShort(scheduledDate)}
                  </span>
                ) : null}
              </p>
            )}
            {logged && plan.log ? (
              <p className={styles.weightCardValue}>
                {formatWeightKg(plan.log.weightKg)}
                <span className={styles.weightCardTime}>
                  {" "}
                  · {WEIGHT_TIME_LABEL[plan.log.timeOfDay]}
                </span>
              </p>
            ) : status === "planned" ? (
              <p className={styles.weightCardHint}>Planerad vägning</p>
            ) : status === "missed" ? (
              <p className={styles.weightCardHint}>Inte loggad ännu</p>
            ) : null}
          </div>
        </div>

        <div className={styles.weightCardAside}>
          {status === "done" ? (
            <span className={styles.weightStatusDone} aria-label="Loggad">
              ✓
            </span>
          ) : status === "planned" ? (
            <span className={styles.weightStatusPlanned} aria-label="Planerad">
              ○
            </span>
          ) : status === "missed" ? (
            <span className={styles.weightStatusMissed} aria-label="Saknas">
              !
            </span>
          ) : null}
          <Link
            href={status === "unplaced" ? planHref : dayHref}
            className={styles.weightCardLink}
          >
            {status === "unplaced"
              ? "Öppna veckoplan"
              : logged
                ? "Visa dag"
                : "Logga vikt"}
          </Link>
        </div>
      </div>
    </aside>
  );
}

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

function WorkKindRow({
  days,
  workByDate,
  counts,
  total,
}: {
  days: WeekDay[];
  workByDate: Map<string, WorkDailyLog>;
  counts: Record<WorkKind, number>;
  total: number;
}) {
  return (
    <tr>
      <RowLabel sticky icon="💼" label="Jobb" />
      {days.map((d) => {
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
              <span className={styles.moodMark} aria-label={WORK_KIND_LABEL[kind]}>
                {WORK_KIND_ICON[kind]}
              </span>
            ) : !d.isFuture ? (
              <span className={styles.emptyMark}>—</span>
            ) : null}
          </td>
        );
      })}
      <TotalCell
        value={null}
        total={null}
        muted
        mutedLabel={
          total === 0
            ? "—"
            : `${counts.home}/${counts.office}/${counts.off}/${counts.sick}`
        }
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

function TrainingRow<
  T extends {
    id: string;
    placement: { id: string; weekday: number | null; doneAt: string | null };
  },
>({
  type,
  icon,
  label,
  days,
  byWeekday,
  done,
  total,
  chipClass,
  renderSession,
}: {
  type: WeekProgressTrainingKey;
  icon: string;
  label: string;
  days: WeekDay[];
  byWeekday: Map<number, T[]>;
  done: number;
  total: number;
  chipClass?: string;
  renderSession: (item: T) => {
    icon: string;
    done: boolean;
    title: string;
    warmupIcon?: string;
  };
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
                    <WeekTrainingChip
                      key={s.placement.id}
                      type={type}
                      session={s as unknown as AnyTrainingSession}
                      meta={meta}
                      chipClass={chipClass}
                    />
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
  sport,
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
  sport: SportSessionForWeek[];
  bathing: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  weightScheduled: boolean;
  weightLogged: boolean;
}) {
  const { hit, total, pct, band } = computeWeekDayScore({
    isFuture: day.isFuture,
    water: { goalMet: day.goalMet, progress: day.progress },
    habitStatuses: habits.map((h) => habitDay?.statuses[h.id] ?? null),
    sessionsDone: [...gym, ...cardio, ...sport, ...bathing].map((s) =>
      Boolean(s.placement.doneAt),
    ),
    tasksAllDone: tasks.length > 0 ? tasks.every((t) => t.placement?.doneAt) : null,
    weightScheduled,
    weightLogged,
  });
  const crushed = pct >= 100 && total > 0;

  return (
    <span
      className={cellClass(
        styles.dayScore,
        crushed && styles.dayScoreCrush,
        !crushed && band === "good" && styles.dayScoreGood,
        band === "mid" && styles.dayScoreMid,
        band === "low" && styles.dayScoreLow,
      )}
      title={
        crushed
          ? `${formatHabitPoints(hit)}/${total} klart — överträffat :D`
          : `${formatHabitPoints(hit)}/${total} klart (${pct}%)`
      }
    >
      {crushed ? `:D ${pct}%` : `${pct}%`}
    </span>
  );
}

function LegendStatus({
  status,
  label,
}: {
  status: HabitStatus | "empty" | "crush";
  label: string;
}) {
  return (
    <span className={styles.legendItem}>
      <StatusSwatch status={status} />
      <span className={styles.legendItemLabel}>{label}</span>
    </span>
  );
}

function StatusSwatch({ status }: { status: HabitStatus | "empty" | "crush" }) {
  return (
    <span
      className={cellClass(styles.swatch, styles[`swatch_${status}`])}
      aria-hidden
    />
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
  for (const [weekday, list] of map) {
    list.sort(
      (a, b) =>
        (a.placement?.daySortOrder ?? a.sortOrder) -
        (b.placement?.daySortOrder ?? b.sortOrder),
    );
    map.set(weekday, list);
  }
  return map;
}

/** Per-task goals (repeatable or not): completed placements vs weeklyGoal. */
function scoreWeeklyTasksForProgress(tasks: WeeklyTaskForWeek[]): {
  done: number;
  total: number;
} {
  return scoreCategoryFromTaskGoals(tasks);
}

function summaryScore(parts: {
  gymDone: number;
  gymTotal: number;
  cardioDone: number;
  cardioTotal: number;
  sportDone: number;
  sportTotal: number;
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
    parts.sportDone +
    parts.bathingDone +
    parts.tasksDone +
    parts.waterHit +
    parts.habitYes +
    parts.weightDone;
  const total =
    parts.gymTotal +
    parts.cardioTotal +
    parts.sportTotal +
    parts.bathingTotal +
    parts.tasksTotal +
    parts.waterTotal +
    parts.habitTotal +
    parts.weightTotal;
  if (total === 0) return "—";
  return `${formatHabitPoints(hit)}/${total}`;
}
