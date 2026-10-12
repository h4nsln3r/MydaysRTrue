"use client";

import { Fragment, useState } from "react";
import {
  WeekActivityLogDialog,
  WeekFoodPickDialog,
  WeekHabitStatusLogDialog,
  WeekIntakeLogDialog,
  WeekMobileGamesLogDialog,
  WeekSmokeFreeLogDialog,
  WeekSnackLogDialog,
  WeekWaterLogDialog,
} from "@/app/(app)/week/WeekDailyLogDialogs";
import { WeekMealLogDialog } from "@/app/(app)/week/WeekMealLogDialog";
import { WeekMediaLogDialog } from "@/app/(app)/week/WeekMediaLogDialog";
import { WeekMoodLogDialog } from "@/app/(app)/week/WeekMoodLogDialog";
import { WeekStepsLogDialog } from "@/app/(app)/week/WeekStepsLogDialog";
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
  waterStatusFor,
  type Habit,
  type HabitStatus,
  type MealEntry,
  type MealKey,
  type MealRestaurant,
  type SnackEntry,
  type SnackSlot,
} from "@/lib/habits";
import type { MonthDay } from "@/lib/habits.server";
import {
  INTAKE_ICON,
  INTAKE_LABEL,
  INTAKE_ORDER,
  applicableIntakeKinds,
  type IntakeKind,
} from "@/lib/intake";
import type { MealBoxStockItem, WeekMealDay } from "@/lib/meal-box.server";
import { foodDrinkSummary, foodRatingLabel } from "@/lib/meal-log";
import type { DailyMediaContext } from "@/lib/media";
import { MOBILE_GAME_STEPS } from "@/lib/mobile-games";
import { SMOKE_FREE_SUBSTANCES } from "@/lib/smoke-free";
import { formatMl } from "@/lib/water";
import styles from "./month-progress.module.scss";

const HABIT_STATUS_LABEL: Record<HabitStatus | "empty", string> = {
  yes: "Ja",
  half: "Delvis",
  no: "Nej",
  empty: "—",
};

type OpenLog =
  | { type: "water"; date: string }
  | { type: "food-pick"; date: string }
  | { type: "meal"; date: string; meal: MealKey }
  | { type: "snack"; date: string; slot: SnackSlot }
  | { type: "intake"; date: string; kind?: IntakeKind }
  | { type: "steps"; date: string }
  | { type: "activity"; date: string }
  | { type: "smoke"; date: string }
  | { type: "status"; date: string; habitId: string; label: string }
  | { type: "games"; date: string }
  | { type: "media"; date: string }
  | { type: "mood"; date: string };

interface Props {
  habits: Habit[];
  days: MonthDay[];
  yesByHabit: Record<string, number>;
  mealDays: WeekMealDay[];
  mealBoxStock: MealBoxStockItem[];
  savedRestaurants: MealRestaurant[];
  mediaContexts: DailyMediaContext[];
}

export function MonthDailyHabitRows({
  habits,
  days,
  yesByHabit,
  mealDays,
  mealBoxStock,
  savedRestaurants,
  mediaContexts,
}: Props) {
  const [openLog, setOpenLog] = useState<OpenLog | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const mealDayByDate = new Map(mealDays.map((day) => [day.date, day]));
  const mediaByDate = new Map(
    mediaContexts.map((context) => [context.localDate, context]),
  );

  const openHabitLog = (habit: Habit, date: string, subKey?: string) => {
    const snackSlot = parseSnackSlot(subKey);
    if (snackSlot && (habit.kind === "meal" || habit.kind === "snack")) {
      setOpenLog({ type: "snack", date, slot: snackSlot });
      return;
    }
    if (
      subKey &&
      MEAL_ORDER.includes(subKey as MealKey) &&
      (habit.kind === "meal" || habit.kind === "snack")
    ) {
      setOpenLog({ type: "meal", date, meal: subKey as MealKey });
      return;
    }

    switch (habit.kind) {
      case "water":
        setOpenLog({ type: "water", date });
        return;
      case "media":
        if (mediaByDate.has(date)) setOpenLog({ type: "media", date });
        return;
      case "mood":
        setOpenLog({ type: "mood", date });
        return;
      case "steps":
        setOpenLog({ type: "steps", date });
        return;
      case "activity_hours":
        setOpenLog({ type: "activity", date });
        return;
      case "meal":
      case "snack":
        setOpenLog({ type: "food-pick", date });
        return;
      case "intake":
        setOpenLog({
          type: "intake",
          date,
          kind: isIntakeKind(subKey) ? subKey : undefined,
        });
        return;
      case "smoke_free":
        setOpenLog({ type: "smoke", date });
        return;
      case "mobile_games":
        setOpenLog({ type: "games", date });
        return;
      case "tri_state":
        setOpenLog({
          type: "status",
          date,
          habitId: habit.id,
          label: habit.label,
        });
        return;
      default:
        return;
    }
  };

  const openDay = openLog ? days.find((day) => day.date === openLog.date) : undefined;

  return (
    <>
      {habits.map((habit) => {
        const countable = days.filter(
          (day) => !day.isFuture && !day.hiddenHabitIds.includes(habit.id),
        );
        const value = yesByHabit[habit.id] ?? 0;
        const subRows = subRowsForHabit(habit);
        const expanded = expandedId === habit.id;
        return (
          <Fragment key={habit.id}>
          <tr className={expanded ? styles.rowExpanded : undefined}>
            <ExpandableRowLabel
              icon={habit.icon}
              label={habit.label}
              expandable={subRows.length > 0}
              expanded={expanded}
              onToggle={() =>
                setExpandedId((current) => (current === habit.id ? null : habit.id))
              }
            />
            {days.map((day) => {
              const hidden = day.hiddenHabitIds.includes(habit.id);
              const status = day.statuses[habit.id] ?? null;
              const interactive =
                canOpenHabit(habit.kind) && !day.isFuture && !hidden;
              const title = hidden
                ? `${habit.label}, dag ${day.dayOfMonth}: Visas inte`
                : `${habit.label}, dag ${day.dayOfMonth}: ${
                    day.isFuture
                      ? "Kommande"
                      : HABIT_STATUS_LABEL[status ?? "empty"]
                  }${interactive ? " · Klicka för att logga" : ""}`;
              return (
                <td
                  key={day.date}
                  className={cellClass(
                    styles.dataCell,
                    day.isFuture && styles.cellFuture,
                    day.isToday && styles.cellToday,
                    hidden && !day.isFuture && styles.cellOff,
                    interactive && styles.cellInteractive,
                    !day.isFuture &&
                      !hidden &&
                      styles[`habitCell_${status ?? "empty"}`],
                  )}
                  title={title}
                >
                  {interactive ? (
                    <button
                      type="button"
                      className={styles.cellButton}
                      aria-label={title}
                      onClick={() => openHabitLog(habit, day.date)}
                    >
                      <StatusMark status={status} decorative />
                    </button>
                  ) : !day.isFuture && !hidden ? (
                    <StatusMark status={status} />
                  ) : hidden && !day.isFuture ? (
                    <span className={styles.emptyMark}>–</span>
                  ) : null}
                </td>
              );
            })}
            <td
              className={cellClass(
                styles.totalCell,
                value === countable.length &&
                  countable.length > 0 &&
                  styles.totalCellDone,
              )}
            >
              <span className={styles.totalFraction}>
                <span className={styles.totalValue}>{formatHabitPoints(value)}</span>
                <span className={styles.totalSlash}>/{countable.length}</span>
              </span>
            </td>
          </tr>
          {expanded
            ? subRows.map((sub) => {
                const subTotal = subRowTotal(sub, days, habit, mealDayByDate);
                return (
                  <tr key={`${habit.id}-${sub.key}`} className={styles.subRow}>
                    <SubRowLabel icon={sub.icon} label={sub.label} />
                    {days.map((day) => {
                      const parentOff =
                        !day.isFuture && day.hiddenHabitIds.includes(habit.id);
                      const content = parentOff
                        ? hiddenPartCell(sub.label)
                        : sub.renderCell({
                            date: day.date,
                            isFuture: day.isFuture,
                            isToday: day.isToday,
                            day,
                            mealDay: mealDayByDate.get(day.date),
                          });
                      const interactive =
                        canOpenHabit(habit.kind) &&
                        !day.isFuture &&
                        !content.off &&
                        content.countable !== false;
                      const title = interactive
                        ? `${content.title} · Klicka för att logga`
                        : content.title;
                      return (
                        <td
                          key={day.date}
                          className={cellClass(
                            styles.dataCell,
                            styles.subCell,
                            content.food && styles.subCellFood,
                            day.isFuture && styles.cellFuture,
                            day.isToday && styles.cellToday,
                            content.off && styles.cellOff,
                            interactive && styles.cellInteractive,
                            !day.isFuture &&
                              !content.off &&
                              (content.exceeded
                                ? styles.habitCell_crush
                                : styles[`habitCell_${content.status ?? "empty"}`]),
                          )}
                          title={title}
                        >
                          {interactive ? (
                            <button
                              type="button"
                              className={styles.cellButton}
                              aria-label={title}
                              onClick={() => openHabitLog(habit, day.date, sub.key)}
                            >
                              <SubRowCellMark content={content} decorative />
                            </button>
                          ) : !day.isFuture ? (
                            <SubRowCellMark content={content} />
                          ) : null}
                        </td>
                      );
                    })}
                    <td
                      className={cellClass(
                        styles.totalCell,
                        subTotal.highlight && styles.totalCellDone,
                      )}
                    >
                      <span className={styles.totalFraction}>
                        <span className={styles.totalValue}>
                          {formatHabitPoints(subTotal.value)}
                        </span>
                        <span className={styles.totalSlash}>/{subTotal.total}</span>
                      </span>
                    </td>
                  </tr>
                );
              })
            : null}
          </Fragment>
        );
      })}

      {openLog?.type === "water" ? (
        <WeekWaterLogDialog
          date={openLog.date}
          totalMl={openDay?.details.water?.totalMl ?? 0}
          goalMl={openDay?.details.water?.goalMl ?? 2500}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "food-pick" ? (
        <WeekFoodPickDialog
          date={openLog.date}
          mealDay={mealDayByDate.get(openLog.date)}
          onPickMeal={(meal) =>
            setOpenLog({ type: "meal", date: openLog.date, meal })
          }
          onPickSnack={(slot) =>
            setOpenLog({ type: "snack", date: openLog.date, slot })
          }
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "meal" ? (
        <WeekMealLogDialog
          date={openLog.date}
          meal={openLog.meal}
          initial={mealDayByDate.get(openLog.date)?.meals[openLog.meal] ?? null}
          savedRestaurants={savedRestaurants}
          mealBoxStock={mealBoxStock}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "snack" ? (
        <WeekSnackLogDialog
          date={openLog.date}
          slot={openLog.slot}
          initial={mealDayByDate.get(openLog.date)?.snacks[openLog.slot] ?? null}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "intake" ? (
        <WeekIntakeLogDialog
          date={openLog.date}
          kind={openLog.kind}
          loggedByKind={openDay?.details.intake ?? {}}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "steps" ? (
        <WeekStepsLogDialog
          date={openLog.date}
          currentSteps={
            (openDay?.details.steps?.value ?? 0) > 0
              ? (openDay?.details.steps?.value ?? 0)
              : null
          }
          stepsGoal={openDay?.details.steps?.goal ?? 8000}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "activity" ? (
        <WeekActivityLogDialog
          date={openLog.date}
          currentHours={
            (openDay?.details.activity?.value ?? 0) > 0
              ? (openDay?.details.activity?.value ?? 0)
              : null
          }
          hoursGoal={openDay?.details.activity?.goal ?? 12}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "smoke" ? (
        <WeekSmokeFreeLogDialog
          date={openLog.date}
          nicotine={openDay?.details.smokeFree?.nicotine ?? null}
          cannabis={openDay?.details.smokeFree?.cannabis ?? null}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "status" ? (
        <WeekHabitStatusLogDialog
          date={openLog.date}
          habitId={openLog.habitId}
          label={openLog.label}
          currentStatus={openDay?.statuses[openLog.habitId] ?? null}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "games" ? (
        <WeekMobileGamesLogDialog
          date={openLog.date}
          games={{
            localDate: openLog.date,
            chess: openDay?.details.mobileGames?.chess ?? false,
            duolingo: openDay?.details.mobileGames?.duolingo ?? false,
            pokemonGo: openDay?.details.mobileGames?.pokemonGo ?? false,
            hasLog: openDay?.details.mobileGames != null,
          }}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "media" && mediaByDate.get(openLog.date) ? (
        <WeekMediaLogDialog
          date={openLog.date}
          context={mediaByDate.get(openLog.date)!}
          onClose={() => setOpenLog(null)}
        />
      ) : null}

      {openLog?.type === "mood" ? (
        <WeekMoodLogDialog
          date={openLog.date}
          currentMood={openDay?.mood ?? null}
          currentNote={openDay?.moodNote ?? null}
          onClose={() => setOpenLog(null)}
        />
      ) : null}
    </>
  );
}

const MEAL_LABEL_SV: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
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
  day: MonthDay;
  mealDay: WeekMealDay | undefined;
}

interface SubRowCellContent {
  status: HabitStatus | null;
  title: string;
  detail?: string;
  food?: boolean;
  exceeded?: boolean;
  countable?: boolean;
  off?: boolean;
}

function canOpenHabit(kind: Habit["kind"]): boolean {
  return (
    kind === "water" ||
    kind === "media" ||
    kind === "mood" ||
    kind === "steps" ||
    kind === "activity_hours" ||
    kind === "meal" ||
    kind === "snack" ||
    kind === "intake" ||
    kind === "smoke_free" ||
    kind === "mobile_games" ||
    kind === "tri_state"
  );
}

function isIntakeKind(key: string | undefined): key is IntakeKind {
  return Boolean(key && INTAKE_ORDER.includes(key as IntakeKind));
}

function parseSnackSlot(key: string | undefined): SnackSlot | null {
  if (key === "snack-1") return 1;
  if (key === "snack-2") return 2;
  return null;
}

function partHidden(day: MonthDay, habitId: string, partKey: string): boolean {
  return day.hiddenParts[habitId]?.includes(partKey) ?? false;
}

function hiddenPartCell(label: string): SubRowCellContent {
  return {
    status: null,
    title: `${label}: Visas inte`,
    countable: false,
    off: true,
  };
}

function withPastDayMissed(
  status: HabitStatus | null,
  day: { isFuture: boolean; isToday: boolean },
): HabitStatus | null {
  return statusOrMissedOnPastDay(status, day);
}

function withExceedTitle(title: string, exceeded: boolean): string {
  return exceeded ? `${title} · Överträffat :D` : title;
}

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

function formatMealHover(label: string, entry: MealEntry | null, isFuture: boolean): string {
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
  const drink = foodDrinkSummary(entry.waterMl, entry.drinkNote);
  if (drink) bits.push(drink);
  const ratingLabel = foodRatingLabel(entry.rating);
  if (ratingLabel) bits.push(ratingLabel);
  return `${label}: ${bits.join(" · ")}`;
}

function formatSnackHover(
  slot: SnackSlot,
  entry: SnackEntry | null,
  isFuture: boolean,
): string {
  if (isFuture) return `${SNACK_LABEL[slot]}: Kommande`;
  if (!entry) return `${SNACK_LABEL[slot]}: Ej ifylld`;
  const bits = [entry.description.trim() || "Loggad"];
  const drink = foodDrinkSummary(entry.waterMl, entry.drinkNote);
  if (drink) bits.push(drink);
  const ratingLabel = foodRatingLabel(entry.rating);
  if (ratingLabel) bits.push(ratingLabel);
  return `${SNACK_LABEL[slot]}: ${bits.join(" · ")}`;
}

function subRowsForHabit(habit: Habit): SubRowDef[] {
  switch (habit.kind) {
    case "water":
      return [
        {
          key: "amount",
          icon: "💧",
          label: "Mängd",
          renderCell: ({ isFuture, isToday, day }) => {
            if (isFuture) return { status: null, title: "Kommande" };
            const totalMl = day.details.water?.totalMl ?? 0;
            const goalMl = day.details.water?.goalMl ?? 0;
            const exceeded = goalExceeded(totalMl, goalMl);
            const status = withPastDayMissed(
              totalMl > 0 ? waterStatusFor(totalMl, goalMl) : null,
              { isFuture, isToday },
            );
            return {
              status,
              exceeded,
              title: withExceedTitle(
                `${formatMl(totalMl)} / ${formatMl(goalMl)}`,
                exceeded,
              ),
              detail: formatMl(totalMl),
            };
          },
        },
      ];

    case "meal":
      return [
        ...MEAL_ORDER.map((mealKey) => ({
          key: mealKey,
          icon: MEAL_ICON[mealKey],
          label: MEAL_LABEL_SV[mealKey],
          renderCell: ({ isFuture, day, mealDay }: SubRowCellCtx) => {
            if (partHidden(day, habit.id, mealKey)) {
              return hiddenPartCell(MEAL_LABEL_SV[mealKey]);
            }
            if (isFuture) {
              return { status: null, title: `${MEAL_LABEL_SV[mealKey]}: Kommande` };
            }
            const entry = mealDay?.meals[mealKey] ?? null;
            return {
              status: entry ? ("yes" as const) : null,
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
          renderCell: ({ isFuture, day, mealDay }: SubRowCellCtx) => {
            if (partHidden(day, habit.id, String(slot))) {
              return hiddenPartCell(SNACK_LABEL[slot]);
            }
            if (isFuture) {
              return { status: null, title: `${SNACK_LABEL[slot]}: Kommande` };
            }
            const entry = mealDay?.snacks[slot] ?? null;
            return {
              status: entry ? ("yes" as const) : null,
              title: formatSnackHover(slot, entry, false),
              detail: snackCellDetail(entry),
              food: true,
            };
          },
        })),
      ];

    case "snack":
      return SNACK_SLOTS.map((slot) => ({
        key: `snack-${slot}`,
        icon: SNACK_ICON[slot],
        label: SNACK_LABEL[slot],
        renderCell: ({ isFuture, day, mealDay }: SubRowCellCtx) => {
          if (partHidden(day, habit.id, String(slot))) {
            return hiddenPartCell(SNACK_LABEL[slot]);
          }
          if (isFuture) {
            return { status: null, title: `${SNACK_LABEL[slot]}: Kommande` };
          }
          const entry = mealDay?.snacks[slot] ?? null;
          return {
            status: entry ? ("yes" as const) : null,
            title: formatSnackHover(slot, entry, false),
            detail: snackCellDetail(entry),
            food: true,
          };
        },
      }));

    case "intake":
      return INTAKE_ORDER.map((kind) => ({
        key: kind,
        icon: INTAKE_ICON[kind],
        label: INTAKE_LABEL[kind],
        renderCell: ({ isFuture, isToday, date, day }) => {
          if (partHidden(day, habit.id, kind)) return hiddenPartCell(INTAKE_LABEL[kind]);
          if (isFuture) return { status: null, title: "Kommande" };
          if (!applicableIntakeKinds(date).includes(kind)) {
            return {
              status: null,
              title: `${INTAKE_LABEL[kind]}: Ej denna dag`,
              detail: "—",
              countable: false,
            };
          }
          const done = day.details.intake?.[kind] ?? false;
          return {
            status: withPastDayMissed(done ? "yes" : "no", { isFuture, isToday }),
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
          renderCell: ({ isFuture, isToday, day }) => {
            if (isFuture) return { status: null, title: "Kommande" };
            const value = day.details.steps?.value ?? 0;
            const goal = day.details.steps?.goal ?? 0;
            const exceeded = goalExceeded(value, goal);
            return {
              status: withPastDayMissed(numericGoalStatus(value, goal), {
                isFuture,
                isToday,
              }),
              exceeded,
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
          renderCell: ({ isFuture, isToday, day }) => {
            if (isFuture) return { status: null, title: "Kommande" };
            const value = day.details.activity?.value ?? 0;
            const goal = day.details.activity?.goal ?? 0;
            const exceeded = goalExceeded(value, goal);
            return {
              status: withPastDayMissed(numericGoalStatus(value, goal), {
                isFuture,
                isToday,
              }),
              exceeded,
              title: withExceedTitle(`${value} / ${goal} h aktivitet`, exceeded),
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
        renderCell: ({ isFuture, isToday, day }) => {
          if (partHidden(day, habit.id, sub.key)) return hiddenPartCell(sub.label);
          if (isFuture) return { status: null, title: "Kommande" };
          const raw =
            day.details.smokeFree?.[sub.key === "nicotine" ? "nicotine" : "cannabis"] ??
            null;
          const status = withPastDayMissed(raw, { isFuture, isToday });
          return {
            status,
            title: `${sub.label}: ${status ? HABIT_STATUS_LABEL[status] : "Ej loggad"}`,
          };
        },
      }));

    case "mobile_games":
      return MOBILE_GAME_STEPS.map((game) => ({
        key: game.key,
        icon: game.icon,
        label: game.label,
        renderCell: ({ isFuture, isToday, day }) => {
          if (partHidden(day, habit.id, game.key)) return hiddenPartCell(game.label);
          if (isFuture) return { status: null, title: "Kommande" };
          const games = day.details.mobileGames;
          const done =
            game.key === "chess"
              ? games?.chess
              : game.key === "duolingo"
                ? games?.duolingo
                : games?.pokemonGo;
          const hasLog = games != null;
          return {
            status: withPastDayMissed(hasLog ? (done ? "yes" : "no") : null, {
              isFuture,
              isToday,
            }),
            title: `${game.label}: ${hasLog ? (done ? "Klar" : "Ej klar") : "Ej loggad"}`,
          };
        },
      }));

    default:
      return [];
  }
}

function subRowTotal(
  sub: SubRowDef,
  days: MonthDay[],
  habit: Habit,
  mealDayByDate: Map<string, WeekMealDay>,
): { value: number; total: number; highlight: boolean } {
  let value = 0;
  let total = 0;
  for (const day of days) {
    if (day.isFuture) continue;
    const parentOff = day.hiddenHabitIds.includes(habit.id);
    const content = parentOff
      ? hiddenPartCell(sub.label)
      : sub.renderCell({
          date: day.date,
          isFuture: day.isFuture,
          isToday: day.isToday,
          day,
          mealDay: mealDayByDate.get(day.date),
        });
    if (content.countable === false || content.off) continue;
    total += 1;
    value += habitStatusPoints(content.status);
  }
  return { value, total, highlight: total > 0 && value === total };
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
      <th className={[styles.rowLabel, styles.stickyCol].join(" ")} scope="row" title={label}>
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
        <span className={cellClass(styles.chevron, expanded && styles.chevronUp)} aria-hidden>
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
      className={[styles.rowLabel, styles.subRowLabel, styles.stickyCol].join(" ")}
      scope="row"
      title={label}
    >
      <span className={styles.subRowIndent} aria-hidden />
      <span className={styles.rowIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.subRowText}>{label}</span>
    </th>
  );
}

function SubRowCellMark({
  content,
  decorative = false,
}: {
  content: SubRowCellContent;
  decorative?: boolean;
}) {
  if (content.off) return <span className={styles.emptyMark}>–</span>;

  if (content.status === "no" || content.status === null) {
    return <StatusMark status={content.status} decorative={decorative} />;
  }

  if (content.detail && (content.status === "yes" || content.status === "half")) {
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
      decorative={decorative}
      exceeded={content.exceeded}
    />
  );
}

function StatusMark({
  status,
  decorative = false,
  exceeded = false,
}: {
  status: HabitStatus | null;
  decorative?: boolean;
  exceeded?: boolean;
}) {
  const resolved = status ?? "empty";
  const crush = Boolean(exceeded && resolved === "yes");
  const label = crush ? "Överträffat" : HABIT_STATUS_LABEL[resolved];
  return (
    <span
      className={cellClass(
        styles.statusMark,
        crush ? styles.statusMark_crush : styles[`statusMark_${resolved}`],
      )}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
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

function cellClass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
