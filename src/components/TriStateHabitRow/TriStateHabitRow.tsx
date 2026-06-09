"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHabitStatusAction } from "@/app/(app)/actions";
import { Card } from "@/components/Card/Card";
import {
  type DailyHabit,
  type HabitStatus,
  nextHabitStatus,
} from "@/lib/habits";
import styles from "./TriStateHabitRow.module.scss";

const CHOICES: { value: HabitStatus; label: string }[] = [
  { value: "yes", label: "Ja" },
  { value: "half", label: "½" },
  { value: "no", label: "Nej" },
];

interface Props {
  date: string;
  habit: DailyHabit;
}

export function TriStateHabitRow({ date, habit }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<HabitStatus | null>(habit.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (pressed: HabitStatus) => {
    const prev = status;
    const next = nextHabitStatus(status, pressed);
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const res = await setHabitStatusAction({
        habitId: habit.id,
        localDate: date,
        status: next,
      });
      if (!res.ok) {
        setStatus(prev);
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card
      className={[
        styles.card,
        status ? styles[`card_${status}`] : "",
        pending ? styles.cardBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.row}>
        <div className={styles.identity}>
          <span
            className={styles.icon}
            aria-hidden
            style={{ borderColor: habit.accent }}
          >
            {habit.icon}
          </span>
          <span className={styles.label}>{habit.label}</span>
        </div>
        <div className={styles.choices} role="radiogroup" aria-label={habit.label}>
          {CHOICES.map((c) => {
            const active = status === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => toggle(c.value)}
                disabled={pending}
                className={[
                  styles.choice,
                  styles[`choice_${c.value}`],
                  active ? styles.choiceActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
