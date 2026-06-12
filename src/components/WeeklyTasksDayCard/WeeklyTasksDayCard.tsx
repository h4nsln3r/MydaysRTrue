"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  completeWeeklyTaskAction,
  toggleWeeklyTaskDoneAction,
  uncompleteWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  formatWeeklyTaskDetail,
  groupByCategory,
  type TaskCategory,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import styles from "./WeeklyTasksDayCard.module.scss";

interface Props {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  categories: TaskCategory[];
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
}

export function WeeklyTasksDayCard({
  weekStart,
  tasks,
  categories,
  title = "Veckouppgifter",
  hideWhenEmpty = false,
  showWeekLink = true,
}: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const doneCount = tasks.filter((t) => t.placement?.doneAt).length;
  const grouped = groupByCategory(tasks, categories);

  if (tasks.length === 0) {
    if (hideWhenEmpty) return null;

    return (
      <Card className={styles.card}>
        <p className={styles.empty}>Inga veckouppgifter planerade idag.</p>
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Se veckoplan →
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          <span
            className={[
              styles.counter,
              doneCount === tasks.length ? styles.counterDone : "",
              doneCount > 0 && doneCount < tasks.length
                ? styles.counterPartial
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.counterBig}>{doneCount}</span>
            <span className={styles.counterSlash}>/ {tasks.length}</span>
          </span>
        </div>
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Veckoplan →
          </Link>
        ) : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.groups}>
        {grouped.map(({ category, items }) => (
          <section key={category?.id ?? "none"}>
            {category ? (
              <p className={styles.groupLabel}>
                {category.icon} {category.name}
              </p>
            ) : null}
            <ul className={styles.list}>
              {items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  weekStart={weekStart}
                  expanded={expandedId === task.id}
                  busy={pendingId === task.id}
                  pending={pending}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === task.id ? null : task.id)
                  }
                  onError={setError}
                  onPendingId={setPendingId}
                  onDone={() => {
                    setExpandedId(null);
                    router.refresh();
                  }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}

interface TaskRowProps {
  task: WeeklyTaskForWeek;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

function TaskRow({
  task,
  weekStart,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingId,
  onDone,
}: TaskRowProps) {
  const placement = task.placement;
  const done = Boolean(placement?.doneAt);
  const needsExpand = task.completionKind !== "simple";
  const [, startTransition] = useTransition();

  const [taskNote, setTaskNote] = useState(placement?.note ?? "");
  const [shopLocation, setShopLocation] = useState(
    placement?.shopLocation ?? "",
  );
  const [shopAmount, setShopAmount] = useState(
    placement?.shopAmount != null ? String(placement.shopAmount) : "",
  );
  const [laundryLoads, setLaundryLoads] = useState(
    placement?.laundryLoads != null ? String(placement.laundryLoads) : "",
  );

  const detail = placement ? formatWeeklyTaskDetail(placement) : null;
  const planNote = placement?.planNote?.trim() ?? "";

  const toggleSimple = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await toggleWeeklyTaskDoneAction({
        taskId: task.id,
        weekStart,
        done: !done,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
      onPendingId(null);
      onDone();
    });
  };

  const complete = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await completeWeeklyTaskAction({
        taskId: task.id,
        weekStart,
        note: taskNote,
        shopLocation,
        shopAmount:
          shopAmount.trim() === ""
            ? undefined
            : Number(shopAmount.replace(",", ".")),
        laundryLoads:
          laundryLoads.trim() === "" ? undefined : Number(laundryLoads),
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const uncomplete = () => {
    onError(null);
    onPendingId(task.id);
    startTransition(async () => {
      const res = await uncompleteWeeklyTaskAction({
        taskId: task.id,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setTaskNote("");
      setShopLocation("");
      setShopAmount("");
      setLaundryLoads("");
      onPendingId(null);
      onDone();
    });
  };

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
      {task.completionKind === "simple" ? (
        <button
          type="button"
          className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={done ? "Markera ej klar" : "Markera klar"}
          aria-pressed={done}
          disabled={pending}
          onClick={toggleSimple}
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
        <button
          type="button"
          className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={done ? "Klart" : "Logga"}
          onClick={onToggleExpand}
          disabled={pending}
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
      )}

      <button
        type="button"
        className={styles.taskBody}
        onClick={needsExpand ? onToggleExpand : undefined}
        aria-expanded={needsExpand ? expanded : undefined}
        disabled={pending || !needsExpand}
      >
        <span
          className={styles.taskIcon}
          aria-hidden
          style={{ borderColor: task.accent }}
        >
          {task.icon}
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{task.title}</span>
          {detail ? (
            <span className={styles.taskDetail}>{detail}</span>
          ) : !done && planNote && task.completionKind === "journal" ? (
            <span className={styles.planHint}>Planerat: {planNote}</span>
          ) : !done && planNote && task.completionKind === "laundry" ? (
            <span className={styles.planHint}>Bokad: {planNote}</span>
          ) : null}
        </span>
        {needsExpand ? (
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        ) : null}
      </button>

      {expanded && needsExpand ? (
        <div className={styles.taskActions}>
          {task.completionKind === "journal" && planNote ? (
            <p className={styles.planReadout}>
              <span className={styles.planReadoutLabel}>Planerat</span>
              {planNote}
            </p>
          ) : null}
          {task.completionKind === "laundry" && planNote ? (
            <p className={styles.planReadout}>
              <span className={styles.planReadoutLabel}>Bokad tid</span>
              {planNote}
            </p>
          ) : null}

          {!done ? (
            <>
              {task.completionKind === "shop" ? (
                <>
                  <Input
                    label="Var handlade du?"
                    value={shopLocation}
                    onChange={(e) => setShopLocation(e.target.value)}
                    placeholder="t.ex. ICA, Coop"
                    maxLength={120}
                    disabled={pending}
                  />
                  <Input
                    label="Summa (kr)"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={shopAmount}
                    onChange={(e) => setShopAmount(e.target.value)}
                    placeholder="t.ex. 450"
                    disabled={pending}
                  />
                </>
              ) : null}
              {task.completionKind === "journal" ? (
                <Input
                  label="Vad gjorde du?"
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                  placeholder="Anteckna resultatet"
                  maxLength={500}
                  disabled={pending}
                />
              ) : null}
              {task.completionKind === "laundry" ? (
                <Input
                  label="Antal tvättar"
                  type="number"
                  inputMode="numeric"
                  value={laundryLoads}
                  onChange={(e) => setLaundryLoads(e.target.value)}
                  placeholder="t.ex. 2"
                  disabled={pending}
                />
              ) : null}
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={complete}
              >
                Markera klart
              </Button>
            </>
          ) : (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={uncomplete}
              disabled={pending}
            >
              Ångra klarmarkering
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}
