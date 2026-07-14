"use client";

import { useState } from "react";
import { formatDayShort } from "@/lib/date";
import {
  MEAL_ICON,
  MEAL_ORDER,
  numericGoalStatus,
  statusOrMissedOnPastDay,
  type Habit,
  type HabitStatus,
  type MealKey,
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
import type { WeekDay, WeekSummary } from "@/lib/water.server";
import { formatMl, waterDayStatus } from "@/lib/water";
import {
  parseDailyRowKey,
  type WeekProgressDailyRowKey,
} from "@/lib/week-progress-layout";
import styles from "./week-progress.module.scss";

const MEAL_LABEL_SV: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
};

const HABIT_STATUS_LABEL: Record<HabitStatus | "empty", string> = {
  yes: "Ja",
  half: "Delvis",
  no: "Nej",
  empty: "—",
};

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
  /** If false, day is excluded from ∑ (e.g. weekday-only intake on weekend). */
  countable?: boolean;
}

interface Props {
  week: WeekSummary;
  habitWeek: WeekHabitSummary;
  mealsWeek: WeekMealsSummary;
  dailyRows: WeekProgressDailyRowKey[];
}

export function WeekDailyHabitRows({
  week,
  habitWeek,
  mealsWeek,
  dailyRows,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const pastDays = habitWeek.days.filter((d) => !d.isFuture).length;
  const habitDayByDate = new Map(habitWeek.days.map((d) => [d.date, d]));
  const mealDayByDate = new Map(mealsWeek.days.map((d) => [d.date, d]));

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
                title: `${formatDayShort(d.date)}: ${formatMl(d.totalMl)} / ${formatMl(d.goalMl)}`,
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
            renderSummary={(d) => {
              const habitDay = habitDayByDate.get(d.date);
              const status = habitDay?.statuses[habit.id] ?? null;
              const moodKey =
                habit.kind === "mood" ? (habitDay?.mood ?? null) : null;
              return {
                status,
                moodKey,
                title: `${habit.label}, ${formatDayShort(d.date)}: ${
                  d.isFuture
                    ? "Kommande"
                    : moodKey
                      ? MOOD_LABEL[moodKey]
                      : HABIT_STATUS_LABEL[status ?? "empty"]
                }`,
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
    </>
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
    waterStatus?: ReturnType<typeof waterDayStatus>;
    title: string;
  };
  total: { value: number; total: number; highlight?: boolean };
  habit?: Habit;
  isWater?: boolean;
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
          return (
            <td
              key={d.date}
              className={cellClass(
                styles.dataCell,
                d.isFuture && styles.cellFuture,
                d.isToday && styles.cellToday,
                isWater &&
                  !d.isFuture &&
                  styles[`waterCell_${summary.waterStatus}`],
                !isWater &&
                  habit &&
                  !d.isFuture &&
                  styles[`habitCell_${summary.status ?? "empty"}`],
              )}
              title={summary.title}
            >
              {!d.isFuture ? (
                isWater && summary.waterStatus ? (
                  <WaterMark status={summary.waterStatus} />
                ) : summary.moodKey ? (
                  <span
                    className={styles.moodMark}
                    aria-label={MOOD_LABEL[summary.moodKey]}
                  >
                    {MOOD_ICON[summary.moodKey]}
                  </span>
                ) : (
                  <StatusMark status={summary.status} />
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
                      d.isFuture && styles.cellFuture,
                      d.isToday && styles.cellToday,
                      !d.isFuture &&
                        styles[`habitCell_${content.status ?? "empty"}`],
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
    if (content.status === "yes") value += 1;
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
          styles[`subDetail_${content.status}`],
        )}
      >
        {content.detail}
      </span>
    );
  }

  return <StatusMark status={content.status} small />;
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
        return {
          status: withPastDayMissed(totalMl > 0 ? status : null, day),
          title: `${formatMl(totalMl)} / ${formatMl(goalMl)}`,
          detail: `${formatMl(totalMl)}`,
        };
      },
    },
  ];
}

function subRowsForHabit(habit: Habit): SubRowDef[] {
  switch (habit.kind) {
    case "meal":
      return MEAL_ORDER.map((mealKey) => ({
        key: mealKey,
        icon: MEAL_ICON[mealKey],
        label: MEAL_LABEL_SV[mealKey],
        renderCell: ({ isFuture, isToday, mealDay }) => {
          const day = { isFuture, isToday };
          if (isFuture) return { status: null, title: "Kommande" };
          const logged = Boolean(mealDay?.meals[mealKey]);
          return {
            status: withPastDayMissed(logged ? "yes" : "no", day),
            title: `${MEAL_LABEL_SV[mealKey]}: ${logged ? "Loggad" : "Ej loggad"}`,
          };
        },
      }));

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
            return {
              status,
              title: `${value.toLocaleString("sv-SE")} / ${goal.toLocaleString("sv-SE")} steg`,
              detail:
                value > 0
                  ? value >= 1000
                    ? `${(value / 1000).toFixed(1)}k`
                    : String(value)
                  : "0",
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
            return {
              status,
              title: `${value} / ${goal} h aktivitet`,
              detail: value > 0 ? `${value}h` : "0h",
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
        <span className={styles.totalValue}>{value}</span>
        <span className={styles.totalSlash}>/{total}</span>
      </span>
    </td>
  );
}

function StatusMark({
  status,
  small,
}: {
  status: HabitStatus | null;
  small?: boolean;
}) {
  const resolved = status ?? "empty";
  const label = HABIT_STATUS_LABEL[resolved];
  return (
    <span
      className={cellClass(
        styles.statusMark,
        small && styles.statusMarkSmall,
        styles[`statusMark_${resolved}`],
      )}
      aria-label={label}
    >
      {resolved === "yes"
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
}: {
  status: ReturnType<typeof waterDayStatus>;
}) {
  if (status === "future") return null;
  return (
    <span
      className={cellClass(styles.waterMark, styles[`waterMark_${status}`])}
      aria-hidden
    >
      {status === "good" ? "✓" : status === "almost" ? "~" : "!"}
    </span>
  );
}

function cellClass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
