"use client";

import { useState, useTransition, useEffect } from "react";
import {
  resetTripDayNoteAction,
  saveTripDayNoteAction,
} from "@/app/(app)/trip-actions";
import { Button } from "@/components/Button/Button";
import { PlanCadenceBadge } from "@/components/PlanCadenceBadge/PlanCadenceBadge";
import type { DayPlanItem } from "@/lib/day-plan";
import { formatTripDayTitle } from "@/lib/leave";
import type { PlanSortableProps } from "./usePlanSortable";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";
import rowStyles from "./TripDayPlanRow.module.scss";

interface Props extends PlanSortableProps {
  item: Extract<DayPlanItem, { kind: "trip_day" }>;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingKey: (active: boolean) => void;
  onDone: () => void;
  planningMode?: boolean;
}

export function TripDayPlanRow({
  item,
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
  const trip = item.trip;
  const done = Boolean(trip.doneAt);
  const title = formatTripDayTitle(trip.title, trip.dayIndex, trip.dayCount);
  const [note, setNote] = useState(trip.note);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setNote(trip.note);
  }, [trip.note, trip.doneAt]);

  const detail = done
    ? trip.note.trim() || "Sparad"
    : planningMode
      ? `Dag ${trip.dayIndex} av ${trip.dayCount}`
      : "Skriv om dagen";

  const save = () => {
    setError(null);
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await saveTripDayNoteAction({
        periodId: trip.periodId,
        localDate: trip.localDate,
        body: note,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        onError(res.error ?? "Kunde inte spara.");
      }
      onPendingKey(false);
      onDone();
    });
  };

  const clear = () => {
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await resetTripDayNoteAction({
        periodId: trip.periodId,
        localDate: trip.localDate,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
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
      <PlanCadenceBadge cadence="daily" done={done} corner />
      {dragHandle}
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={planningMode ? undefined : onToggleExpand}
        disabled={pending || planningMode}
        aria-label={done ? "Klart" : "Skriv om resedagen"}
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
        <span
          className={styles.taskIcon}
          aria-hidden
          style={{ borderColor: "#f472b6" }}
        >
          ✈️
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{title}</span>
          <span className={styles.taskDetail}>{detail}</span>
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
          <p className={rowStyles.prompt}>
            {done
              ? "Så här blev dagen. Du kan ändra anteckningen."
              : `Hur var dag ${trip.dayIndex} av ${trip.dayCount}?`}
          </p>
          <label className={rowStyles.noteField}>
            <span className={rowStyles.noteLabel}>Anteckning om dagen</span>
            <textarea
              className={rowStyles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="t.ex. landade i Tokyo, gick i Shibuya, åt ramen"
              maxLength={2000}
              rows={4}
              disabled={pending}
            />
          </label>
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending && busy}
            disabled={pending || !note.trim()}
            onClick={save}
          >
            {done ? "Uppdatera" : "Spara dagen"}
          </Button>
          {done ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={clear}
              disabled={pending}
            >
              Ångra
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
