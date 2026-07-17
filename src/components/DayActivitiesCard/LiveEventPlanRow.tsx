"use client";

import { useState, useTransition } from "react";
import {
  attendLiveEventAction,
  resetLiveEventAttendanceAction,
} from "@/app/(app)/live-events-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { PlanCadenceBadge } from "@/components/PlanCadenceBadge/PlanCadenceBadge";
import type { DayPlanItem } from "@/lib/day-plan";
import {
  LIVE_EVENT_KIND_ICON,
  LIVE_EVENT_KIND_LABEL,
  LIVE_RATING_MAX,
  LIVE_RATING_MIN,
  liveEventDetail,
} from "@/lib/live-events";
import type { PlanSortableProps } from "./usePlanSortable";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";
import rowStyles from "./LiveEventPlanRow.module.scss";

const RATING_OPTIONS = Array.from(
  { length: LIVE_RATING_MAX - LIVE_RATING_MIN + 1 },
  (_, i) => LIVE_RATING_MIN + i,
);

interface Props extends PlanSortableProps {
  item: Extract<DayPlanItem, { kind: "live_event" }>;
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

export function LiveEventPlanRow({
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
  const event = item.event;
  const done = Boolean(event.attendedAt);
  const overdue = !done && event.eventDate < date;

  const [note, setNote] = useState(event.note ?? "");
  const [rating, setRating] = useState(
    event.rating != null ? String(event.rating) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const detail = done
    ? [liveEventDetail(event), event.note?.trim()].filter(Boolean).join(" · ")
    : `${LIVE_EVENT_KIND_LABEL[event.kind]} · ${event.eventDate}${event.location ? ` · ${event.location}` : ""}${overdue ? " · Passerat" : ""}`;

  const attend = () => {
    setError(null);
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await attendLiveEventAction({
        id: event.id,
        note,
        rating: rating.trim() === "" ? null : Number(rating),
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
      const res = await resetLiveEventAttendanceAction(event.id);
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
        overdue ? rowStyles.overdue : "",
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
          {LIVE_EVENT_KIND_ICON[event.kind]}
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{event.title}</span>
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
          {!done ? (
            <>
              <p className={rowStyles.prompt}>
                Hur var upplevelsen? Skriv gärna en kommentar och ge betyg.
              </p>
              <Input
                label="Kommentar (valfritt)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="t.ex. Fantastisk stämning, bra setlista!"
                maxLength={280}
                disabled={pending}
              />
              <label className={rowStyles.ratingField}>
                <span className={rowStyles.ratingLabel}>Betyg</span>
                <select
                  className={rowStyles.ratingSelect}
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  disabled={pending}
                >
                  <option value="">–</option>
                  {RATING_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}/10
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={attend}
              >
                Jag var där!
              </Button>
            </>
          ) : (
            <>
              {event.note?.trim() ? (
                <p className={rowStyles.prompt}>{event.note.trim()}</p>
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
