"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  clearMediaDailyLogAction,
  saveMediaDailyLogAction,
} from "@/app/(app)/media-actions";
import { setHabitEnabledAction } from "@/app/(app)/actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import type { DayPlanItem } from "@/lib/day-plan";
import {
  mediaDayLogDetail,
  mediaPositionLabel,
  mediaProgressLabel,
  mediaProgressPct,
  willCompleteMediaItem,
  type MediaItem,
} from "@/lib/media";
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

function sortableShellProps(props: PlanSortableProps) {
  return {
    dragHandle: props.dragHandle,
    sortableRef: props.sortableRef,
    sortableStyle: props.sortableStyle,
  };
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
  const dayLog = media.dayLog;
  const done = Boolean(dayLog && (dayLog.didConsume || dayLog.position > 0));

  const [selectedId, setSelectedId] = useState(
    dayLog?.mediaItemId ?? media.items[0]?.id ?? "",
  );
  const [position, setPosition] = useState(
    dayLog ? String(dayLog.position) : "",
  );
  const [didConsume, setDidConsume] = useState(dayLog?.didConsume ?? false);
  const [error, setError] = useState<string | null>(null);
  const [reviewHighlight, setReviewHighlight] = useState(false);
  const [pendingReviewItem, setPendingReviewItem] = useState<MediaItem | null>(
    null,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSelectedId(dayLog?.mediaItemId ?? media.items[0]?.id ?? "");
    setPosition(dayLog ? String(dayLog.position) : "");
    setDidConsume(dayLog?.didConsume ?? false);
    if (!pendingReviewItem) {
      setReviewHighlight(false);
    }
  }, [dayLog, media.items, pendingReviewItem]);

  const selected =
    media.items.find((i) => i.id === selectedId) ??
    (dayLog?.mediaItemId === media.loggedItem?.id ? media.loggedItem : undefined);

  const detail =
    done && media.loggedItem && dayLog
      ? mediaDayLogDetail(
          media.loggedItem,
          dayLog.position,
          dayLog.didConsume,
        )
      : null;

  const yearHref = `/year?y=${media.year}&view=plan`;

  const save = () => {
    if (!selectedId) {
      setError("Välj en titel.");
      return;
    }

    const logItem =
      media.items.find((i) => i.id === selectedId) ?? media.loggedItem;
    if (!logItem) return;

    const pos =
      logItem.kind === "movie"
        ? didConsume
          ? 1
          : 0
        : position.trim() === ""
          ? 0
          : Number(position);

    if (logItem.kind !== "movie" && (!Number.isInteger(pos) || pos < 0)) {
      setError("Ogiltig position.");
      return;
    }

    if (logItem.kind !== "movie" && pos <= 0 && !didConsume) {
      setError("Ange var du är i boken eller serien.");
      return;
    }

    if (logItem.kind === "movie" && !didConsume) {
      setError("Bocka i att du såg filmen.");
      return;
    }

    const willComplete = willCompleteMediaItem(logItem, pos, didConsume);

    onError(null);
    setError(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await saveMediaDailyLogAction({
        localDate: date,
        mediaItemId: selectedId,
        position: pos,
        didConsume,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara.");
        setError(res.error ?? "Kunde inte spara.");
        onPendingKey(false);
        return;
      }
      if (res.justCompleted || willComplete) {
        setPendingReviewItem({ ...logItem, completed: true, bestPosition: pos });
        setReviewHighlight(true);
        onPendingKey(false);
        return;
      }
      onPendingKey(false);
      onDone();
    });
  };

  const clear = () => {
    onError(null);
    setError(null);
    setPendingReviewItem(null);
    onPendingKey(true);
    startTransition(async () => {
      const res = await clearMediaDailyLogAction(date);
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      onPendingKey(false);
      onDone();
    });
  };

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
          {error ? <p className={styles.error}>{error}</p> : null}

          {pendingReviewItem ? (
            <>
              <p className={mediaStyles.completedTitle}>
                Klart: <strong>{pendingReviewItem.title}</strong>
              </p>
              <MediaItemReview
                itemId={pendingReviewItem.id}
                kind={pendingReviewItem.kind}
                note={pendingReviewItem.note}
                rating={pendingReviewItem.rating}
                highlight={reviewHighlight}
                onDismiss={() => {
                  setPendingReviewItem(null);
                  setReviewHighlight(false);
                  onDone();
                }}
              />
            </>
          ) : !done ? (
            <>
              {media.items.length === 0 ? (
                <p className={mediaStyles.empty}>
                  {media.allCompleted ? (
                    <>
                      Alla titlar klara! Lägg till fler i{" "}
                      <Link href={yearHref}>årsvyn</Link>.
                    </>
                  ) : (
                    <>
                      Lägg till titlar i <Link href={yearHref}>årsvyn</Link>.
                    </>
                  )}
                </p>
              ) : (
                <>
                  <label className={mediaStyles.fieldLabel}>
                    <span>Välj titel</span>
                    <select
                      className={mediaStyles.select}
                      value={selectedId}
                      onChange={(e) => {
                        setSelectedId(e.target.value);
                        setPosition("");
                        setDidConsume(false);
                      }}
                      disabled={pending}
                    >
                      {media.items.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selected &&
                  selected.kind !== "movie" &&
                  selected.totalLength ? (
                    <div className={mediaStyles.progress}>
                      <div className={mediaStyles.progressMeta}>
                        {mediaProgressLabel(selected) ?? "Inte påbörjad"}
                      </div>
                      <div className={mediaStyles.progressBar}>
                        <div
                          className={mediaStyles.progressFill}
                          style={{
                            width: `${mediaProgressPct(selected)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {selected?.kind === "movie" ? (
                    <label className={mediaStyles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={didConsume}
                        onChange={(e) => setDidConsume(e.target.checked)}
                        disabled={pending}
                      />
                      Såg filmen idag
                    </label>
                  ) : (
                    <>
                      <Input
                        label={
                          selected
                            ? mediaPositionLabel(selected.kind)
                            : "Position"
                        }
                        type="number"
                        inputMode="numeric"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder={
                          selected?.kind === "book" ? "t.ex. 142" : "t.ex. 5"
                        }
                        disabled={pending || !selectedId}
                      />
                      <label className={mediaStyles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={didConsume}
                          onChange={(e) => setDidConsume(e.target.checked)}
                          disabled={pending || !selectedId}
                        />
                        {selected?.kind === "book"
                          ? "Läste idag"
                          : "Tittade idag"}
                      </label>
                    </>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={pending && busy}
                    disabled={pending || !selectedId}
                    onClick={save}
                  >
                    Markera klart
                  </Button>
                </>
              )}

              {item.habitId ? (
                <button
                  type="button"
                  className={mediaStyles.disableBtn}
                  onClick={disableHabit}
                  disabled={pending}
                >
                  Stäng av i dagens plan
                </button>
              ) : null}
            </>
          ) : (
            <>
              {done &&
              media.loggedItem?.completed &&
              media.loggedItem.rating == null &&
              !(media.loggedItem.note?.trim() ?? "") ? (
                <MediaItemReview
                  itemId={media.loggedItem.id}
                  kind={media.loggedItem.kind}
                  note={media.loggedItem.note}
                  rating={media.loggedItem.rating}
                  compact
                  onDismiss={onDone}
                />
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
