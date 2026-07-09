import Link from "next/link";
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
import type { WeekHabitSummary } from "@/lib/habits.server";
import type { WeekJournalSummary } from "@/lib/journal";
import { MOOD_ICON, MOOD_LABEL } from "@/lib/mood";
import type { WeekSummary, WeekDay } from "@/lib/water.server";
import { waterDayStatus, type WaterDayStatus } from "@/lib/water";
import {
  formatWeeklyTaskDetail,
  groupByCategory,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type TaskCategory,
  type Weekday,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import { collectWeekExpenses } from "@/lib/expenses";
import { ExpensesSummary } from "@/components/ExpensesSummary/ExpensesSummary";
import { formatWeightKg } from "@/lib/format";
import type { WeightWeekPlan } from "@/lib/weight";
import { WEIGHT_TIME_LABEL } from "@/lib/weight";
import styles from "./week-progress.module.scss";

interface Props {
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  taskCategories: TaskCategory[];
  weightPlan: WeightWeekPlan;
  journalWeek: WeekJournalSummary;
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
  sportSessions,
  bathingSessions,
  tasks,
  taskCategories,
  weightPlan,
  journalWeek,
}: Props) {
  const pastDays = habitWeek.days.filter((d) => !d.isFuture).length;

  const gymByWeekday = groupByWeekday(gymSessions);
  const cardioByWeekday = groupByWeekday(cardioSessions);
  const sportByWeekday = groupByWeekday(sportSessions);
  const bathingByWeekday = groupByWeekday(bathingSessions);
  const tasksByWeekday = groupTasksByWeekday(tasks);
  const habitDayByDate = new Map(habitWeek.days.map((d) => [d.date, d]));
  const journalByDate = new Map(journalWeek.days.map((d) => [d.localDate, d]));

  const placedGym = gymSessions.filter((s) => s.placement.weekday != null);
  const placedCardio = cardioSessions.filter((s) => s.placement.weekday != null);
  const placedSport = sportSessions.filter((s) => s.placement.weekday != null);
  const placedBathing = bathingSessions.filter((s) => s.placement.weekday != null);
  const placedTasks = tasks.filter((t) => t.placement);
  const taskGroups = groupByCategory(placedTasks, taskCategories).map(
    ({ category, items }) => ({
      category,
      items,
      byWeekday: groupTasksByWeekday(items),
      done: items.filter((t) => t.placement?.doneAt).length,
      total: items.length,
    }),
  );
  const gymDone = placedGym.filter((s) => s.placement.doneAt).length;
  const cardioDone = placedCardio.filter((s) => s.placement.doneAt).length;
  const sportDone = placedSport.filter((s) => s.placement.doneAt).length;
  const bathingDone = placedBathing.filter((s) => s.placement.doneAt).length;
  const tasksDone = placedTasks.filter((t) => t.placement?.doneAt).length;
  const weightActive = weightPlan.enabled && weightPlan.weekday != null;
  const weightDone = Boolean(weightPlan.log);
  const expenseSummary = collectWeekExpenses(tasks, taskCategories);
  const today = week.days.find((d) => d.isToday)?.date ?? "";
  const colSpan = week.days.length + 2;

  return (
    <div className={styles.board}>
      <ExpensesSummary
        summary={expenseSummary}
        title="Utgifter denna vecka"
      />

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
                  const moodKey = h.kind === "mood" ? (habitDay?.mood ?? null) : null;
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
                        d.isFuture
                          ? "Kommande"
                          : moodKey
                            ? MOOD_LABEL[moodKey]
                            : HABIT_STATUS_LABEL[status ?? "empty"]
                      }`}
                    >
                      {!d.isFuture ? (
                        moodKey ? (
                          <span className={styles.moodMark} aria-label={MOOD_LABEL[moodKey]}>
                            {MOOD_ICON[moodKey]}
                          </span>
                        ) : (
                          <StatusMark status={status} />
                        )
                      ) : null}
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
                title: s.placement.warmup
                  ? `${s.label} · ${GYM_WARMUP_LABEL[s.placement.warmup]}`
                  : s.label,
                warmupIcon:
                  s.placement.doneAt && s.placement.warmup
                    ? GYM_WARMUP_ICON[s.placement.warmup]
                    : undefined,
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
              icon="⚽"
              label="Sport"
              days={week.days}
              byWeekday={sportByWeekday}
              done={sportDone}
              total={placedSport.length}
              chipClass={styles.sportChip}
              renderSession={(s) => ({
                icon: s.icon,
                done: Boolean(s.placement.doneAt),
                title: formatSportDetail(s.placement) ?? s.label,
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

            <SectionRow label="Uppgifter" colSpan={colSpan} />

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
                <TotalCell value={null} total={null} muted mutedLabel="—" />
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
                      dayTasks.length > 0 && dayDone === dayTasks.length;
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

            <SectionRow label="Dagbok" colSpan={colSpan} />

            <tr>
              <RowLabel sticky icon="📓" label="Dagbok" />
              {week.days.map((d) => {
                const dayJournal = journalByDate.get(d.date);
                const entries = dayJournal?.entries ?? [];
                const href = d.isToday ? "/" : `/day/${d.date}`;
                return (
                  <td
                    key={d.date}
                    className={cellClass(
                      styles.dataCell,
                      styles.journalCell,
                      d.isFuture && styles.cellFuture,
                      d.isToday && styles.cellToday,
                      entries.length > 0 && styles.journalCellHasEntries,
                    )}
                  >
                    {d.isFuture ? null : entries.length === 0 ? (
                      <span className={styles.emptyMark}>—</span>
                    ) : (
                      <Link href={href} className={styles.journalLink} title={dayJournal?.narrative ?? dayJournal?.preview ?? ""}>
                        <span className={styles.journalCount}>{entries.length}</span>
                        {dayJournal?.narrative || dayJournal?.preview ? (
                          <span className={styles.journalPreview}>
                            {dayJournal.narrative || dayJournal.preview}
                          </span>
                        ) : null}
                      </Link>
                    )}
                  </td>
                );
              })}
              <td
                className={cellClass(
                  styles.totalCell,
                  journalWeek.days.some((d) => d.entryCount > 0) && styles.totalCellDone,
                )}
              >
                {(() => {
                  const total = journalWeek.days.reduce((sum, d) => sum + d.entryCount, 0);
                  return total > 0 ? (
                    <span className={styles.totalValue}>{total}</span>
                  ) : (
                    <span className={styles.emptyMark}>—</span>
                  );
                })()}
              </td>
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
                    return (
                      <li
                        key={t.id}
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
                <li key={t.id} className={styles.categoryDoneItem}>
                  <span className={styles.categoryDoneIcon} aria-hidden>
                    {t.icon}
                  </span>
                  <span className={styles.categoryDoneBody}>
                    <span className={styles.categoryDoneTitle}>{t.title}</span>
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
                <li key={t.id} className={styles.categoryPendingItem}>
                  <span aria-hidden>{t.icon}</span>
                  <span>{t.title}</span>
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
              <li key={t.id} className={styles.categoryPendingItem}>
                <span aria-hidden>{t.icon}</span>
                <span>{t.title}</span>
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
                      {meta.warmupIcon ? (
                        <span className={styles.warmupCorner} aria-hidden>
                          {meta.warmupIcon}
                        </span>
                      ) : null}
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
  let hit = 0;
  let total = 0;

  if (waterDayStatus(day) === "good") hit += 1;
  total += 1;

  for (const h of habits) {
    total += 1;
    if (habitDay?.statuses[h.id] === "yes") hit += 1;
  }

  for (const s of [...gym, ...cardio, ...sport, ...bathing]) {
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
  return `${hit}/${total}`;
}
