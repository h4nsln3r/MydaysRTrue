"use client";

import { useTransition, useState } from "react";
import { QUICK_ADDS } from "@/lib/water";
import { todayLocalISO } from "@/lib/date";
import { logWaterAction } from "./actions";
import styles from "./dashboard.module.scss";

interface QuickAddRowProps {
  /** Calendar day to log water on (defaults to today). */
  localDate?: string;
}

export function QuickAddRow({ localDate = todayLocalISO() }: QuickAddRowProps) {
  const [pending, startTransition] = useTransition();
  const [activeMl, setActiveMl] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onAdd = (ml: number) => {
    setError(null);
    setActiveMl(ml);
    startTransition(async () => {
      const res = await logWaterAction({ amountMl: ml, localDate });
      if (!res.ok) setError(res.error ?? "Could not log.");
      setActiveMl(null);
    });
  };

  return (
    <div>
      <div className={styles.quickRow} role="group" aria-label="Quick add water">
        {QUICK_ADDS.map((q) => (
          <button
            key={q.ml}
            type="button"
            className={styles.quickBtn}
            onClick={() => onAdd(q.ml)}
            disabled={pending}
            aria-busy={pending && activeMl === q.ml}
          >
            <span className={styles.quickIcon} aria-hidden>
              {q.icon}
            </span>
            <span className={styles.quickAmount}>{q.ml} ml</span>
            <span className={styles.quickLabel}>{q.label}</span>
          </button>
        ))}
      </div>
      {error ? <p className={styles.inlineError}>{error}</p> : null}
    </div>
  );
}
