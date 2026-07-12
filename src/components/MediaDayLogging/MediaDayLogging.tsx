"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  clearMediaDailyLogAction,
  saveMediaDailyLogAction,
} from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import {
  mediaDayLogDetail,
  mediaPositionLabel,
  mediaProgressLabel,
  mediaProgressPct,
  willCompleteMediaItem,
  type DailyMediaContext,
  type MediaItem,
} from "@/lib/media";
import styles from "./MediaDayLogging.module.scss";

interface Props {
  date: string;
  media: DailyMediaContext;
  yearHref: string;
  /** Auto-save on blur/checkbox (day card) vs explicit save button (plan row). */
  variant: "card" | "plan";
  pending?: boolean;
  onError?: (msg: string | null) => void;
  onPendingChange?: (active: boolean) => void;
  onDone: () => void;
}

export function MediaDayLogging({
  date,
  media,
  yearHref,
  variant,
  pending: parentPending = false,
  onError,
  onPendingChange,
  onDone,
}: Props) {
  const [localPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingMore, setAddingMore] = useState(false);
  const [reviewHighlight, setReviewHighlight] = useState(false);
  const [pendingReviewItem, setPendingReviewItem] = useState<MediaItem | null>(
    null,
  );

  const [selectedId, setSelectedId] = useState(media.items[0]?.id ?? "");
  const [position, setPosition] = useState("");
  const [didConsume, setDidConsume] = useState(false);

  const pending = parentPending || localPending;
  const hasLogged = media.loggedToday.length > 0;
  const showForm =
    media.items.length > 0 && (!hasLogged || addingMore) && !pendingReviewItem;

  useEffect(() => {
    if (!showForm) return;
    setSelectedId(media.items[0]?.id ?? "");
    setPosition("");
    setDidConsume(false);
    setReviewHighlight(false);
  }, [media.items, showForm]);

  const selected = media.items.find((i) => i.id === selectedId);

  const parsedPosition =
    selected?.kind === "movie"
      ? didConsume
        ? 1
        : 0
      : position.trim() === ""
        ? 0
        : Number(position);

  const showInlineReview = selected
    ? willCompleteMediaItem(selected, parsedPosition, didConsume)
    : false;

  const reportError = (msg: string | null) => {
    setError(msg);
    onError?.(msg);
  };

  const save = (
    nextId: string,
    nextPosition: string,
    nextDidConsume: boolean,
  ) => {
    if (!nextId) {
      reportError("Välj en titel.");
      return;
    }

    const item = media.items.find((i) => i.id === nextId);
    if (!item) return;

    const pos =
      item.kind === "movie"
        ? nextDidConsume
          ? 1
          : 0
        : nextPosition.trim() === ""
          ? 0
          : Number(nextPosition);

    if (item.kind !== "movie" && (!Number.isInteger(pos) || pos < 0)) {
      reportError("Ogiltig position.");
      return;
    }

    if (variant === "plan" && item.kind !== "movie" && pos <= 0 && !nextDidConsume) {
      reportError("Ange var du är i boken eller serien.");
      return;
    }

    if (variant === "plan" && item.kind === "movie" && !nextDidConsume) {
      reportError("Bocka i att du såg filmen.");
      return;
    }

    const willComplete = willCompleteMediaItem(item, pos, nextDidConsume);

    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await saveMediaDailyLogAction({
        localDate: date,
        mediaItemId: nextId,
        position: pos,
        didConsume: nextDidConsume,
      });
      if (!res.ok) {
        reportError(res.error ?? "Kunde inte spara.");
        onPendingChange?.(false);
        return;
      }
      if (res.justCompleted || willComplete) {
        setPendingReviewItem({ ...item, completed: true, bestPosition: pos });
        setReviewHighlight(true);
        setAddingMore(false);
        onPendingChange?.(false);
        return;
      }
      setAddingMore(false);
      onPendingChange?.(false);
      onDone();
    });
  };

  const undoLog = (mediaItemId: string) => {
    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await clearMediaDailyLogAction(date, mediaItemId);
      if (!res.ok) reportError(res.error ?? "Kunde inte ta bort.");
      onPendingChange?.(false);
      onDone();
    });
  };

  if (pendingReviewItem) {
    return (
      <div className={styles.section}>
        <p className={styles.completedTitle}>
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
      </div>
    );
  }

  if (media.items.length === 0 && !hasLogged) {
    return (
      <p className={styles.empty}>
        {media.allCompleted ? (
          <>
            Alla titlar klara för {media.year}! Se recensioner och lägg till fler
            i <Link href={yearHref}>årsvyn</Link>.
          </>
        ) : (
          <>
            Lägg till böcker, serier eller filmer under{" "}
            <Link href={yearHref}>årsvyn</Link>.
          </>
        )}
      </p>
    );
  }

  return (
    <div className={styles.section}>
      {hasLogged ? (
        <ul className={styles.loggedList}>
          {media.loggedToday.map(({ log, item }) => (
            <li key={item.id} className={styles.loggedItem}>
              <div className={styles.loggedMeta}>
                <span className={styles.loggedTitle}>{item.title}</span>
                <span className={styles.loggedDetail}>
                  {mediaDayLogDetail(item, log.position, log.didConsume)}
                </span>
              </div>
              <button
                type="button"
                className={styles.undoBtn}
                onClick={() => undoLog(item.id)}
                disabled={pending}
              >
                Ångra
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hasLogged && media.items.length > 0 && !showForm ? (
        <button
          type="button"
          className={styles.extraToggle}
          onClick={() => setAddingMore(true)}
          disabled={pending}
        >
          + Lägg till mer
        </button>
      ) : null}

      {showForm ? (
        <div className={styles.form}>
          <label className={styles.fieldLabel}>
            <span>Välj titel</span>
            <select
              className={styles.select}
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setPosition("");
                setDidConsume(false);
                setReviewHighlight(false);
              }}
              disabled={pending}
            >
              {media.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          {selected && selected.kind !== "movie" && selected.totalLength ? (
            <div className={styles.progress}>
              <div className={styles.progressMeta}>
                {mediaProgressLabel(selected) ?? "Inte påbörjad"}
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${mediaProgressPct(selected)}%` }}
                />
              </div>
            </div>
          ) : null}

          {selected?.kind === "movie" ? (
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={didConsume}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDidConsume(checked);
                  if (variant === "card") {
                    save(selectedId, "0", checked);
                  }
                }}
                disabled={pending}
              />
              Såg filmen idag
            </label>
          ) : (
            <>
              <Input
                label={selected ? mediaPositionLabel(selected.kind) : "Position"}
                type="number"
                inputMode="numeric"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                onBlur={
                  variant === "card"
                    ? () => save(selectedId, position, didConsume)
                    : undefined
                }
                placeholder={
                  selected?.kind === "book" ? "t.ex. 142" : "t.ex. 5"
                }
                disabled={pending || !selectedId}
              />
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={didConsume}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDidConsume(checked);
                    if (variant === "card") {
                      save(selectedId, position, checked);
                    }
                  }}
                  disabled={pending || !selectedId}
                />
                {selected?.kind === "book" ? "Läste idag" : "Tittade idag"}
              </label>
            </>
          )}

          {showInlineReview && selected ? (
            <p className={styles.completeHint}>
              Spara sidan/avsnittet för att markera som klart och skriva en
              recension.
            </p>
          ) : null}

          {variant === "plan" ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              loading={pending}
              disabled={pending || !selectedId}
              onClick={() => save(selectedId, position, didConsume)}
            >
              Markera klart
            </Button>
          ) : null}

          {hasLogged && addingMore ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={() => {
                setAddingMore(false);
                reportError(null);
              }}
              disabled={pending}
            >
              Avbryt
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
