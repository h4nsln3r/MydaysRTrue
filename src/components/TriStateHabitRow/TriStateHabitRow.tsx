"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHabitStatusAction } from "@/app/(app)/actions";
import { Card } from "@/components/Card/Card";
import { StreakFold, StreakStat } from "@/components/StreakFold/StreakFold";
import { todayLocalISO } from "@/lib/date";
import {
  type DailyHabit,
  type HabitStatus,
  nextHabitStatus,
} from "@/lib/habits";
import { smokeFreeStreakCount } from "@/lib/smoke-free";
import styles from "./TriStateHabitRow.module.scss";

const CHOICES: { value: HabitStatus; label: string }[] = [
  { value: "yes", label: "Ja" },
  { value: "half", label: "½" },
  { value: "no", label: "Nej" },
];

interface Props {
  date: string;
  habit: DailyHabit;
  /** Days of Ja before `date`. Only Sockerfri uses this. */
  streakBefore?: number;
}

export function TriStateHabitRow({ date, habit, streakBefore }: Props) {
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
      {habit.key === "sugar_free" && streakBefore != null ? (
        <div className={styles.streak}>
          <StreakFold label="Sockerfria dagar i rad">
            <SugarStreak countBefore={streakBefore} status={status} date={date} />
          </StreakFold>
        </div>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}

function SugarStreak({
  countBefore,
  status,
  date,
}: {
  countBefore: number;
  status: HabitStatus | null;
  date: string;
}) {
  const count = smokeFreeStreakCount(countBefore, status, date === todayLocalISO());
  const unit = count === 1 ? "sockerfri dag" : "sockerfria dagar";
  return <StreakStat icon="🍭" count={count} label={`${count} ${unit} i rad`} />;
}
