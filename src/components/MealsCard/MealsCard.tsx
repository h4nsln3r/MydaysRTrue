"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  MEAL_ICON,
  MEAL_LABEL,
  MEAL_ORDER,
  type MealEntry,
  type MealKey,
} from "@/lib/habits";
import { formatMl } from "@/lib/water";
import { clearMealAction, saveMealAction } from "@/app/(app)/actions";
import styles from "./MealsCard.module.scss";

interface Props {
  date: string;
  meals: Record<MealKey, MealEntry | null>;
}

const WATER_PRESETS = [200, 330, 500];

export function MealsCard({ date, meals }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<MealKey | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingClear, setConfirmingClear] = useState<MealKey | null>(null);

  const close = () => setEditing(null);

  const onSaved = () => {
    close();
    router.refresh();
  };

  const clear = (meal: MealKey) => {
    startTransition(async () => {
      const res = await clearMealAction({ meal, localDate: date });
      if (res.ok) {
        setConfirmingClear(null);
        router.refresh();
      }
    });
  };

  const logged = MEAL_ORDER.filter((k) => meals[k]).length;

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Meals</h2>
          <span
            className={[
              styles.counter,
              logged === 3 ? styles.counterDone : "",
              logged > 0 && logged < 3 ? styles.counterPartial : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.counterBig}>{logged}</span>
            <span className={styles.counterSlash}>/ 3</span>
          </span>
        </div>
        <p className={styles.subtitle}>Tap each meal and tell us what you had.</p>
      </header>

      <ul className={styles.list}>
        {MEAL_ORDER.map((meal) => {
          const entry = meals[meal];
          const isEditing = editing === meal;
          const isConfirming = confirmingClear === meal;
          return (
            <li key={meal} className={styles.item}>
              {isEditing ? (
                <MealForm
                  meal={meal}
                  date={date}
                  initial={entry}
                  onCancel={close}
                  onSaved={onSaved}
                />
              ) : entry ? (
                <button
                  type="button"
                  className={[styles.row, styles.rowDone].join(" ")}
                  onClick={() => setEditing(meal)}
                  aria-label={`Edit ${MEAL_LABEL[meal]}`}
                  disabled={pending}
                >
                  <span
                    className={styles.iconBox}
                    aria-hidden
                    data-state="done"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M5 12.5 10 17.5 19 7.5"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className={styles.mealText}>
                    <span className={styles.mealLabel}>
                      <span className={styles.mealIcon} aria-hidden>
                        {MEAL_ICON[meal]}
                      </span>
                      {MEAL_LABEL[meal]}
                    </span>
                    <span className={styles.description}>{entry.description}</span>
                  </span>
                  {entry.waterMl > 0 ? (
                    <span className={styles.waterBadge} aria-label="With water">
                      💧 {formatMl(entry.waterMl)}
                    </span>
                  ) : null}
                  <span
                    className={styles.clearWrap}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {isConfirming ? (
                      <span className={styles.confirmRow}>
                        <button
                          type="button"
                          className={styles.confirmYes}
                          onClick={(e) => {
                            e.stopPropagation();
                            clear(meal);
                          }}
                          disabled={pending}
                          aria-label="Confirm clear"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className={styles.confirmNo}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingClear(null);
                          }}
                          disabled={pending}
                          aria-label="Cancel"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingClear(meal);
                        }}
                        aria-label={`Remove ${MEAL_LABEL[meal]}`}
                        disabled={pending}
                      >
                        ×
                      </button>
                    )}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className={[styles.row, styles.rowEmpty].join(" ")}
                  onClick={() => setEditing(meal)}
                  aria-label={`Log ${MEAL_LABEL[meal]}`}
                  disabled={pending}
                >
                  <span className={styles.iconBox} aria-hidden data-state="empty" />
                  <span className={styles.mealText}>
                    <span className={styles.mealLabel}>
                      <span className={styles.mealIcon} aria-hidden>
                        {MEAL_ICON[meal]}
                      </span>
                      {MEAL_LABEL[meal]}
                    </span>
                    <span className={styles.mealHint}>Tap to log</span>
                  </span>
                  <span className={styles.plus} aria-hidden>
                    +
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ============================================================================
// Inline meal form
// ============================================================================

interface MealFormProps {
  meal: MealKey;
  date: string;
  initial: MealEntry | null;
  onCancel: () => void;
  onSaved: () => void;
}

function MealForm({ meal, date, initial, onCancel, onSaved }: MealFormProps) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [waterMl, setWaterMl] = useState<string>(
    initial?.waterMl ? String(initial.waterMl) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedWater = waterMl.trim() === "" ? 0 : Number(waterMl);
    if (!Number.isFinite(parsedWater) || parsedWater < 0) {
      setError("Water must be a positive number.");
      return;
    }

    startTransition(async () => {
      const res = await saveMealAction({
        meal,
        localDate: date,
        description,
        waterMl: Math.round(parsedWater),
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save meal.");
        return;
      }
      onSaved();
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formHead}>
        <span className={styles.formTitle}>
          <span className={styles.mealIcon} aria-hidden>
            {MEAL_ICON[meal]}
          </span>
          {MEAL_LABEL[meal]}
        </span>
        <button
          type="button"
          className={styles.formClose}
          onClick={onCancel}
          aria-label="Cancel"
          disabled={pending}
        >
          ×
        </button>
      </div>

      <Input
        label="What did you eat?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. Yoghurt, banana, two slices of toast"
        maxLength={280}
        autoFocus
        required
      />

      <div className={styles.waterBlock}>
        <span className={styles.label}>Water with this meal</span>
        <div className={styles.waterRow}>
          <Input
            type="number"
            min={0}
            max={5000}
            step={50}
            inputMode="numeric"
            value={waterMl}
            onChange={(e) => setWaterMl(e.target.value)}
            placeholder="0"
            suffix="ml"
          />
          <div className={styles.waterPresets}>
            {WATER_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={styles.waterPreset}
                aria-pressed={Number(waterMl) === p}
                onClick={() => setWaterMl(String(p))}
              >
                {p}
              </button>
            ))}
            {waterMl ? (
              <button
                type="button"
                className={[styles.waterPreset, styles.waterClear].join(" ")}
                onClick={() => setWaterMl("")}
                aria-label="Clear water"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
        <p className={styles.hint}>
          Added to your water log with a note.
        </p>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.formActions}>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="md" loading={pending}>
          {initial ? "Save" : "Mark eaten"}
        </Button>
      </div>
    </form>
  );
}
