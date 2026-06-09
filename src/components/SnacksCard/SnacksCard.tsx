"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSnackAction } from "@/app/(app)/actions";
import { Card } from "@/components/Card/Card";
import { SNACK_LABEL, SNACK_SLOTS, type DailySnacks } from "@/lib/habits";
import styles from "./SnacksCard.module.scss";

interface Props {
  date: string;
  snacks: DailySnacks;
}

export function SnacksCard({ date, snacks }: Props) {
  const router = useRouter();
  const [local, setLocal] = useState(snacks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(snacks);
  }, [snacks]);

  const done = (local.slot1 ? 1 : 0) + (local.slot2 ? 1 : 0);

  const toggle = (slot: 1 | 2, next: boolean) => {
    setError(null);
    const prev = local;
    setLocal({
      ...local,
      [slot === 1 ? "slot1" : "slot2"]: next,
    });
    startTransition(async () => {
      const res = await toggleSnackAction({ localDate: date, slot, checked: next });
      if (!res.ok) {
        setLocal(prev);
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>Mellanmål</h2>
        <span
          className={[
            styles.counter,
            done === 2 ? styles.counterDone : "",
            done === 1 ? styles.counterPartial : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {done}/2
        </span>
      </header>

      <ul className={styles.list}>
        {SNACK_SLOTS.map((slot) => {
          const checked = slot === 1 ? local.slot1 : local.slot2;
          return (
            <li key={slot}>
              <button
                type="button"
                className={[
                  styles.row,
                  checked ? styles.rowDone : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => toggle(slot, !checked)}
                disabled={pending}
                aria-pressed={checked}
              >
                <span
                  className={[styles.check, checked ? styles.checkDone : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                >
                  {checked ? "✓" : ""}
                </span>
                <span className={styles.label}>{SNACK_LABEL[slot]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
