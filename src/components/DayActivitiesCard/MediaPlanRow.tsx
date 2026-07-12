"use client";

import { useTransition } from "react";
import { setHabitEnabledAction } from "@/app/(app)/actions";
import { MediaDayLogging } from "@/components/MediaDayLogging/MediaDayLogging";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import type { DayPlanItem } from "@/lib/day-plan";
import { hasMediaDayActivity, mediaDaySummary } from "@/lib/media";
import type { PlanSortableProps } from "./usePlanSortable";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";
import mediaStyles from "./MediaPlanRow.module.scss";
import { PlanCadenceBadge } from "@/components/PlanCadenceBadge/PlanCadenceBadge";

interface RowProps extends PlanSortableProps {
  item: Extract<DayPlanItem, { kind: "media" }>;
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

export function MediaPlanRow(props: RowProps) {
  const {
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
  } = props;

  const media = item.media;
  const done = hasMediaDayActivity(media.dayLogs);
  const detail = mediaDaySummary(media.loggedToday);
  const yearHref = `/year?y=${media.year}&view=plan`;
  const [, startTransition] = useTransition();

  const disableHabit = () => {
    if (!item.habitId) return;
    onError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await setHabitEnabledAction({
        habitId: item.habitId,
        enabled: false,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte stänga av.");
      onPendingKey(false);
      onDone();
    });
  };

  const accent = item.accent;
  const icon = item.icon;
  const label = item.label;

  return (
    <li
      ref={props.sortableRef}
      style={props.sortableStyle}
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
      {props.dragHandle}
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
          <MediaDayLogging
            date={date}
            media={media}
            yearHref={yearHref}
            variant="plan"
            pending={pending && busy}
            onError={onError}
            onPendingChange={onPendingKey}
            onDone={onDone}
          />

          {done
            ? media.loggedToday.map(({ item: loggedItem }) =>
                loggedItem.completed &&
                loggedItem.rating == null &&
                !(loggedItem.note?.trim() ?? "") ? (
                  <MediaItemReview
                    key={loggedItem.id}
                    itemId={loggedItem.id}
                    kind={loggedItem.kind}
                    note={loggedItem.note}
                    rating={loggedItem.rating}
                    compact
                    onDismiss={onDone}
                  />
                ) : null,
              )
            : null}

          {!done && item.habitId ? (
            <button
              type="button"
              className={mediaStyles.disableBtn}
              onClick={disableHabit}
              disabled={pending}
            >
              Stäng av i dagens plan
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
