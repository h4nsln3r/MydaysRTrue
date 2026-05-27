"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMonthlyTaskDoneAction } from "@/app/(app)/tasks-actions";
import {
  groupByCategory,
  type MonthlyTaskForMonth,
  type TaskCategory,
} from "@/lib/tasks";
import styles from "./monthly-tasks.module.scss";

interface Props {
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
}

export function MonthlyTasksBoard({ monthStart, tasks, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (task: MonthlyTaskForMonth) => {
    const next = !task.completion?.doneAt;
    setError(null);
    setPendingId(task.id);
    startTransition(async () => {
      const res = await toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: next,
      });
      if (!res.ok) setError(res.error ?? "Could not update task.");
      setPendingId(null);
      router.refresh();
    });
  };

  if (tasks.length === 0) {
    return (
      <p className={styles.empty}>
        No monthly tasks yet. Add some from your{" "}
        <a href="/profile" className={styles.link}>
          profile
        </a>
        .
      </p>
    );
  }

  const grouped = groupByCategory(tasks, categories);
  const doneCount = tasks.filter((t) => t.completion?.doneAt).length;

  return (
    <div className={styles.board}>
      <div className={styles.progressLine}>
        <span className={styles.progressText}>
          <strong>{doneCount}</strong>
          <span className={styles.progressSlash}>/ {tasks.length}</span>
          <span className={styles.progressLabel}>done this month</span>
        </span>
        <div className={styles.progressBar} aria-hidden>
          <div
            className={styles.progressFill}
            style={{
              width: `${tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {grouped.map(({ category, items }) => (
        <section
          key={category?.id ?? "uncategorized"}
          className={styles.group}
        >
          <header className={styles.groupHeader}>
            <span
              className={styles.groupChip}
              style={{
                borderColor: category?.accent ?? "transparent",
                color: category?.accent ?? undefined,
              }}
            >
              <span className={styles.groupIcon} aria-hidden>
                {category?.icon ?? "•"}
              </span>
              <span className={styles.groupName}>
                {category?.name ?? "No category"}
              </span>
            </span>
            <span className={styles.groupCount}>
              {items.filter((t) => t.completion?.doneAt).length}/{items.length}
            </span>
          </header>

          <ul className={styles.taskList}>
            {items.map((t) => {
              const done = Boolean(t.completion?.doneAt);
              const busy = pendingId === t.id;
              return (
                <li
                  key={t.id}
                  className={[
                    styles.task,
                    done ? styles.taskDone : "",
                    busy ? styles.taskBusy : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className={[
                      styles.checkBtn,
                      done ? styles.checkBtnDone : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={done ? "Mark as not done" : "Mark as done"}
                    aria-pressed={done}
                    disabled={pending}
                    onClick={() => toggle(t)}
                  >
                    {done ? (
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
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <span aria-hidden />
                    )}
                  </button>
                  <span
                    className={styles.taskIcon}
                    aria-hidden
                    style={{ borderColor: t.accent }}
                  >
                    {t.icon}
                  </span>
                  <div className={styles.taskMeta}>
                    <span className={styles.taskTitle}>{t.title}</span>
                    <span className={styles.taskDay}>
                      {t.dayOfMonth
                        ? `Day ${t.dayOfMonth}`
                        : "Anytime this month"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
