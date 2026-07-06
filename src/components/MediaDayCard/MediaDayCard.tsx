"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMediaDailyLogAction } from "@/app/(app)/media-actions";
import { Card } from "@/components/Card/Card";
import { Input } from "@/components/Input/Input";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import type { DailyHabit } from "@/lib/habits";
import {
  mediaPositionLabel,
  mediaProgressLabel,
  mediaProgressPct,
  willCompleteMediaItem,
  type DailyMediaContext,
  type MediaItem,
} from "@/lib/media";
import styles from "./MediaDayCard.module.scss";

interface Props {
  date: string;
  habit: DailyHabit;
  media: DailyMediaContext;
}

export function MediaDayCard({ date, habit, media }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reviewHighlight, setReviewHighlight] = useState(false);
  const [pendingReviewItem, setPendingReviewItem] = useState<MediaItem | null>(
    null,
  );

  const [selectedId, setSelectedId] = useState(
    media.dayLog?.mediaItemId ?? media.items[0]?.id ?? "",
  );
  const [position, setPosition] = useState(
    media.dayLog ? String(media.dayLog.position) : "",
  );
  const [didConsume, setDidConsume] = useState(
    media.dayLog?.didConsume ?? false,
  );

  useEffect(() => {
    setSelectedId(media.dayLog?.mediaItemId ?? media.items[0]?.id ?? "");
    setPosition(media.dayLog ? String(media.dayLog.position) : "");
    setDidConsume(media.dayLog?.didConsume ?? false);
    if (media.items.length > 0) {
      setReviewHighlight(false);
    }
  }, [media.dayLog, media.items]);

  const selected: MediaItem | undefined = media.items.find(
    (i) => i.id === selectedId,
  );

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

  const save = (
    nextId: string,
    nextPosition: string,
    nextDidConsume: boolean,
  ) => {
    if (!nextId) {
      setError("Välj en titel.");
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
      setError("Ogiltig position.");
      return;
    }

    const willComplete = willCompleteMediaItem(item, pos, nextDidConsume);

    setError(null);
    startTransition(async () => {
      const res = await saveMediaDailyLogAction({
        localDate: date,
        mediaItemId: nextId,
        position: pos,
        didConsume: nextDidConsume,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      if (res.justCompleted || willComplete) {
        setPendingReviewItem({ ...item, completed: true, bestPosition: pos });
        setReviewHighlight(true);
      }
      router.refresh();
    });
  };

  const yearHref = `/year?y=${media.year}&view=plan`;
  const logging = media.items.length > 0 && !pendingReviewItem;

  return (
    <Card
      className={[
        styles.card,
        habit.status ? styles[`card_${habit.status}`] : "",
        pending ? styles.cardBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <span
            className={styles.icon}
            aria-hidden
            style={{ borderColor: habit.accent }}
          >
            {habit.icon}
          </span>
          <span className={styles.title}>{habit.label}</span>
        </div>
        <Link href={yearHref} className={styles.monthLink}>
          År →
        </Link>
      </div>

      {pendingReviewItem ? (
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
            }}
            onSaved={() => {
              window.setTimeout(() => {
                setPendingReviewItem(null);
                setReviewHighlight(false);
              }, 1500);
            }}
          />
        </div>
      ) : media.items.length === 0 ? (
        <p className={styles.empty}>
          {media.allCompleted ? (
            <>
              Alla titlar klara för {media.year}! Se recensioner och lägg till
              fler i <Link href={yearHref}>årsvyn</Link>.
            </>
          ) : (
            <>
              Lägg till böcker, serier eller filmer under{" "}
              <Link href={yearHref}>årsvyn</Link>.
            </>
          )}
        </p>
      ) : logging ? (
        <div className={styles.section}>
          <label className={styles.checkLabel}>
            <span>Välj titel</span>
          </label>
          <select
            className={styles.select}
            value={selectedId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedId(id);
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
                  save(selectedId, "0", checked);
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
                onBlur={() => save(selectedId, position, didConsume)}
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
                    save(selectedId, position, checked);
                  }}
                  disabled={pending || !selectedId}
                />
                {selected?.kind === "book"
                  ? "Läste idag"
                  : "Tittade idag"}
              </label>
            </>
          )}

          {showInlineReview && selected ? (
            <p className={styles.completeHint}>
              Spara sidan/avsnittet för att markera som klart och skriva en
              recension.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </Card>
  );
}
