"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHabitStatusAction } from "@/app/(app)/actions";
import { useSyncNavPending } from "@/components/NavProgress/NavProgress";
import {
  groupByCategory,
  type TaskCategory,
} from "@/lib/tasks";
import {
  type DailyHabit,
  type HabitStatus,
  nextHabitStatus,
} from "@/lib/habits";
import styles from "./HabitChecks.module.scss";

interface Props {
  date: string;
  /** Pre-fetched habits for the date. Water-kind habits are auto-filtered out. */
  habits: DailyHabit[];
  categories?: TaskCategory[];
}

const CHOICES: { value: HabitStatus; label: string; sr: string }[] = [
  { value: "yes", label: "Yes", sr: "Yes" },
  { value: "half", label: "½", sr: "Half" },
  { value: "no", label: "No", sr: "No" },
];

export function HabitChecks({ date, habits, categories = [] }: Props) {
  const router = useRouter();
  const triState = habits.filter((h) => h.kind === "tri_state");

  const [statuses, setStatuses] = useState<Record<string, HabitStatus | null>>(
    () => Object.fromEntries(triState.map((h) => [h.id, h.status])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useSyncNavPending(pendingId != null, habits);

  if (triState.length === 0) {
    return (
      <p className={styles.empty}>
        No habits yet. Add some from your profile.
      </p>
    );
  }

  const toggle = (habitId: string, pressed: HabitStatus) => {
    const current = statuses[habitId] ?? null;
    const next = nextHabitStatus(current, pressed);
    setStatuses((s) => ({ ...s, [habitId]: next }));
    setPendingId(habitId);
    setError(null);
    startTransition(async () => {
      const res = await setHabitStatusAction({
        habitId,
        localDate: date,
        status: next,
      });
      if (!res.ok) {
        setStatuses((s) => ({ ...s, [habitId]: current }));
        setError(res.error ?? "Could not save.");
      }
      setPendingId(null);
      router.refresh();
    });
  };

  const grouped = groupByCategory(triState, categories);

  return (
    <div className={styles.wrap}>
      {grouped.map(({ category, items }) => (
        <section
          key={category?.id ?? "uncategorized"}
          className={styles.group}
        >
          {category ? (
            <header className={styles.groupHeader}>
              <span
                className={styles.groupChip}
                style={{ borderColor: category.accent, color: category.accent }}
              >
                <span className={styles.groupIcon} aria-hidden>
                  {category.icon}
                </span>
                {category.name}
              </span>
            </header>
          ) : null}
          <ul className={styles.list}>
            {items.map((h) => {
              const status = statuses[h.id] ?? null;
              const busy = pendingId === h.id;
              return (
                <li
                  key={h.id}
                  className={[
                    styles.row,
                    status ? styles[`row_${status}`] : "",
                    busy ? styles.busy : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className={styles.identity}>
                    <span
                      className={styles.icon}
                      aria-hidden
                      style={{ borderColor: h.accent }}
                    >
                      {h.icon}
                    </span>
                    <span className={styles.label}>{h.label}</span>
                  </div>
                  <div
                    className={styles.choices}
                    role="radiogroup"
                    aria-label={h.label}
                  >
                    {CHOICES.map((c) => {
                      const active = status === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={c.sr}
                          onClick={() => toggle(h.id, c.value)}
                          disabled={busy}
                          className={[
                            styles.choice,
                            styles[`choice_${c.value}`],
                            active ? styles.choiceActive : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span aria-hidden>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
