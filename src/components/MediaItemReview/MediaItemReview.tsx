"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMediaItemReviewAction } from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  MEDIA_RATING_MAX,
  MEDIA_RATING_MIN,
  mediaCompletionPrompt,
  type MediaKind,
} from "@/lib/media";
import styles from "./MediaItemReview.module.scss";

const RATING_OPTIONS = Array.from(
  { length: MEDIA_RATING_MAX - MEDIA_RATING_MIN + 1 },
  (_, i) => MEDIA_RATING_MIN + i,
);

interface Props {
  itemId: string;
  kind: MediaKind;
  note: string | null;
  rating: number | null;
  /** Highlight when the user just finished the title. */
  highlight?: boolean;
  compact?: boolean;
  onDismiss?: () => void;
  onSaved?: () => void;
}

export function MediaItemReview({
  itemId,
  kind,
  note,
  rating,
  highlight = false,
  compact = false,
  onDismiss,
  onSaved,
}: Props) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState(note ?? "");
  const [reviewRating, setReviewRating] = useState(
    rating != null ? String(rating) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setReviewNote(note ?? "");
    setReviewRating(rating != null ? String(rating) : "");
    setSaved(false);
  }, [itemId, note, rating]);

  const dirty =
    reviewNote.trim() !== (note ?? "").trim() ||
    (reviewRating === "" ? null : Number(reviewRating)) !== rating;

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateMediaItemReviewAction({
        id: itemId,
        note: reviewNote,
        rating: reviewRating.trim() === "" ? null : Number(reviewRating),
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      if (onDismiss) {
        onDismiss();
        return;
      }
      setSaved(true);
      onSaved?.();
    });
  };

  const dismiss = () => {
    onDismiss?.();
  };

  return (
    <div
      className={[
        styles.wrap,
        highlight ? styles.wrapHighlight : "",
        compact ? styles.wrapCompact : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className={styles.prompt}>{mediaCompletionPrompt(kind)}</p>
      <Input
        label="Kommentar (valfritt)"
        type="text"
        value={reviewNote}
        onChange={(e) => {
          setReviewNote(e.target.value);
          setSaved(false);
        }}
        placeholder={
          kind === "book"
            ? "t.ex. Stark slut, rekommenderar!"
            : kind === "series"
              ? "t.ex. Säsong 2 var bäst"
              : "t.ex. Visuellt snygg, lite långsam"
        }
        maxLength={280}
        disabled={pending}
      />
      <label className={styles.ratingField}>
        <span className={styles.ratingLabel}>Betyg</span>
        <select
          className={styles.ratingSelect}
          value={reviewRating}
          onChange={(e) => {
            setReviewRating(e.target.value);
            setSaved(false);
          }}
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
      {error ? <p className={styles.error}>{error}</p> : null}
      {saved && !dirty ? (
        <p className={styles.saved}>Sparat!</p>
      ) : (
        <div className={styles.actions}>
          <Button
            type="button"
            variant={highlight ? "primary" : "outline"}
            size="md"
            fullWidth={!compact}
            loading={pending}
            disabled={pending || !dirty}
            onClick={save}
          >
            Spara recension
          </Button>
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={dismiss}
            >
              Hoppa över
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
