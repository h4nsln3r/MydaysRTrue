"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleWeeklyTaskChecklistItemAction } from "@/app/(app)/tasks-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import type { DayPlanItem } from "@/lib/day-plan";
import {
  dayPlanItemAccent,
  dayPlanItemIcon,
  dayPlanItemLabel,
} from "@/lib/day-plan";
import { PlanCadenceBadge } from "@/components/PlanCadenceBadge/PlanCadenceBadge";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";
import type { PlanSortableProps } from "./usePlanSortable";

interface Props extends PlanSortableProps {
  item: Extract<DayPlanItem, { kind: "task_checklist" }>;
  date: string;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingKey: (active: boolean) => void;
  onDone: () => void;
  planningMode?: boolean;
}

export function TaskChecklistPlanRow({
  item,
  date,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingKey,
  onDone,
  planningMode = false,
  dragHandle,
  sortableRef,
  sortableStyle,
}: Props) {
  const completion = item.checklistItem.completion;
  const done = Boolean(completion);
  const [note, setNote] = useState(completion?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setNote(completion?.note ?? "");
  }, [completion?.note]);

  const accent = dayPlanItemAccent(item);
  const icon = dayPlanItemIcon(item);
  const label = dayPlanItemLabel(item);
  const parentTitle = item.task.title;

  const detail = done
    ? [parentTitle, completion?.note?.trim()].filter(Boolean).join(" · ") || parentTitle
    : parentTitle;

  const save = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await toggleWeeklyTaskChecklistItemAction({
        itemId: item.checklistItem.id,
        localDate: date,
        done: true,
        note: note.trim() || null,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  const clear = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await toggleWeeklyTaskChecklistItemAction({
        itemId: item.checklistItem.id,
        localDate: date,
        done: false,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      onPendingKey(false);
      onDone();
    });
  };

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={[
        styles.task,
        styles.taskDraggable,
        done ? styles.taskDone : "",
        busy ? styles.taskBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PlanCadenceBadge cadence="weekly" done={done} corner />
      {dragHandle}
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={planningMode ? undefined : done ? "Klart" : "Logga"}
        onClick={planningMode ? undefined : onToggleExpand}
        disabled={pending || planningMode}
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

      <button
        type="button"
        className={styles.taskBody}
        onClick={planningMode ? undefined : onToggleExpand}
        aria-expanded={planningMode ? undefined : expanded}
        disabled={pending || planningMode}
      >
        <span className={styles.taskIcon} aria-hidden style={{ borderColor: accent }}>
          {icon}
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{label}</span>
          {detail ? <span className={styles.taskDetail}>{detail}</span> : null}
        </span>
        {planningMode ? null : (
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        )}
      </button>

      {!planningMode && expanded ? (
        <div className={styles.taskActions}>
          {error ? <p className={styles.error}>{error}</p> : null}
          {!done ? (
            <>
              <Input
                label="Kommentar (valfritt)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="t.ex. lärde mig introt"
                maxLength={500}
                autoFocus
                disabled={pending}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={save}
              >
                Markera klart
              </Button>
            </>
          ) : (
            <>
              {note !== (completion?.note ?? "") ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  fullWidth
                  loading={pending && busy}
                  disabled={pending}
                  onClick={save}
                >
                  Spara kommentar
                </Button>
              ) : null}
              <button
                type="button"
                className={styles.undoBtn}
                onClick={clear}
                disabled={pending}
              >
                Ångra
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
