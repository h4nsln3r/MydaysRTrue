"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MealForm } from "@/components/MealsCard/MealForm";
import { MEAL_LABEL, type MealEntry, type MealKey, type MealRestaurant } from "@/lib/habits";
import type { MealBoxStockItem } from "@/lib/meal-box.server";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import styles from "./week-meal-modal.module.scss";

interface Props {
  date: string;
  meal: MealKey;
  initial: MealEntry | null;
  savedRestaurants: MealRestaurant[];
  mealBoxStock: MealBoxStockItem[];
  onClose: () => void;
}

export function WeekMealLogDialog({
  date,
  meal,
  initial,
  savedRestaurants,
  mealBoxStock,
  onClose,
}: Props) {
  const router = useRouter();
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const onSaved = () => {
    close();
    router.refresh();
  };

  const title = `${formatWeekdayShort(date)} ${formatDayShort(date)}`;

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-meal-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>{MEAL_LABEL[meal]}</p>
            <h2 id="week-meal-modal-title" className={styles.title}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <MealForm
            meal={meal}
            date={date}
            initial={initial}
            savedRestaurants={savedRestaurants}
            mealBoxStock={mealBoxStock}
            onCancel={close}
            onSaved={onSaved}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
