"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/Input/Input";
import { DRINK_NOTE_MAX, FOOD_RATING_MAX, FOOD_RATING_MIN } from "@/lib/meal-log";
import styles from "./MealLogExtras.module.scss";

const WATER_PRESETS = [200, 330, 500];
const RATING_OPTIONS = Array.from(
  { length: FOOD_RATING_MAX - FOOD_RATING_MIN + 1 },
  (_, i) => FOOD_RATING_MIN + i,
);

interface MealLogExtrasProps {
  waterMl: string;
  drinkNote: string;
  rating: string;
  disabled?: boolean;
  /** Remount-style reset when the logged meal or day changes. */
  resetKey: string;
  onWaterMl: (value: string) => void;
  onDrinkNote: (value: string) => void;
  onRating: (value: string) => void;
}

export function MealLogExtras({
  waterMl,
  drinkNote,
  rating,
  disabled = false,
  resetKey,
  onWaterMl,
  onDrinkNote,
  onRating,
}: MealLogExtrasProps) {
  const [drinkOpen, setDrinkOpen] = useState(
    () => waterMl.trim() !== "" || drinkNote.trim() !== "",
  );
  const [ratingOpen, setRatingOpen] = useState(() => rating !== "");

  useEffect(() => {
    setDrinkOpen(waterMl.trim() !== "" || drinkNote.trim() !== "");
    setRatingOpen(rating !== "");
    // Only reopen when switching entry. Typing should not collapse the section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return (
    <div className={styles.extras}>
      <section className={styles.extra}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={drinkOpen}
          onClick={() => setDrinkOpen((open) => !open)}
          disabled={disabled}
        >
          <span>Drack du något?</span>
          <span className={styles.chevron} aria-hidden>
            {drinkOpen ? "▴" : "▾"}
          </span>
        </button>
        {drinkOpen ? (
          <div className={styles.body}>
            <div className={styles.waterRow}>
              <Input
                label="Mängd"
                type="number"
                min={0}
                max={5000}
                step={50}
                inputMode="numeric"
                value={waterMl}
                onChange={(e) => onWaterMl(e.target.value)}
                placeholder="0"
                suffix="ml"
                disabled={disabled}
              />
              <div className={styles.presets}>
                {WATER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={styles.preset}
                    aria-pressed={Number(waterMl) === preset}
                    onClick={() => onWaterMl(String(preset))}
                    disabled={disabled}
                  >
                    {preset}
                  </button>
                ))}
                {waterMl ? (
                  <button
                    type="button"
                    className={[styles.preset, styles.clear].join(" ")}
                    onClick={() => onWaterMl("")}
                    aria-label="Rensa mängd"
                    disabled={disabled}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
            <Input
              label="Vad drack du?"
              value={drinkNote}
              onChange={(e) => onDrinkNote(e.target.value)}
              placeholder="t.ex. vatten, kaffe, juice"
              maxLength={DRINK_NOTE_MAX}
              disabled={disabled}
            />
            <p className={styles.hint}>
              Valfritt. Mängden hamnar i drycklistan och räknas mot dagens vatten.
            </p>
          </div>
        ) : null}
      </section>

      <section className={styles.extra}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={ratingOpen}
          onClick={() => setRatingOpen((open) => !open)}
          disabled={disabled}
        >
          <span>Betyg på maten</span>
          <span className={styles.chevron} aria-hidden>
            {ratingOpen ? "▴" : "▾"}
          </span>
        </button>
        {ratingOpen ? (
          <div className={styles.body}>
            <label className={styles.ratingField}>
              <span className={styles.ratingLabel}>Betyg</span>
              <select
                className={styles.ratingSelect}
                value={rating}
                onChange={(e) => onRating(e.target.value)}
                disabled={disabled}
              >
                <option value="">Inget betyg</option>
                {RATING_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}/10
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.hint}>Valfritt. Du behöver inte betygsätta.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
