"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { eatMealBoxAction } from "@/app/(app)/actions";
import {
  MEAL_ICON,
  MEAL_ORDER,
  mealCookedByDisplay,
  type MealKey,
} from "@/lib/habits";
import type { WeekMealsSummary } from "@/lib/meal-box.server";
import { formatDayShort, isoWeekdayFromLocalISO } from "@/lib/date";
import { WEEKDAY_SHORT, type Weekday } from "@/lib/tasks";
import styles from "./week-meals.module.scss";

const MEAL_LABEL_SV: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
};

interface Props {
  summary: WeekMealsSummary;
}

export function WeekMealsBoard({ summary }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState<{ date: string; meal: MealKey } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const stockTotal = summary.stock.reduce((sum, s) => sum + s.remaining, 0);

  const eatBox = (date: string, meal: MealKey, stockId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await eatMealBoxAction({ localDate: date, meal, stockId });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte logga matlådan.");
        return;
      }
      setPicker(null);
      router.refresh();
    });
  };

  return (
    <section className={styles.section} aria-labelledby="week-meals-heading">
      <header className={styles.header}>
        <div>
          <h2 id="week-meals-heading" className={styles.title}>
            Mat & matlådor
          </h2>
          <p className={styles.subtitle}>
            Vad du ätit varje dag — och kvarvarande matlådor i kylen.
          </p>
        </div>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <strong>{summary.boxesProducedWeek}</strong>
            <span>matlådor tillagade denna vecka</span>
          </span>
          <span className={styles.stat}>
            <strong>{stockTotal}</strong>
            <span>kvar totalt</span>
          </span>
        </div>
      </header>

      {summary.stock.length > 0 ? (
        <div className={styles.stockBar} aria-label="Matlådor i kylen">
          {summary.stock.map((item) => (
            <span key={item.id} className={styles.stockChip}>
              <span className={styles.stockName}>{item.description}</span>
              <span className={styles.stockCount}>{item.remaining}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.stockEmpty}>
          Inga matlådor just nu. Logga matlagning med antal matlådor under{" "}
          <Link href={`/day/${summary.days.find((d) => !d.isFuture)?.date ?? summary.days[0]?.date}`}>
            dagens plan
          </Link>
          .
        </p>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.gridWrap}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.cornerCell} scope="col">
                Måltid
              </th>
              {summary.days.map((day) => {
                const wd = isoWeekdayFromLocalISO(day.date) as Weekday;
                return (
                  <th
                    key={day.date}
                    className={[
                      styles.dayHead,
                      day.isToday ? styles.dayHeadToday : "",
                      day.isFuture ? styles.dayHeadFuture : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    scope="col"
                  >
                    <span className={styles.dayWeekday}>{WEEKDAY_SHORT[wd]}</span>
                    <span className={styles.dayDate}>{formatDayShort(day.date)}</span>
                    {day.boxesProduced > 0 ? (
                      <span className={styles.dayBoxesMade}>
                        +{day.boxesProduced} matlåd{day.boxesProduced === 1 ? "a" : "or"}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {MEAL_ORDER.map((mealKey) => (
              <tr key={mealKey}>
                <th className={styles.mealLabel} scope="row">
                  <span aria-hidden>{MEAL_ICON[mealKey]}</span>
                  {MEAL_LABEL_SV[mealKey]}
                </th>
                {summary.days.map((day) => {
                  const entry = day.meals[mealKey];
                  const isPickerOpen =
                    picker?.date === day.date && picker?.meal === mealKey;

                  return (
                    <td
                      key={`${day.date}-${mealKey}`}
                      className={[
                        styles.cell,
                        day.isToday ? styles.cellToday : "",
                        day.isFuture ? styles.cellFuture : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {entry ? (
                        <MealCell entry={entry} date={day.date} />
                      ) : day.isFuture ? (
                        <span className={styles.cellEmpty}>—</span>
                      ) : (
                        <div className={styles.cellActions}>
                          <Link
                            href={`/day/${day.date}`}
                            className={styles.logLink}
                          >
                            Logga
                          </Link>
                          {summary.stock.length > 0 ? (
                            <>
                              <button
                                type="button"
                                className={styles.boxBtn}
                                disabled={pending}
                                aria-expanded={isPickerOpen}
                                onClick={() =>
                                  setPicker(
                                    isPickerOpen
                                      ? null
                                      : { date: day.date, meal: mealKey },
                                  )
                                }
                              >
                                Ät matlåda
                              </button>
                              {isPickerOpen ? (
                                <ul className={styles.pickerList}>
                                  {summary.stock.map((item) => (
                                    <li key={item.id}>
                                      <button
                                        type="button"
                                        className={styles.pickerBtn}
                                        disabled={pending}
                                        onClick={() =>
                                          eatBox(day.date, mealKey, item.id)
                                        }
                                      >
                                        {item.description}
                                        <span className={styles.pickerCount}>
                                          {item.remaining} kvar
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MealCell({
  entry,
  date,
}: {
  entry: NonNullable<WeekMealsSummary["days"][number]["meals"][MealKey]>;
  date: string;
}) {
  const cookedLabel = mealCookedByDisplay(
    entry.cookedBy,
    entry.restaurantName,
    entry.cookedByName,
  );

  return (
    <div className={styles.mealCell}>
      <Link href={`/day/${date}`} className={styles.mealDesc}>
        {entry.description}
      </Link>
      <div className={styles.mealMeta}>
        {entry.fromMealBox ? (
          <span className={styles.badgeBox}>Matlåda</span>
        ) : null}
        {!entry.fromMealBox && (entry.mealBoxes ?? 0) > 0 ? (
          <span className={styles.badgeMade}>
            +{entry.mealBoxes} matlåd{(entry.mealBoxes ?? 0) === 1 ? "a" : "or"}
          </span>
        ) : null}
        {cookedLabel ? (
          <span className={styles.cookedBy}>{cookedLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
