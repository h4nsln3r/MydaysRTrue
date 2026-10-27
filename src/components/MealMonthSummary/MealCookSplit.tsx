"use client";

import { useRef, useState } from "react";
import { formatDayShort } from "@/lib/date";
import type { MealKey } from "@/lib/habits";
import { loadMealMonthSlice } from "@/app/(app)/meal-month-actions";
import type {
  MealBoxMade,
  MealCookSlice,
  MealCookSliceKey,
  MealSliceEntry,
} from "@/lib/meal-month-summary";
import styles from "./MealMonthSummary.module.scss";

const SLICE_CLASS: Record<MealCookSliceKey, string> = {
  self: styles.self,
  julia: styles.julia,
  restaurant: styles.restaurant,
  meal_box: styles.mealBox,
  bought: styles.bought,
  other: styles.other,
};

const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: "frukost",
  lunch: "lunch",
  dinner: "middag",
};

interface Props {
  monthStart: string;
  cook: MealCookSlice[];
}

interface LoadedSlice {
  meals: MealSliceEntry[];
  made: MealBoxMade[];
}

export function MealCookSplit({ monthStart, cook }: Props) {
  const [open, setOpen] = useState<MealCookSliceKey | null>(null);
  const [cache, setCache] = useState<
    Partial<Record<MealCookSliceKey, LoadedSlice>>
  >({});
  const [loading, setLoading] = useState<MealCookSliceKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  async function toggle(key: MealCookSliceKey) {
    if (open === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    setError(null);
    if (cache[key]) return;

    const id = ++request.current;
    setLoading(key);
    const result = await loadMealMonthSlice(monthStart, key);
    if (request.current !== id) return;
    setLoading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCache((prev) => ({
      ...prev,
      [key]: { meals: result.meals, made: result.made },
    }));
  }

  const openSlice = cook.find((slice) => slice.key === open) ?? null;
  const loaded = open ? cache[open] : undefined;
  const meals = loaded?.meals;
  const made = loaded?.made ?? [];

  return (
    <div className={styles.cook}>
      <p className={styles.cookLabel}>Lunch och middag</p>
      <div className={styles.bar} aria-hidden="true">
        {cook.map((slice) => (
          <button
            key={slice.key}
            type="button"
            tabIndex={-1}
            className={[
              styles.seg,
              SLICE_CLASS[slice.key],
              open === slice.key ? styles.segOpen : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ flexGrow: slice.count }}
            onClick={() => toggle(slice.key)}
          />
        ))}
      </div>
      <ul className={styles.legend}>
        {cook.map((slice) => {
          const expanded = open === slice.key;
          return (
            <li key={slice.key}>
              <button
                type="button"
                className={[
                  styles.legendButton,
                  expanded ? styles.legendButtonOpen : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={expanded}
                aria-controls={expanded ? "meal-slice-list" : undefined}
                onClick={() => toggle(slice.key)}
              >
                <span
                  className={[styles.swatch, SLICE_CLASS[slice.key]].join(" ")}
                  aria-hidden="true"
                />
                {slice.label} {slice.count}
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {openSlice ? (
        <div id="meal-slice-list" className={styles.detail}>
          {loading === openSlice.key ? (
            <p className={styles.detailStatus}>Hämtar…</p>
          ) : error && !meals ? (
            <p className={styles.detailStatus}>{error}</p>
          ) : meals ? (
            <>
              {openSlice.key === "meal_box" && made.length > 0 ? (
                <MadeBoxes made={made} />
              ) : null}
              {meals.length > 0 ? (
                <>
                  {openSlice.key === "meal_box" && made.length > 0 ? (
                    <p className={styles.detailHeading}>Uppätna</p>
                  ) : null}
                  <ul className={styles.detailList}>
                    {meals.map((meal) => (
                      <li
                        key={`${meal.date}-${meal.meal}`}
                        className={styles.detailItem}
                      >
                        <p className={styles.detailWhen}>
                          {formatDayShort(meal.date)} · {MEAL_LABEL[meal.meal]}
                          {meal.rating != null ? ` · ${meal.rating}/10` : ""}
                        </p>
                        {meal.description ? (
                          <p className={styles.detailWhat}>{meal.description}</p>
                        ) : null}
                        {meal.detail ? (
                          <p className={styles.detailPlace}>{meal.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : openSlice.key === "meal_box" && made.length > 0 ? null : (
                <p className={styles.detailStatus}>Inget den här månaden.</p>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MadeBoxes({ made }: { made: MealBoxMade[] }) {
  return (
    <>
      <p className={styles.detailHeading}>Lagade</p>
      <ul className={styles.detailList}>
        {made.map((item) => (
          <li
            key={`${item.cook}-${item.description}`}
            className={styles.detailItem}
          >
            <p className={styles.detailWhen}>
              {item.cook} · {item.count === 1 ? "1 matlåda" : `${item.count} matlådor`}
            </p>
            <p className={styles.detailWhat}>{item.description}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
