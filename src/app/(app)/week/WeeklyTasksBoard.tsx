"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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

const BACKLOG_DROP_ID = "task-backlog";

function dayDropId(weekday: Weekday): string {
  return `task-day-${weekday}`;
}

function weekdayFromDropId(id: string): Weekday | null {
  const m = /^task-day-(\d)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 7 ? (n as Weekday) : null;
}

export function WeeklyTasksBoard({ weekStart, tasks, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const catById = new Map(categories.map((c) => [c.id, c]));

  const backlog = localTasks.filter((t) => !t.placement?.weekday);
  const byDay = new Map<Weekday, WeeklyTaskForWeek[]>(
    WEEKDAYS.map((d) => [d, [] as WeeklyTaskForWeek[]]),
  );
  for (const t of localTasks) {
    if (t.placement?.weekday != null) {
      byDay.get(t.placement.weekday)?.push(t);
    }
  }
  for (const d of WEEKDAYS) {
    const list = byDay.get(d);
    if (list) {
      list.sort(
        (a, b) =>
          (a.placement?.daySortOrder ?? a.sortOrder) -
          (b.placement?.daySortOrder ?? b.sortOrder),
      );
    }
  }

  const draggingTask = draggingId
    ? localTasks.find((t) => t.id === draggingId)
    : null;

  const place = (taskId: string, weekday: Weekday) => {
    const task = localTasks.find((t) => t.id === taskId);
    if (!task || task.placement?.weekday === weekday) return;

    setError(null);
    setLocalTasks((prev) => {
      const dayTasks = prev.filter(
        (t) => t.placement?.weekday === weekday,
      );
      const nextOrder =
        dayTasks.length > 0
          ? Math.max(...dayTasks.map((t) => t.placement?.daySortOrder ?? 0)) + 1
          : 0;
      return prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              placement: {
                id: t.placement?.id ?? "optimistic",
                taskId,
                weekStart,
                weekday,
                daySortOrder: nextOrder,
                doneAt: t.placement?.doneAt ?? null,
                planNote: t.placement?.planNote ?? null,
                note: t.placement?.note ?? null,
                shopLocation: t.placement?.shopLocation ?? null,
                shopAmount: t.placement?.shopAmount ?? null,
                laundryLoads: t.placement?.laundryLoads ?? null,
                band: t.placement?.band ?? null,
                musicLogKind: t.placement?.musicLogKind ?? null,
                gigId: t.placement?.gigId ?? null,
                liveEventId: t.placement?.liveEventId ?? null,
                onHold: false,
              },
            }
          : t,
      );
    });
    setPendingId(taskId);
    startTransition(async () => {
      const res = await placeWeeklyTaskAction({ taskId, weekStart, weekday });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte placera uppgiften.");
        setLocalTasks(tasks);
      }
      setPendingId(null);
      router.refresh();
    });
  };

  const unplace = (taskId: string) => {
    const task = localTasks.find((t) => t.id === taskId);
    if (!task?.placement) return;

    setError(null);
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, placement: null } : t)),
    );
    setPendingId(taskId);
    startTransition(async () => {
      const res = await unplaceWeeklyTaskAction({ taskId, weekStart });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte flytta tillbaka.");
        setLocalTasks(tasks);
      }
      setPendingId(null);
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
      if (!res.ok) setError(res.error ?? "Kunde inte uppdatera.");
      setPendingId(null);
      router.refresh();
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    if (overId === BACKLOG_DROP_ID) {
      unplace(taskId);
      return;
    }

    const weekday = weekdayFromDropId(overId);
    if (weekday) place(taskId, weekday);
  };

  if (tasks.length === 0) {
    return (
      <p className={styles.empty}>
        Inga veckouppgifter ännu. Lägg till under{" "}
        <a href="/settings" className={styles.link}>
          inställningar
        </a>{" "}
        eller med panelen ovan.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.layout}>
        <aside className={styles.backlogPanel}>
          <BacklogDropZone count={backlog.length}>
            <p className={styles.dragHint}>
              Dra till en dag · släpp här igen för att flytta tillbaka
            </p>
            {backlog.length === 0 ? (
              <p className={styles.dayEmpty}>Alla placerade den här veckan.</p>
            ) : (
              <ul className={styles.taskList}>
                {backlog.map((t) => (
                  <DraggableTaskRow
                    key={t.id}
                    task={t}
                    cat={
                      t.categoryId ? catById.get(t.categoryId) ?? undefined : undefined
                    }
                    pending={pending}
                    busy={pendingId === t.id}
                    dragging={draggingId === t.id}
                    onToggleDone={toggleDone}
                    showCheck={false}
                  />
                ))}
              </ul>
            )}
          </BacklogDropZone>
        </aside>

        <div className={styles.weekPanel}>
          {error ? <p className={styles.error}>{error}</p> : null}

          {WEEKDAYS.map((d) => {
            const dayTasks = byDay.get(d) ?? [];
            const doneCount = dayTasks.filter((t) => t.placement?.doneAt).length;
            return (
              <DayDropZone key={d} weekday={d}>
                <header className={styles.dayHeader}>
                  <div>
                    <h3 className={styles.dayTitle}>{WEEKDAY_LONG[d]}</h3>
                    <p className={styles.daySub}>{WEEKDAY_SHORT[d]}</p>
                  </div>
                  <span className={styles.dayCount}>
                    {dayTasks.length > 0
                      ? `${doneCount}/${dayTasks.length}`
                      : "—"}
                  </span>
                </header>

                {dayTasks.length === 0 ? (
                  <p className={styles.dayEmpty}>Släpp en uppgift här.</p>
                ) : (
                  <ul className={styles.taskList}>
                    {dayTasks.map((t) => (
                      <DraggableTaskRow
                        key={t.id}
                        task={t}
                        cat={
                      t.categoryId ? catById.get(t.categoryId) ?? undefined : undefined
                    }
                        pending={pending}
                        busy={pendingId === t.id}
                        dragging={draggingId === t.id}
                        onToggleDone={toggleDone}
                        showCheck
                      />
                    ))}
                  </ul>
                )}
              </DayDropZone>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingTask ? (
          <TaskCardPreview
            task={draggingTask}
            cat={
              draggingTask.categoryId
                ? catById.get(draggingTask.categoryId) ?? undefined
                : undefined
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BacklogDropZone({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: BACKLOG_DROP_ID });

  return (
    <section
      ref={setNodeRef}
      className={[
        styles.backlogSection,
        isOver ? styles.dropZoneOver : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className={styles.dayHeader}>
        <div>
          <h3 className={styles.dayTitle}>Att placera</h3>
          <p className={styles.daySub}>veckouppgifter</p>
        </div>
        <span className={styles.dayCount}>{count}</span>
      </header>
      {children}
    </section>
  );
}

function DayDropZone({
  weekday,
  children,
}: {
  weekday: Weekday;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayDropId(weekday) });

  return (
    <section
      ref={setNodeRef}
      className={[
        styles.daySection,
        isOver ? styles.dropZoneOver : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

function DraggableTaskRow({
  task,
  cat,
  pending,
  busy,
  dragging,
  onToggleDone,
  showCheck,
}: {
  task: WeeklyTaskForWeek;
  cat?: TaskCategory;
  pending: boolean;
  busy: boolean;
  dragging: boolean;
  onToggleDone: (task: WeeklyTaskForWeek) => void;
  showCheck: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    disabled: pending,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const done = Boolean(task.placement?.doneAt);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        styles.task,
        done ? styles.taskDone : "",
        busy ? styles.taskBusy : "",
        dragging ? styles.taskDragging : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showCheck ? (
        <button
          type="button"
          className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={done ? "Markera ej klar" : "Markera klar"}
          aria-pressed={done}
          disabled={pending}
          onClick={() => onToggleDone(task)}
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
      ) : (
        <span className={styles.checkPlaceholder} aria-hidden />
      )}

      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Dra ${task.title}`}
        disabled={pending}
        {...attributes}
        {...listeners}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="9" cy="7" r="1.5" fill="currentColor" />
          <circle cx="15" cy="7" r="1.5" fill="currentColor" />
          <circle cx="9" cy="12" r="1.5" fill="currentColor" />
          <circle cx="15" cy="12" r="1.5" fill="currentColor" />
          <circle cx="9" cy="17" r="1.5" fill="currentColor" />
          <circle cx="15" cy="17" r="1.5" fill="currentColor" />
        </svg>
      </button>

      <div className={styles.taskBody}>
        <span
          className={styles.taskIcon}
          aria-hidden
          style={{ borderColor: task.accent }}
        >
          {task.icon}
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{task.title}</span>
          {cat ? (
            <span className={styles.taskCategory} style={{ color: cat.accent }}>
              {cat.icon} {cat.name}
            </span>
          ) : null}
        </span>
      </div>
    </li>
  );
}

function TaskCardPreview({
  task,
  cat,
}: {
  task: WeeklyTaskForWeek;
  cat?: TaskCategory;
}) {
  return (
    <div
      className={[
        styles.task,
        styles.taskPreview,
        task.placement?.doneAt ? styles.taskDone : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.checkPlaceholder} aria-hidden />
      <div className={styles.taskBody}>
        <span
          className={styles.taskIcon}
          aria-hidden
          style={{ borderColor: task.accent }}
        >
          {task.icon}
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{task.title}</span>
          {cat ? (
            <span className={styles.taskCategory} style={{ color: cat.accent }}>
              {cat.icon} {cat.name}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
