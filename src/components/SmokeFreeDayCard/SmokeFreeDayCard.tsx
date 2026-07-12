"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSmokeFreeDailyLogAction } from "@/app/(app)/smoke-free-actions";
import { Card } from "@/components/Card/Card";
import {
  type DailyHabit,
  type HabitStatus,
  nextHabitStatus,
} from "@/lib/habits";
import {
  SMOKE_FREE_SUBSTANCES,
  smokeFreeStatusFor,
  smokeFreeValueFor,
  smokeFreeYesCount,
  type DailySmokeFreeContext,
  type SmokeFreeSubstance,
} from "@/lib/smoke-free";
import styles from "./SmokeFreeDayCard.module.scss";

const CHOICES: { value: HabitStatus; label: string }[] = [
  { value: "yes", label: "Ja" },
  { value: "half", label: "½" },
  { value: "no", label: "Nej" },
];

interface Props {
  date: string;
  habit: DailyHabit;
  smokeFree: DailySmokeFreeContext;
}

export function SmokeFreeDayCard({ date, habit, smokeFree }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(smokeFree);

  useEffect(() => {
    setLocal(smokeFree);
  }, [smokeFree]);

  const aggregateStatus = smokeFreeStatusFor(local, false);
  const yesCount = smokeFreeYesCount(local);

  const toggle = (substance: SmokeFreeSubstance, pressed: HabitStatus) => {
    const current = smokeFreeValueFor(local, substance);
    const next = nextHabitStatus(current, pressed);
    const nextCtx: DailySmokeFreeContext = {
      ...local,
      hasLog: true,
      [substance]: next,
    };
    if (next === null && smokeFreeValueFor(nextCtx, substance === "nicotine" ? "cannabis" : "nicotine") === null) {
      nextCtx.hasLog = false;
    }
    setLocal(nextCtx);
    setError(null);

    startTransition(async () => {
      const res = await saveSmokeFreeDailyLogAction({
        localDate: date,
        substance,
        status: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        setLocal(smokeFree);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card
      className={[
        styles.card,
        aggregateStatus ? styles[`card_${aggregateStatus}`] : "",
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
            {habit.icon}
          </span>
          <span className={styles.label}>{habit.label}</span>
        </div>
        <span className={styles.counter}>
          <span className={styles.counterBig}>{yesCount}</span>
          <span> / {SMOKE_FREE_SUBSTANCES.length}</span>
        </span>
      </div>

      <div className={styles.rows}>
        {SMOKE_FREE_SUBSTANCES.map((substance) => {
          const status = smokeFreeValueFor(local, substance.key);
          return (
            <div
              key={substance.key}
              className={[
                styles.subRow,
                status ? styles[`subRow_${status}`] : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.subIdentity}>
                <span className={styles.subIcon} aria-hidden>
                  {substance.icon}
                </span>
                <span className={styles.subLabel}>{substance.label}</span>
              </div>
              <div
                className={styles.choices}
                role="radiogroup"
                aria-label={`${habit.label} — ${substance.label}`}
              >
                {CHOICES.map((choice) => {
                  const active = status === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => toggle(substance.key, choice.value)}
                      disabled={pending}
                      className={[
                        styles.choice,
                        styles[`choice_${choice.value}`],
                        active ? styles.choiceActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
