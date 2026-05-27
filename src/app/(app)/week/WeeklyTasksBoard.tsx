"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  placeWeeklyTaskAction,
  toggleWeeklyTaskDoneAction,
  unplaceWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type TaskCategory,
  type Weekday,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import styles from "./weekly-tasks.module.scss";

interface Props {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  categories: TaskCategory[];
}

export function WeeklyTasksBoard({ weekStart, tasks, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catById = new Map(categories.map((c) => [c.id, c]));

  // Group tasks: backlog (no placement) + Mon..Sun
  const backlog: WeeklyTaskForWeek[] = [];
  const byDay = new Map<Weekday, WeeklyTaskForWeek[]>(
    WEEKDAYS.map((d) => [d, [] as WeeklyTaskForWeek[]]),
  );
  for (const t of tasks) {
    if (!t.placement) backlog.push(t);
    else byDay.get(t.placement.weekday)?.push(t);
  }

  const place = (taskId: string, weekday: Weekday) => {
    setError(null);
    setPendingId(taskId);
    startTransition(async () => {
      const res = await placeWeeklyTaskAction({ taskId, weekStart, weekday });
      if (!res.ok) setError(res.error ?? "Could not place task.");
      setPendingId(null);
      setExpandedId(null);
      router.refresh();
    });
  };

  const unplace = (taskId: string) => {
    setError(null);
    setPendingId(taskId);
    startTransition(async () => {
      const res = await unplaceWeeklyTaskAction({ taskId, weekStart });
      if (!res.ok) setError(res.error ?? "Could not move task.");
      setPendingId(null);
      setExpandedId(null);
      router.refresh();
    });
  };

  const toggleDone = (task: WeeklyTaskForWeek) => {
    if (!task.placement) return;
    const next = !task.placement.doneAt;
    setError(null);
    setPendingId(task.id);
    startTransition(async () => {
      const res = await toggleWeeklyTaskDoneAction({
        taskId: task.id,
        weekStart,
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
        No weekly tasks yet. Add some from your{" "}
        <a href="/profile" className={styles.link}>
          profile
        </a>
        .
      </p>
    );
  }

  return (
    <div className={styles.board}>
      {error ? <p className={styles.error}>{error}</p> : null}

      <DaySection
        label="Backlog"
        sub="not yet placed this week"
        tasks={backlog}
        catById={catById}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        pending={pending}
        pendingId={pendingId}
        currentWeekday={null}
        onPlace={place}
        onUnplace={unplace}
        onToggleDone={toggleDone}
      />

      {WEEKDAYS.map((d) => (
        <DaySection
          key={d}
          label={WEEKDAY_LONG[d]}
          sub={WEEKDAY_SHORT[d]}
          tasks={byDay.get(d) ?? []}
          catById={catById}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          pending={pending}
          pendingId={pendingId}
          currentWeekday={d}
          onPlace={place}
          onUnplace={unplace}
          onToggleDone={toggleDone}
        />
      ))}
    </div>
  );
}

interface DaySectionProps {
  label: string;
  sub: string;
  tasks: WeeklyTaskForWeek[];
  catById: Map<string, TaskCategory>;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  pending: boolean;
  pendingId: string | null;
  /** null = backlog */
  currentWeekday: Weekday | null;
  onPlace: (taskId: string, weekday: Weekday) => void;
  onUnplace: (taskId: string) => void;
  onToggleDone: (task: WeeklyTaskForWeek) => void;
}

function DaySection({
  label,
  sub,
  tasks,
  catById,
  expandedId,
  setExpandedId,
  pending,
  pendingId,
  currentWeekday,
  onPlace,
  onUnplace,
  onToggleDone,
}: DaySectionProps) {
  const isBacklog = currentWeekday === null;
  const doneCount = tasks.filter((t) => t.placement?.doneAt).length;

  return (
    <section
      className={[
        styles.daySection,
        isBacklog ? styles.daySectionBacklog : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className={styles.dayHeader}>
        <div>
          <h3 className={styles.dayTitle}>{label}</h3>
          <p className={styles.daySub}>{sub}</p>
        </div>
        <span className={styles.dayCount}>
          {isBacklog
            ? `${tasks.length}`
            : `${doneCount}/${tasks.length || 0}`}
        </span>
      </header>

      {tasks.length === 0 ? (
        <p className={styles.dayEmpty}>
          {isBacklog ? "All placed — nice." : "Nothing here."}
        </p>
      ) : (
        <ul className={styles.taskList}>
          {tasks.map((t) => {
            const cat = t.categoryId ? catById.get(t.categoryId) : null;
            const done = Boolean(t.placement?.doneAt);
            const expanded = expandedId === t.id;
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
                  className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={done ? "Mark as not done" : "Mark as done"}
                  aria-pressed={done}
                  disabled={pending || isBacklog}
                  onClick={() => onToggleDone(t)}
                  title={
                    isBacklog
                      ? "Place on a day before checking off"
                      : done
                        ? "Mark as not done"
                        : "Mark as done"
                  }
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

                <button
                  type="button"
                  className={styles.taskBody}
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  aria-expanded={expanded}
                >
                  <span
                    className={styles.taskIcon}
                    aria-hidden
                    style={{ borderColor: t.accent }}
                  >
                    {t.icon}
                  </span>
                  <span className={styles.taskMeta}>
                    <span className={styles.taskTitle}>{t.title}</span>
                    {cat ? (
                      <span
                        className={styles.taskCategory}
                        style={{ color: cat.accent }}
                      >
                        {cat.icon} {cat.name}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={[styles.chevron, expanded ? styles.chevronUp : ""]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>

                {expanded ? (
                  <div className={styles.taskActions}>
                    <div className={styles.weekdayRow} role="radiogroup">
                      {WEEKDAYS.map((d) => {
                        const active = currentWeekday === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={[
                              styles.weekdayBtn,
                              active ? styles.weekdayBtnActive : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => onPlace(t.id, d)}
                            disabled={pending}
                          >
                            {WEEKDAY_SHORT[d]}
                          </button>
                        );
                      })}
                    </div>
                    {!isBacklog ? (
                      <button
                        type="button"
                        className={styles.backlogBtn}
                        onClick={() => onUnplace(t.id)}
                        disabled={pending}
                      >
                        ↺ Back to backlog
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
