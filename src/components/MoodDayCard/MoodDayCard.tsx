"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMoodDailyLogAction } from "@/app/(app)/mood-actions";
import { Card } from "@/components/Card/Card";
import type { DailyHabit } from "@/lib/habits";
import {
  MOOD_ICON,
  MOOD_LABEL,
  MOOD_OPTIONS,
  type DailyMoodContext,
  type MoodKey,
} from "@/lib/mood";
import styles from "./MoodDayCard.module.scss";

interface Props {
  date: string;
  habit: DailyHabit;
  mood: DailyMoodContext;
}

export function MoodDayCard({ date, habit, mood }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MoodKey | null>(mood.mood);

  useEffect(() => {
    setSelected(mood.mood);
  }, [mood.mood]);

  const pick = (key: MoodKey) => {
    const next = selected === key ? null : key;
    setSelected(next);
    setError(null);

    startTransition(async () => {
      const res = await saveMoodDailyLogAction({
        localDate: date,
        mood: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        setSelected(mood.mood);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card
      className={[
        styles.card,
        habit.status ? styles[`card_${habit.status}`] : "",
        pending ? styles.cardBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <span
            className={styles.icon}
            aria-hidden
            style={{ borderColor: habit.accent }}
          >
            {selected ? MOOD_ICON[selected] : habit.icon}
          </span>
          <div className={styles.titleBlock}>
            <span className={styles.label}>{habit.label}</span>
            <span className={styles.subtitle}>
              {selected
                ? MOOD_LABEL[selected]
                : "Hur kändes dagen?"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.options} role="radiogroup" aria-label={habit.label}>
        {MOOD_OPTIONS.map((option) => {
          const active = selected === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={option.label}
              className={[styles.option, active ? styles.optionActive : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => pick(option.key)}
              disabled={pending}
            >
              <span className={styles.optionIcon} aria-hidden>
                {option.icon}
              </span>
              <span className={styles.optionLabel}>{option.label}</span>
            </button>
          );
        })}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
