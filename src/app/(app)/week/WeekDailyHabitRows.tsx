"use client";

import { useState } from "react";
import { formatDayShort } from "@/lib/date";
import {
  MEAL_ICON,
  MEAL_ORDER,
  SNACK_ICON,
  SNACK_LABEL,
  SNACK_SLOTS,
  formatHabitPoints,
  goalExceeded,
  habitStatusPoints,
  mealCookedByDisplay,
  numericGoalStatus,
  statusOrMissedOnPastDay,
  type Habit,
  type HabitStatus,
  type MealEntry,
  type MealKey,
  type SnackEntry,
  type SnackSlot,
} from "@/lib/habits";
import type { WeekHabitSummary } from "@/lib/habits.server";
import {
  INTAKE_ICON,
  INTAKE_LABEL,
  INTAKE_ORDER,
  applicableIntakeKinds,
} from "@/lib/intake";
import type { MoodKey } from "@/lib/mood";
import { MOBILE_GAME_STEPS } from "@/lib/mobile-games";
import { MOOD_ICON, MOOD_LABEL } from "@/lib/mood";
import { SMOKE_FREE_SUBSTANCES } from "@/lib/smoke-free";
import type { WeekMealsSummary } from "@/lib/meal-box.server";
import type { WeekMediaSummary } from "@/lib/media.server";
import type { WeekDay, WeekSummary } from "@/lib/water.server";
import { formatMl, waterDayStatus } from "@/lib/water";
import {
  parseDailyRowKey,
  type WeekProgressDailyRowKey,
} from "@/lib/week-progress-layout";
import { WeekMediaLogDialog } from "./WeekMediaLogDialog";
import { WeekMoodLogDialog } from "./WeekMoodLogDialog";
import styles from "./week-progress.module.scss";

const MEAL_LABEL_SV: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
};

const HABIT_STATUS_LABEL: Record<HabitStatus | "empty", string> = {
  yes: "Ja",
  half: "Delvis",
  no: "Inte klarat",
  empty: "Ej ifylld",
};

function mealCellDetail(entry: MealEntry | null): string | undefined {
  if (!entry) return undefined;
  const name = entry.description.trim();
  return name || "Loggad";
}

function snackCellDetail(entry: SnackEntry | null): string | undefined {
  if (!entry) return undefined;
  const name = entry.description.trim();
  return name || "Loggad";
}

function formatMealHover(
  label: string,
  entry: MealEntry | null,
  isFuture: boolean,
): string {
  if (isFuture) return `${label}: Kommande`;
  if (!entry) return `${label}: Ej ifylld`;
  const cooked = mealCookedByDisplay(
    entry.cookedBy,
    entry.restaurantName,
    entry.cookedByName,
  );
  const bits = [entry.description.trim() || "Loggad"];
  if (entry.fromMealBox) bits.push("Matlåda");
  else if (cooked) bits.push(cooked);
  if (!entry.fromMealBox && (entry.mealBoxes ?? 0) > 0) {
    const n = entry.mealBoxes ?? 0;
    bits.push(`+${n} matlåd${n === 1 ? "a" : "or"}`);
  }
  return `${label}: ${bits.join(" · ")}`;
}

function formatSnackHover(
  slot: SnackSlot,
  entry: SnackEntry | null,
  isFuture: boolean,
): string {
  if (isFuture) return `${SNACK_LABEL[slot]}: Kommande`;
  if (!entry) return `${SNACK_LABEL[slot]}: Ej ifylld`;
  return `${SNACK_LABEL[slot]}: ${entry.description.trim() || "Loggad"}`;
}

function mealsCrushed(
  mealDay: WeekMealsSummary["days"][number] | undefined,
): boolean {
  if (!mealDay) return false;
  return (
    MEAL_ORDER.every((key) => Boolean(mealDay.meals[key])) &&
    SNACK_SLOTS.every((slot) => Boolean(mealDay.snacks[slot]))
  );
}

function mealsRollupLabel(
  mealDay: WeekMealsSummary["days"][number] | undefined,
): string {
  if (mealsCrushed(mealDay)) return "Överträffat :D";
  const logged = MEAL_ORDER.filter((key) => mealDay?.meals[key]).length;
  if (logged <= 0) return "Ej ifylld";
  if (logged >= 3) return "Klar";
  if (logged === 2) return "Delvis";
  return "Inte klarat";
}

function withExceedTitle(title: string, exceeded: boolean): string {
  return exceeded ? `${title} · Överträffat :D` : title;
}

function formatMealsDayHover(
  day: WeekDay,
  mealDay: WeekMealsSummary["days"][number] | undefined,
): string {
  if (day.isFuture) return "Kommande";
  return [
    mealsRollupLabel(mealDay),
    ...MEAL_ORDER.map((key) =>
      formatMealHover(MEAL_LABEL_SV[key], mealDay?.meals[key] ?? null, false),
    ),
    ...SNACK_SLOTS.map((slot) =>
      formatSnackHover(slot, mealDay?.snacks[slot] ?? null, false),
    ),
  ].join("\n");
}

interface SubRowDef {
  key: string;
  icon: string;
  label: string;
  renderCell: (ctx: SubRowCellCtx) => SubRowCellContent;
}

interface SubRowCellCtx {
  date: string;
  isFuture: boolean;
  isToday: boolean;
  habitDay: WeekHabitSummary["days"][number] | undefined;
  waterDay: WeekDay;
  mealDay: WeekMealsSummary["days"][number] | undefined;
}

interface SubRowCellContent {
  status: HabitStatus | null;
  title: string;
  detail?: string;
  moodIcon?: string;
  /** Taller wrapping cell for meal/snack names. */
  food?: boolean;
  /** Well above the daily goal — extra green :D. */
  exceeded?: boolean;
  /** If false, day is excluded from ∑ (e.g. weekday-only intake on weekend). */
  countable?: boolean;
}

interface Props {
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  mealsWeek: WeekMealsSummary;
  mediaWeek: WeekMediaSummary;
  dailyRows: WeekProgressDailyRowKey[];
}

export function WeekDailyHabitRows({
  week,
  habitWeek,
  mealsWeek,
  mediaWeek,
  dailyRows,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [openMediaDate, setOpenMediaDate] = useState<string | null>(null);
  const [openMoodDate, setOpenMoodDate] = useState<string | null>(null);
  const pastDays = habitWeek.days.filter((d) => !d.isFuture).length;
  const habitDayByDate = new Map(habitWeek.days.map((d) => [d.date, d]));
  const mealDayByDate = new Map(mealsWeek.days.map((d) => [d.date, d]));
  const mediaDayByDate = new Map(mediaWeek.days.map((d) => [d.date, d]));

  const openMediaDay = openMediaDate
    ? mediaDayByDate.get(openMediaDate)
    : null;
  const openMoodValue = openMoodDate
    ? (habitDayByDate.get(openMoodDate)?.mood ?? null)
    : null;
  const openMoodNote = openMoodDate
    ? (habitDayByDate.get(openMoodDate)?.moodNote ?? null)
    : null;

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const habitByKey = new Map(habitWeek.habits.map((h) => [h.key, h]));

  return (
    <>
      {dailyRows.map((rowKey) => {
        const parsed = parseDailyRowKey(rowKey);
        if (parsed.type === "water") {
          return (
            <HabitRowGroup
              key="water"
              rowKey="water"
              icon="💧"
              label="Vatten"
              expandedKey={expandedKey}
              onToggle={toggle}
              subRows={waterSubRows()}
              week={week}
              habitWeek={habitWeek}
              mealsWeek={mealsWeek}
              habitDayByDate={habitDayByDate}
              mealDayByDate={mealDayByDate}
              pastDays={pastDays}
              renderSummary={(d) => ({
                status: null,
                waterStatus: waterDayStatus(d),
                exceeded: goalExceeded(d.totalMl, d.goalMl),
                title: withExceedTitle(
                  `${formatDayShort(d.date)}: ${formatMl(d.totalMl)} / ${formatMl(d.goalMl)}`,
                  goalExceeded(d.totalMl, d.goalMl),
                ),
              })}
              total={{
                value: week.daysHit,
                total: pastDays,
                highlight: week.daysHit === pastDays && pastDays > 0,
              }}
              isWater
            />
          );
        }

        const habit = habitByKey.get(parsed.habitKey);
        if (!habit) return null;

        return (
          <HabitRowGroup
            key={habit.id}
            rowKey={habit.id}
            icon={habit.icon}
            label={habit.label}
            expandedKey={expandedKey}
            onToggle={toggle}
            subRows={subRowsForHabit(habit)}
            week={week}
            habitWeek={habitWeek}
            mealsWeek={mealsWeek}
            habitDayByDate={habitDayByDate}
            mealDayByDate={mealDayByDate}
            pastDays={pastDays}
            habit={habit}
            onCellActivate={
              habit.kind === "media"
                ? (date) => setOpenMediaDate(date)
                : habit.kind === "mood"
                  ? (date) => setOpenMoodDate(date)
                  : undefined
            }
            renderSummary={(d) => {
              const habitDay = habitDayByDate.get(d.date);
              const status = habitDay?.statuses[habit.id] ?? null;
              const moodKey =
                habit.kind === "mood" ? (habitDay?.mood ?? null) : null;
              const mediaDay =
                habit.kind === "media" ? mediaDayByDate.get(d.date) : null;
              const mediaCount = mediaDay?.context.loggedToday.length ?? 0;
              const mealDay = mealDayByDate.get(d.date);
              const exceeded =
                habit.kind === "meal"
                  ? mealsCrushed(mealDay)
                  : habit.kind === "steps"
                    ? goalExceeded(
                        habitDay?.details.steps?.value ?? 0,
                        habitDay?.details.steps?.goal ?? 0,
                      )
                    : habit.kind === "activity_hours"
                      ? goalExceeded(
                          habitDay?.details.activity?.value ?? 0,
                          habitDay?.details.activity?.goal ?? 0,
                        )
                      : false;
              const mealSummary =
                habit.kind === "meal"
                  ? formatMealsDayHover(d, mealDay)
                  : null;
              const baseTitle = mealSummary
                ? `${habit.label}, ${formatDayShort(d.date)}\n${mealSummary}`
                : `${habit.label}, ${formatDayShort(d.date)}: ${
                    d.isFuture
                      ? "Kommande"
                      : moodKey
                        ? MOOD_LABEL[moodKey]
                        : mediaDay?.summary
                          ? mediaDay.summary
                          : HABIT_STATUS_LABEL[status ?? "empty"]
                  }`;
              return {
                status,
                moodKey,
                mediaCount: habit.kind === "media" ? mediaCount : undefined,
                exceeded,
                title: withExceedTitle(baseTitle, exceeded),
              };
            }}
            total={{
              value: habitWeek.yesByHabit[habit.id] ?? 0,
              total: pastDays,
              highlight:
                (habitWeek.yesByHabit[habit.id] ?? 0) === pastDays &&
                pastDays > 0,
            }}
          />
        );
      })}

      <DailySectionTotalRow
        week={week}
        habitWeek={habitWeek}
        dailyRows={dailyRows}
        pastDays={pastDays}
      />

      {openMediaDay ? (
        <WeekMediaLogDialog
          date={openMediaDay.date}
          context={openMediaDay.context}
          onClose={() => setOpenMediaDate(null)}
        />
      ) : null}

      {openMoodDate ? (
        <WeekMoodLogDialog
          date={openMoodDate}
          currentMood={openMoodValue}
          currentNote={openMoodNote}
          onClose={() => setOpenMoodDate(null)}
        />
      ) : null}
    </>
  );
}

function DailySectionTotalRow({
  week,
  habitWeek,
  dailyRows,
  pastDays,
}: {
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  dailyRows: WeekProgressDailyRowKey[];
  pastDays: number;
}) {
  const habitByKey = new Map(habitWeek.habits.map((h) => [h.key, h]));
  const habitDayByDate = new Map(habitWeek.days.map((d) => [d.date, d]));

  const countedHabits = dailyRows
    .map((key) => parseDailyRowKey(key))
    .filter((p): p is { type: "habit"; habitKey: string } => p.type === "habit")
    .map((p) => habitByKey.get(p.habitKey))
    .filter((h): h is Habit => Boolean(h));
  const includeWater = dailyRows.some((key) => parseDailyRowKey(key).type === "water");
  const rowsPerDay = (includeWater ? 1 : 0) + countedHabits.length;

  let weekHit = 0;
  let weekTotal = 0;

  const dayScores = week.days.map((d) => {
    if (d.isFuture || rowsPerDay === 0) {
      return null;
    }

    const habitDay = habitDayByDate.get(d.date);
    let hit = 0;
    if (includeWater) {
      const w = waterDayStatus(d);
      if (w === "good") hit += 1;
      else if (w === "almost") hit += 0.5;
    }
    for (const habit of countedHabits) {
      hit += habitStatusPoints(habitDay?.statuses[habit.id] ?? null);
    }

    weekHit += hit;
    weekTotal += rowsPerDay;
    return { hit, total: rowsPerDay };
  });

  if (rowsPerDay === 0) return null;

  return (
    <tr className={styles.sectionTotalRow}>
      <th
        className={[styles.rowLabel, styles.stickyCol, styles.sectionTotalLabel].join(
          " ",
        )}
        scope="row"
      >
        <span className={styles.rowText}>Dagligt total</span>
      </th>
      {week.days.map((d, i) => {
        const score = dayScores[i];
        return (
          <td
            key={d.date}
            className={cellClass(
              styles.dataCell,
              styles.sectionTotalCell,
              d.isFuture && styles.cellFuture,
              d.isToday && styles.cellToday,
            )}
          >
            {score ? (
              <span
                className={styles.totalFraction}
                title={`${formatHabitPoints(score.hit)} av ${score.total} dagliga (½ = 0,5)`}
              >
                <span className={styles.totalValue}>
                  {formatHabitPoints(score.hit)}
                </span>
                <span className={styles.totalSlash}>/{score.total}</span>
              </span>
            ) : (
              <span className={styles.emptyMark}>—</span>
            )}
          </td>
        );
      })}
      <TotalCell
        value={weekHit}
        total={weekTotal || pastDays * rowsPerDay}
        highlight={weekTotal > 0 && weekHit === weekTotal}
      />
    </tr>
  );
}

function HabitRowGroup({
  rowKey,
  icon,
  label,
  expandedKey,
  onToggle,
  subRows,
  week,
  habitDayByDate,
  mealDayByDate,
  pastDays,
  renderSummary,
  total,
  habit,
  isWater,
  onCellActivate,
}: {
  rowKey: string;
  icon: string;
  label: string;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  subRows: SubRowDef[];
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  mealsWeek: WeekMealsSummary;
  habitDayByDate: Map<string, WeekHabitSummary["days"][number]>;
  mealDayByDate: Map<string, WeekMealsSummary["days"][number]>;
  pastDays: number;
  renderSummary: (d: WeekDay) => {
    status: HabitStatus | null;
    moodKey?: MoodKey | null;
    mediaCount?: number;
    waterStatus?: ReturnType<typeof waterDayStatus>;
    exceeded?: boolean;
    title: string;
  };
  total: { value: number; total: number; highlight?: boolean };
  habit?: Habit;
  isWater?: boolean;
  /** When set, double-clicking a non-future cell logs that day directly. */
  onCellActivate?: (date: string) => void;
}) {
  const expanded = expandedKey === rowKey;
  const canExpand = subRows.length > 0;

  return (
    <>
      <tr className={expanded ? styles.rowExpanded : undefined}>
        <ExpandableRowLabel
          icon={icon}
          label={label}
          expandable={canExpand}
          expanded={expanded}
          onToggle={() => onToggle(rowKey)}
        />
        {week.days.map((d) => {
          const summary = renderSummary(d);
          const interactive = Boolean(onCellActivate) && !d.isFuture;
          return (
            <td
              key={d.date}
              className={cellClass(
                styles.dataCell,
                d.isFuture && styles.cellFuture,
                d.isToday && styles.cellToday,
                interactive && styles.cellInteractive,
                isWater &&
                  !d.isFuture &&
                  (summary.exceeded
                    ? styles.waterCell_crush
                    : styles[`waterCell_${summary.waterStatus}`]),
                !isWater &&
                  habit &&
                  !d.isFuture &&
                  (summary.exceeded
                    ? styles.habitCell_crush
                    : styles[`habitCell_${summary.status ?? "empty"}`]),
              )}
              title={
                interactive
                  ? `${summary.title} · Dubbelklicka för att logga`
                  : summary.title
              }
              onDoubleClick={
                interactive ? () => onCellActivate!(d.date) : undefined
              }
            >
              {!d.isFuture ? (
                isWater && summary.waterStatus ? (
                  <WaterMark
                    status={summary.waterStatus}
                    exceeded={summary.exceeded}
                  />
                ) : summary.moodKey ? (
                  <span
                    className={styles.moodMark}
                    aria-label={MOOD_LABEL[summary.moodKey]}
                  >
                    {MOOD_ICON[summary.moodKey]}
                  </span>
                ) : summary.mediaCount != null && summary.mediaCount > 1 ? (
                  <span
                    className={styles.mediaCountMark}
                    aria-label={`${summary.mediaCount} titlar`}
                  >
                    {summary.mediaCount}
                  </span>
                ) : (
                  <StatusMark
                    status={summary.status}
                    exceeded={summary.exceeded}
                  />
                )
              ) : null}
            </td>
          );
        })}
        <TotalCell
          value={total.value}
          total={total.total}
          highlight={total.highlight}
        />
      </tr>

      {expanded
        ? subRows.map((sub) => {
            const subTotal = computeSubRowTotal(
              sub,
              week.days,
              habitDayByDate,
              mealDayByDate,
            );
            return (
            <tr key={`${rowKey}-${sub.key}`} className={styles.subRow}>
              <SubRowLabel icon={sub.icon} label={sub.label} />
              {week.days.map((d) => {
                const content = sub.renderCell({
                  date: d.date,
                  isFuture: d.isFuture,
                  isToday: d.isToday,
                  habitDay: habitDayByDate.get(d.date),
                  waterDay: d,
                  mealDay: mealDayByDate.get(d.date),
                });
                return (
                  <td
                    key={d.date}
                    className={cellClass(
                      styles.dataCell,
                      styles.subCell,
                      content.food && styles.subCellFood,
                      d.isFuture && styles.cellFuture,
                      d.isToday && styles.cellToday,
                      !d.isFuture &&
                        (content.exceeded
                          ? styles.habitCell_crush
                          : styles[`habitCell_${content.status ?? "empty"}`]),
                    )}
                    title={content.title}
                  >
                    {!d.isFuture ? (
                      <SubRowCellMark content={content} />
                    ) : null}
                  </td>
                );
              })}
              <TotalCell
                value={subTotal.value}
                total={subTotal.total}
                highlight={subTotal.highlight}
              />
            </tr>
            );
          })
        : null}
    </>
  );
}

function computeSubRowTotal(
  sub: SubRowDef,
  days: WeekDay[],
  habitDayByDate: Map<string, WeekHabitSummary["days"][number]>,
  mealDayByDate: Map<string, WeekMealsSummary["days"][number]>,
): { value: number; total: number; highlight: boolean } {
  let value = 0;
  let total = 0;

  for (const d of days) {
    if (d.isFuture) continue;
    const content = sub.renderCell({
      date: d.date,
      isFuture: d.isFuture,
      isToday: d.isToday,
      habitDay: habitDayByDate.get(d.date),
      waterDay: d,
      mealDay: mealDayByDate.get(d.date),
    });
    if (content.countable === false) continue;
    total += 1;
    value += habitStatusPoints(content.status);
  }

  return {
    value,
    total,
    highlight: total > 0 && value === total,
  };
}

function SubRowCellMark({ content }: { content: SubRowCellContent }) {
  if (content.moodIcon) {
    return (
      <span className={styles.subMoodMark} aria-hidden>
        {content.moodIcon}
      </span>
    );
  }

  // Missed or not yet filled in → always show ✓ / ½ / ✗ / ·
  if (content.status === "no" || content.status === null) {
    return <StatusMark status={content.status} small />;
  }

  if (
    content.detail &&
    (content.status === "yes" || content.status === "half")
  ) {
    return (
      <span
        className={cellClass(
          styles.subDetail,
          content.food && styles.subFoodDetail,
          content.exceeded
            ? styles.subDetail_crush
            : styles[`subDetail_${content.status}`],
        )}
      >
        {content.detail}
      </span>
    );
  }

  return (
    <StatusMark
      status={content.status}
      small
      exceeded={content.exceeded}
    />
  );
}

function withPastDayMissed(
  status: HabitStatus | null,
  day: { isFuture: boolean; isToday: boolean },
): HabitStatus | null {
  return statusOrMissedOnPastDay(status, day);
}

function waterSubRows(): SubRowDef[] {
  return [
    {
      key: "amount",
      icon: "💧",
      label: "Mängd",
      renderCell: ({ isFuture, isToday, waterDay }) => {
        const day = { isFuture, isToday };
        if (isFuture) {
          return { status: null, title: "Kommande" };
        }
        const { totalMl, goalMl } = waterDay;
        const wStatus = waterDayStatus(waterDay);
        const status: HabitStatus =
          wStatus === "good" ? "yes" : wStatus === "almost" ? "half" : "no";
        const exceeded = goalExceeded(totalMl, goalMl);
        return {
          status: withPastDayMissed(totalMl > 0 ? status : null, day),
          title: withExceedTitle(
            `${formatMl(totalMl)} / ${formatMl(goalMl)}`,
            exceeded,
          ),
          detail: `${formatMl(totalMl)}`,
          exceeded,
        };
      },
    },
  ];
}

function subRowsForHabit(habit: Habit): SubRowDef[] {
  switch (habit.kind) {
    case "meal":
      return [
        ...MEAL_ORDER.map((mealKey) => ({
          key: mealKey,
          icon: MEAL_ICON[mealKey],
          label: MEAL_LABEL_SV[mealKey],
          renderCell: ({ isFuture, mealDay }: SubRowCellCtx) => {
            if (isFuture) {
              return { status: null, title: `${MEAL_LABEL_SV[mealKey]}: Kommande` };
            }
            const entry = mealDay?.meals[mealKey] ?? null;
            const logged = Boolean(entry);
            const status: HabitStatus | null = logged ? "yes" : null;
            return {
              status,
              title: formatMealHover(MEAL_LABEL_SV[mealKey], entry, false),
              detail: mealCellDetail(entry),
              food: true,
            };
          },
        })),
        ...SNACK_SLOTS.map((slot) => ({
          key: `snack-${slot}`,
          icon: SNACK_ICON[slot],
          label: SNACK_LABEL[slot],
          renderCell: ({ isFuture, mealDay }: SubRowCellCtx) => {
            if (isFuture) {
              return { status: null, title: `${SNACK_LABEL[slot]}: Kommande` };
            }
            const entry = mealDay?.snacks[slot] ?? null;
            const logged = Boolean(entry);
            const status: HabitStatus | null = logged ? "yes" : null;
            return {
              status,
              title: formatSnackHover(slot, entry, false),
              detail: snackCellDetail(entry),
              food: true,
            };
          },
        })),
      ];

    case "intake":
      return INTAKE_ORDER.map((kind) => ({
        key: kind,
        icon: INTAKE_ICON[kind],
        label: INTAKE_LABEL[kind],
        renderCell: ({ isFuture, isToday, date, habitDay }) => {
          const day = { isFuture, isToday };
          if (isFuture) return { status: null, title: "Kommande" };
          const applicable = applicableIntakeKinds(date);
          if (!applicable.includes(kind)) {
            return {
              status: null,
              title: `${INTAKE_LABEL[kind]}: Ej denna dag`,
              detail: "—",
              countable: false,
            };
          }
          const done = habitDay?.details.intake?.[kind] ?? false;
          return {
            status: withPastDayMissed(done ? "yes" : "no", day),
            title: `${INTAKE_LABEL[kind]}: ${done ? "Ja" : "Nej"}`,
          };
        },
      }));

    case "steps":
      return [
        {
          key: "steps",
          icon: "👟",
          label: "Steg",
          renderCell: ({ isFuture, isToday, habitDay }) => {
            const day = { isFuture, isToday };
            if (isFuture) return { status: null, title: "Kommande" };
            const { value = 0, goal = 0 } = habitDay?.details.steps ?? {};
            const status = withPastDayMissed(
              numericGoalStatus(value, goal),
              day,
            );
            const exceeded = goalExceeded(value, goal);
            return {
              status,
              title: withExceedTitle(
                `${value.toLocaleString("sv-SE")} / ${goal.toLocaleString("sv-SE")} steg`,
                exceeded,
              ),
              detail:
                value > 0
                  ? value >= 1000
                    ? `${(value / 1000).toFixed(1)}k`
                    : String(value)
                  : "0",
              exceeded,
            };
          },
        },
      ];

    case "activity_hours":
      return [
        {
          key: "activity",
          icon: "⏱️",
          label: "Timmar",
          renderCell: ({ isFuture, isToday, habitDay }) => {
            const day = { isFuture, isToday };
            if (isFuture) return { status: null, title: "Kommande" };
            const { value = 0, goal = 0 } = habitDay?.details.activity ?? {};
            const status = withPastDayMissed(
              numericGoalStatus(value, goal),
              day,
            );
            const exceeded = goalExceeded(value, goal);
            return {
              status,
              title: withExceedTitle(
                `${value} / ${goal} h aktivitet`,
                exceeded,
              ),
              detail: value > 0 ? `${value}h` : "0h",
              exceeded,
            };
          },
        },
      ];

    case "smoke_free":
      return SMOKE_FREE_SUBSTANCES.map((sub) => ({
        key: sub.key,
        icon: sub.icon,
        label: sub.label,
        renderCell: ({ isFuture, isToday, habitDay }) => {
          const day = { isFuture, isToday };
          if (isFuture) return { status: null, title: "Kommande" };
          const raw =
            habitDay?.details.smokeFree?.[
              sub.key === "nicotine" ? "nicotine" : "cannabis"
            ] ?? null;
          const status = withPastDayMissed(raw, day);
          return {
            status,
            title: `${sub.label}: ${status ? HABIT_STATUS_LABEL[status] : "Ej loggad"}`,
          };
        },
      }));

    case "tri_state":
      return [];

    case "mobile_games":
      return MOBILE_GAME_STEPS.map((game) => ({
        key: game.key,
        icon: game.icon,
        label: game.label,
        renderCell: ({ isFuture, isToday, habitDay }) => {
          const day = { isFuture, isToday };
          if (isFuture) return { status: null, title: "Kommande" };
          const games = habitDay?.details.mobileGames;
          const done =
            game.key === "chess"
              ? games?.chess
              : game.key === "duolingo"
                ? games?.duolingo
                : games?.pokemonGo;
          const hasLog = games != null;
          const status = withPastDayMissed(
            hasLog ? (done ? "yes" : "no") : null,
            day,
          );
          return {
            status,
            title: `${game.label}: ${hasLog ? (done ? "Klar" : "Ej klar") : "Ej loggad"}`,
          };
        },
      }));

    case "mood":
      return [];

    default:
      return [];
  }
}

function ExpandableRowLabel({
  icon,
  label,
  expandable,
  expanded,
  onToggle,
}: {
  icon: string;
  label: string;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!expandable) {
    return (
      <th className={[styles.rowLabel, styles.stickyCol].join(" ")} scope="row">
        <span className={styles.rowIcon} aria-hidden>
          {icon}
        </span>
        <span className={styles.rowText}>{label}</span>
      </th>
    );
  }

  return (
    <th className={[styles.rowLabel, styles.stickyCol].join(" ")} scope="row">
      <button
        type="button"
        className={styles.expandBtn}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Dölj" : "Visa"} detaljer för ${label}`}
      >
        <span
          className={cellClass(styles.chevron, expanded && styles.chevronUp)}
          aria-hidden
        >
          ▾
        </span>
        <span className={styles.rowIcon} aria-hidden>
          {icon}
        </span>
        <span className={styles.rowText}>{label}</span>
      </button>
    </th>
  );
}

function SubRowLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <th
      className={[styles.rowLabel, styles.subRowLabel, styles.stickyCol].join(
        " ",
      )}
      scope="row"
    >
      <span className={styles.subRowIndent} aria-hidden />
      <span className={styles.rowIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.subRowText}>{label}</span>
    </th>
  );
}

function TotalCell({
  value,
  total,
  highlight,
}: {
  value: number;
  total: number;
  highlight?: boolean;
}) {
  return (
    <td
      className={cellClass(
        styles.totalCell,
        highlight && styles.totalCellDone,
      )}
    >
      <span className={styles.totalFraction}>
        <span className={styles.totalValue}>{formatHabitPoints(value)}</span>
        <span className={styles.totalSlash}>/{total}</span>
      </span>
    </td>
  );
}

function StatusMark({
  status,
  small,
  exceeded,
}: {
  status: HabitStatus | null;
  small?: boolean;
  exceeded?: boolean;
}) {
  const resolved = status ?? "empty";
  const crush = Boolean(exceeded && resolved === "yes");
  const label = crush ? "Överträffat" : HABIT_STATUS_LABEL[resolved];
  return (
    <span
      className={cellClass(
        styles.statusMark,
        small && styles.statusMarkSmall,
        crush ? styles.statusMark_crush : styles[`statusMark_${resolved}`],
      )}
      aria-label={label}
    >
      {crush
        ? ":D"
        : resolved === "yes"
          ? "✓"
          : resolved === "half"
            ? "½"
            : resolved === "no"
              ? "✗"
              : "·"}
    </span>
  );
}

function WaterMark({
  status,
  exceeded,
}: {
  status: ReturnType<typeof waterDayStatus>;
  exceeded?: boolean;
}) {
  if (status === "future") return null;
  const crush = Boolean(exceeded && status === "good");
  return (
    <span
      className={cellClass(
        styles.waterMark,
        crush ? styles.waterMark_crush : styles[`waterMark_${status}`],
      )}
      aria-hidden
    >
      {crush ? ":D" : status === "good" ? "✓" : status === "almost" ? "~" : "!"}
    </span>
  );
}

function cellClass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
