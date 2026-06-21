"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import {
  toggleMonthlyTaskDoneAction,
  scheduleMonthlyBillDayAction,
  setMonthlyTaskCategoryAction,
} from "@/app/(app)/tasks-actions";
import {
  groupByCategory,
  type MonthlyTaskForMonth,
  type TaskCategory,
} from "@/lib/tasks";
import { effectiveScheduledDay } from "@/lib/monthly-bills";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (taskId: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    setPendingId(taskId);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Could not update task.");
      setPendingId(null);
      router.refresh();
    });
  };

  const toggleQuick = (task: MonthlyTaskForMonth) =>
    run(task.id, () =>
      toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: !task.completion?.doneAt,
      }),
    );

  const complete = (task: MonthlyTaskForMonth, note: string) =>
    run(task.id, async () => {
      const res = await toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: true,
        note,
      });
      if (res.ok) setExpandedId(null);
      return res;
    });

  const uncomplete = (task: MonthlyTaskForMonth) =>
    run(task.id, () =>
      toggleMonthlyTaskDoneAction({
        taskId: task.id,
        monthStart,
        done: false,
      }),
    );

  const scheduleDay = (task: MonthlyTaskForMonth, raw: string) => {
    const dayOfMonth = raw === "" ? null : Number(raw);
    if (dayOfMonth != null && (dayOfMonth < 1 || dayOfMonth > 31)) return;
    run(task.id, () =>
      scheduleMonthlyBillDayAction({
        taskId: task.id,
        monthStart,
        dayOfMonth,
      }),
    );
  };

  const changeCategory = (task: MonthlyTaskForMonth, raw: string) =>
    run(task.id, () =>
      setMonthlyTaskCategoryAction({
        taskId: task.id,
        categoryId: raw || null,
      }),
    );

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
            {items.map((t) => (
              <MonthlyTaskRow
                key={t.id}
                task={t}
                categories={categories}
                pending={pending}
                busy={pendingId === t.id}
                expanded={expandedId === t.id}
                onToggleExpand={() =>
                  setExpandedId(expandedId === t.id ? null : t.id)
                }
                onToggleQuick={toggleQuick}
                onComplete={complete}
                onUncomplete={uncomplete}
                onSchedule={scheduleDay}
                onChangeCategory={changeCategory}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface MonthlyTaskRowProps {
  task: MonthlyTaskForMonth;
  categories: TaskCategory[];
  pending: boolean;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleQuick: (task: MonthlyTaskForMonth) => void;
  onComplete: (task: MonthlyTaskForMonth, note: string) => void;
  onUncomplete: (task: MonthlyTaskForMonth) => void;
  onSchedule: (task: MonthlyTaskForMonth, raw: string) => void;
  onChangeCategory: (task: MonthlyTaskForMonth, raw: string) => void;
}

function MonthlyTaskRow({
  task,
  categories,
  pending,
  busy,
  expanded,
  onToggleExpand,
  onToggleQuick,
  onComplete,
  onUncomplete,
  onSchedule,
  onChangeCategory,
}: MonthlyTaskRowProps) {
  const done = Boolean(task.completion?.doneAt);
  const scheduledDay = effectiveScheduledDay(task, task.completion);
  const savedNote = task.completion?.note?.trim() ?? "";
  const [note, setNote] = useState(savedNote);

  return (
    <li
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
        disabled={pending}
        onClick={() => onToggleQuick(task)}
      >
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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
      <span className={styles.taskIcon} aria-hidden style={{ borderColor: task.accent }}>
        {task.icon}
      </span>
      <div className={styles.taskMeta}>
        <button
          type="button"
          className={styles.taskTitleBtn}
          onClick={onToggleExpand}
          aria-expanded={expanded}
          disabled={pending}
        >
          <span className={styles.taskTitle}>{task.title}</span>
          {savedNote ? (
            <span className={styles.taskNoteHint}>{savedNote}</span>
          ) : null}
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        </button>
        <label className={styles.taskDay}>
          <span className={styles.taskDayLabel}>Dag</span>
          <select
            className={styles.taskDaySelect}
            value={scheduledDay ?? ""}
            disabled={pending}
            onChange={(e) => onSchedule(task, e.target.value)}
            aria-label={`Placera ${task.title} på dag i månaden`}
          >
            <option value="">Ej placerad</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {expanded ? (
        <div className={styles.expand}>
          {categories.length > 0 ? (
            <label className={styles.taskDay}>
              <span className={styles.taskDayLabel}>Kategori</span>
              <select
                className={styles.taskDaySelect}
                value={task.categoryId ?? ""}
                disabled={pending}
                onChange={(e) => onChangeCategory(task, e.target.value)}
                aria-label={`Kategori för ${task.title}`}
              >
                <option value="">Ingen kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {!done ? (
            <>
              <Input
                label="Kommentar (valfritt)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Skriv en kommentar"
                maxLength={500}
                disabled={pending}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={() => onComplete(task, note)}
              >
                Markera klart
              </Button>
            </>
          ) : (
            <>
              {savedNote ? (
                <p className={styles.noteReadout}>
                  <span className={styles.noteReadoutLabel}>Kommentar</span>
                  {savedNote}
                </p>
              ) : (
                <p className={styles.noteEmpty}>Ingen kommentar.</p>
              )}
              <button
                type="button"
                className={styles.undoBtn}
                onClick={() => onUncomplete(task)}
                disabled={pending}
              >
                Ångra klarmarkering
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
