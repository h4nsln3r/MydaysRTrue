"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveMediaItemAction,
  createMediaItemAction,
  updateMediaItemAction,
} from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  MEDIA_RATING_MAX,
  MEDIA_RATING_MIN,
  mediaProgressLabel,
  mediaRatingLabel,
  type MediaKind,
  type MediaItem,
  type YearMediaContext,
} from "@/lib/media";
import styles from "./MediaYearBoard.module.scss";

const KINDS: MediaKind[] = ["book", "series", "movie"];
const RATING_OPTIONS = Array.from(
  { length: MEDIA_RATING_MAX - MEDIA_RATING_MIN + 1 },
  (_, i) => MEDIA_RATING_MIN + i,
);

interface Props {
  yearMedia: YearMediaContext;
}

export function MediaYearBoard({ yearMedia }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaKind>("book");
  const [title, setTitle] = useState("");
  const [totalLength, setTotalLength] = useState("");

  const add = () => {
    if (!title.trim()) {
      setError("Skriv en titel.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createMediaItemAction({
        year: yearMedia.year,
        kind,
        title,
        totalLength:
          kind === "movie"
            ? null
            : totalLength.trim() === ""
              ? undefined
              : Number(totalLength),
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setTitle("");
      setTotalLength("");
      router.refresh();
    });
  };

  return (
    <div className={styles.board}>
      <p className={styles.hint}>
        Lägg till böcker, serier och filmer för {yearMedia.year}. I dagsvyn
        väljer du titel och loggar sida eller avsnitt. När du är klar kan du
        skriva en recension och ge betyg.
      </p>

      {yearMedia.items.length > 0 ? (
        <ul className={styles.list}>
          {yearMedia.items.map((item) => (
            <MediaItemRow
              key={item.id}
              item={item}
              pending={pending}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Inget tillagt ännu.</p>
      )}

      <div className={styles.form}>
        <p className={styles.hint}>Lägg till</p>
        <div className={styles.kindRow} role="radiogroup" aria-label="Typ">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              aria-pressed={kind === k}
              className={styles.kindBtn}
              onClick={() => setKind(k)}
              disabled={pending}
            >
              {MEDIA_KIND_ICON[k]} {MEDIA_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <Input
          label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            kind === "book"
              ? "t.ex. Dune"
              : kind === "series"
                ? "t.ex. Breaking Bad"
                : "t.ex. Inception"
          }
          maxLength={120}
          disabled={pending}
        />
        {kind !== "movie" ? (
          <Input
            label={kind === "book" ? "Antal sidor" : "Antal avsnitt"}
            type="number"
            inputMode="numeric"
            value={totalLength}
            onChange={(e) => setTotalLength(e.target.value)}
            placeholder={kind === "book" ? "t.ex. 412" : "t.ex. 62"}
            disabled={pending}
          />
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="md"
          fullWidth
          loading={pending}
          disabled={pending}
          onClick={add}
        >
          Lägg till
        </Button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

interface MediaItemRowProps {
  item: MediaItem;
  pending: boolean;
  onError: (msg: string | null) => void;
}

function MediaItemRow({ item, pending, onError }: MediaItemRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editNote, setEditNote] = useState(item.note ?? "");
  const [editRating, setEditRating] = useState(
    item.rating != null ? String(item.rating) : "",
  );
  const [editTotalLength, setEditTotalLength] = useState(
    item.totalLength != null ? String(item.totalLength) : "",
  );
  const [localPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = pending || localPending;

  const startEdit = () => {
    setEditTitle(item.title);
    setEditNote(item.note ?? "");
    setEditRating(item.rating != null ? String(item.rating) : "");
    setEditTotalLength(
      item.totalLength != null ? String(item.totalLength) : "",
    );
    setLocalError(null);
    onError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setLocalError(null);
  };

  const saveEdit = () => {
    if (!editTitle.trim()) {
      setLocalError("Skriv en titel.");
      return;
    }

    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await updateMediaItemAction({
        id: item.id,
        title: editTitle,
        note: editNote,
        rating: editRating.trim() === "" ? null : Number(editRating),
        totalLength:
          item.kind === "movie"
            ? null
            : editTotalLength.trim() === ""
              ? undefined
              : Number(editTotalLength),
      });
      if (!res.ok) {
        setLocalError(res.error ?? "Kunde inte spara.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  const remove = () => {
    onError(null);
    startTransition(async () => {
      const res = await archiveMediaItemAction(item.id);
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  if (isEditing) {
    return (
      <li className={[styles.itemWrap, styles.itemEditing].filter(Boolean).join(" ")}>
        <div className={styles.item}>
          <span className={styles.itemIcon} aria-hidden>
            {MEDIA_KIND_ICON[item.kind]}
          </span>
          <div className={styles.editForm}>
            <Input
              label="Titel"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
            {item.kind !== "movie" ? (
              <Input
                label={item.kind === "book" ? "Antal sidor" : "Antal avsnitt"}
                type="number"
                inputMode="numeric"
                value={editTotalLength}
                onChange={(e) => setEditTotalLength(e.target.value)}
                disabled={busy}
              />
            ) : null}
            {item.completed ? (
              <>
                <Input
                  label="Recension (valfritt)"
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  maxLength={280}
                  disabled={busy}
                />
                <label className={styles.ratingField}>
                  <span className={styles.ratingLabel}>Betyg</span>
                  <select
                    className={styles.ratingSelect}
                    value={editRating}
                    onChange={(e) => setEditRating(e.target.value)}
                    disabled={busy}
                    aria-label={`Betyg för ${editTitle}`}
                  >
                    <option value="">–</option>
                    {RATING_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {localError ? <p className={styles.error}>{localError}</p> : null}
            <div className={styles.editActions}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={cancelEdit}
                disabled={busy}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={busy}
                disabled={busy}
                onClick={saveEdit}
              >
                Spara
              </Button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.itemWrap}>
      <div className={styles.item}>
        <span className={styles.itemIcon} aria-hidden>
          {MEDIA_KIND_ICON[item.kind]}
        </span>
        <div className={styles.itemMeta}>
          <span className={styles.itemTitle}>
            {item.title}
            {item.completed ? (
              <span className={styles.doneBadge} aria-label="Klart">
                {" "}
                ✓
              </span>
            ) : null}
          </span>
          <span className={styles.itemSub}>
            {MEDIA_KIND_LABEL[item.kind]}
            {item.totalLength
              ? item.kind === "book"
                ? ` · ${item.totalLength} sidor`
                : ` · ${item.totalLength} avsnitt`
              : ""}
            {mediaProgressLabel(item)
              ? ` · ${mediaProgressLabel(item)}`
              : ""}
            {mediaRatingLabel(item.rating)
              ? ` · ${mediaRatingLabel(item.rating)}`
              : ""}
          </span>
          {item.note ? (
            <span className={styles.itemNote}>{item.note}</span>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.editBtn}
          onClick={startEdit}
          disabled={busy}
        >
          Redigera
        </button>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={remove}
          disabled={busy}
        >
          Ta bort
        </button>
      </div>
      {item.completed ? (
        <MediaItemReview
          itemId={item.id}
          kind={item.kind}
          note={item.note}
          rating={item.rating}
          compact
        />
      ) : null}
    </li>
  );
}
