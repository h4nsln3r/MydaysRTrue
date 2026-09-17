"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteMonthlyTaskInstanceAction,
  scheduleMonthlyTaskInstanceDayAction,
} from "@/app/(app)/tasks-actions";
import { isMonthlyTaskComplete } from "@/lib/monthly-bills";
import {
  formatFestOccasionWhen,
  monthlyTaskCompletions,
  type MonthlyTaskForMonth,
  type TaskCategory,
} from "@/lib/tasks";
import styles from "./month-progress.module.scss";

function cellClass(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

interface Props {
  task: MonthlyTaskForMonth;
  category: TaskCategory | null;
  monthStart: string;
}

export function FestProgressCard({ task, category, monthStart }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const occasions = monthlyTaskCompletions(task).filter(
    (c) =>
      c.isInstance ||
      (!c.isUnscheduled &&
        (c.scheduledDayOfMonth != null || c.doneAt != null)),
  );
  const status =
    occasions.length === 0
      ? "unplaced"
      : occasions.every((c) => isMonthlyTaskComplete(task, c))
        ? "done"
        : "planned";
  const planHref = `/month?m=${monthStart.slice(0, 7)}&view=plan`;

  const placeOnDay = (completionId: string, dayOfMonth: number) => {
    setError(null);
    startTransition(async () => {
      const res = await scheduleMonthlyTaskInstanceDayAction({
        completionId,
        monthStart,
        dayOfMonth,
      });
      if (!res.ok) setError(res.error ?? "Kunde inte placera festen.");
      router.refresh();
    });
  };

  const unplan = (completionId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteMonthlyTaskInstanceAction({ completionId });
      if (!res.ok) setError(res.error ?? "Kunde inte avplanera.");
      router.refresh();
    });
  };

  return (
    <div
      className={cellClass(
        styles.monthlyCard,
        status === "done" && styles.monthlyCard_done,
        status === "planned" && styles.monthlyCard_planned,
        status === "unplaced" && styles.monthlyCard_unplaced,
      )}
    >
      <div className={styles.monthlyCardMain}>
        <span className={styles.monthlyCardIcon} aria-hidden>
          {task.icon}
        </span>
        <div className={styles.monthlyCardBody}>
          <p className={styles.monthlyCardKicker}>{task.title}</p>
          {category ? (
            <p className={styles.monthlyCardCategory}>
              {category.icon} {category.name}
            </p>
          ) : null}
          {occasions.length === 0 ? (
            <p className={styles.monthlyCardDetail}>
              Inga fester inlagda den här månaden
            </p>
          ) : (
            <ul className={styles.festProgressList}>
              {occasions.map((c) => (
                <li key={c.id} className={styles.festProgressItem}>
                  <span>
                    {formatFestOccasionWhen(c, monthStart)}
                    {isMonthlyTaskComplete(task, c) ? " · klar" : ""}
                  </span>
                  <span className={styles.festProgressActions}>
                    <label className={styles.festDayLabel}>
                      <span className={styles.festDayCaption}>
                        {c.scheduledDayOfMonth == null ? "Placera" : "Dag"}
                      </span>
                      <select
                        className={styles.festDaySelect}
                        value={c.scheduledDayOfMonth ?? ""}
                        disabled={pending}
                        aria-label={`Placera ${formatFestOccasionWhen(c, monthStart)} på en dag`}
                        onChange={(e) => {
                          const day = Number(e.target.value);
                          if (day >= 1 && day <= 31) placeOnDay(c.id, day);
                        }}
                      >
                        <option value="">
                          {c.scheduledDayOfMonth == null ? "Välj dag…" : "Byt dag…"}
                        </option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className={styles.festUnplanBtn}
                      disabled={pending}
                      onClick={() => unplan(c.id)}
                    >
                      Avplanera
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className={styles.monthlyCardHint}>{error}</p> : null}
        </div>
      </div>
      <div className={styles.monthlyCardAside}>
        {status === "done" ? (
          <span className={styles.monthlyStatusDone} aria-label="Klar">
            ✓
          </span>
        ) : status === "planned" ? (
          <span className={styles.monthlyStatusPlanned} aria-label="Planerad">
            ○
          </span>
        ) : null}
        <Link href={planHref} className={styles.monthlyCardLink}>
          {occasions.length === 0 ? "Lägg till fest" : "Lägg till fler"}
        </Link>
      </div>
    </div>
  );
}
