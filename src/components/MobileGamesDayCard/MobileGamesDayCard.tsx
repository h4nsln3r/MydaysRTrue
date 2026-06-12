"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMobileGamesDailyLogAction } from "@/app/(app)/mobile-games-actions";
import { Card } from "@/components/Card/Card";
import type { DailyHabit } from "@/lib/habits";
import {
  MOBILE_GAME_STEPS,
  mobileGamesDoneCount,
  type DailyMobileGamesContext,
  type MobileGameKey,
} from "@/lib/mobile-games";
import styles from "./MobileGamesDayCard.module.scss";

interface Props {
  date: string;
  habit: DailyHabit;
  games: DailyMobileGamesContext;
}

function valueForKey(ctx: DailyMobileGamesContext, key: MobileGameKey): boolean {
  if (key === "chess") return ctx.chess;
  if (key === "duolingo") return ctx.duolingo;
  return ctx.pokemonGo;
}

function patchContext(
  ctx: DailyMobileGamesContext,
  key: MobileGameKey,
  value: boolean,
): DailyMobileGamesContext {
  if (key === "chess") return { ...ctx, chess: value, hasLog: true };
  if (key === "duolingo") return { ...ctx, duolingo: value, hasLog: true };
  return { ...ctx, pokemonGo: value, hasLog: true };
}

export function MobileGamesDayCard({ date, habit, games }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(games);

  useEffect(() => {
    setLocal(games);
  }, [games]);

  const doneCount = mobileGamesDoneCount(local);

  const toggle = (key: MobileGameKey) => {
    const next = patchContext(local, key, !valueForKey(local, key));
    setLocal(next);
    setError(null);

    startTransition(async () => {
      const res = await saveMobileGamesDailyLogAction({
        localDate: date,
        chess: next.chess,
        duolingo: next.duolingo,
        pokemonGo: next.pokemonGo,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        setLocal(games);
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
            {habit.icon}
          </span>
          <span className={styles.label}>{habit.label}</span>
        </div>
        <span className={styles.counter}>
          <span className={styles.counterBig}>{doneCount}</span>
          <span> / {MOBILE_GAME_STEPS.length}</span>
        </span>
      </div>

      <div className={styles.steps}>
        {MOBILE_GAME_STEPS.map((step) => {
          const done = valueForKey(local, step.key);
          return (
            <button
              key={step.key}
              type="button"
              className={[styles.step, done ? styles.stepDone : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => toggle(step.key)}
              disabled={pending}
              aria-pressed={done}
            >
              <span className={styles.stepIcon} aria-hidden>
                {step.icon}
              </span>
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepCheck} aria-hidden>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12.5 10 17.5 19 7.5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
