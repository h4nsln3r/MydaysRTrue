"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateLiveEventAction } from "@/app/(app)/live-events-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  LIVE_EVENT_KIND_ICON,
  LIVE_EVENT_KIND_LABEL,
  LIVE_RATING_MAX,
  LIVE_RATING_MIN,
  type LiveEvent,
  type LiveEventKind,
} from "@/lib/live-events";
import styles from "./LiveEventQuickEdit.module.scss";

const KINDS: LiveEventKind[] = [
  "concert",
  "sport",
  "race",
  "birthday",
  "wedding",
  "other",
];
const RATING_OPTIONS = Array.from(
  { length: LIVE_RATING_MAX - LIVE_RATING_MIN + 1 },
  (_, i) => LIVE_RATING_MIN + i,
);

interface Props {
  event: LiveEvent;
}

/** Pencil that opens a modal to correct a live event after the fact. */
export function LiveEventQuickEdit({ event }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.pencil}
        onClick={() => setOpen(true)}
        aria-label={`Redigera ${event.title}`}
      >
        ✎
      </button>
      {open ? (
        <LiveEventEditModal event={event} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function LiveEventEditModal({
  event,
  onClose,
}: {
  event: LiveEvent;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  const [title, setTitle] = useState(event.title);
  const [kind, setKind] = useState(event.kind);
  const [eventDate, setEventDate] = useState(event.eventDate);
  const [location, setLocation] = useState(event.location ?? "");
  const [note, setNote] = useState(event.note ?? "");
  const [rating, setRating] = useState(
    event.rating != null ? String(event.rating) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const attended = event.attendedAt != null;

  useEffect(() => {
    setTitle(event.title);
    setKind(event.kind);
    setEventDate(event.eventDate);
    setLocation(event.location ?? "");
    setNote(event.note ?? "");
    setRating(event.rating != null ? String(event.rating) : "");
    setError(null);
  }, [event]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close, pending]);

  const currentRating = event.rating != null ? String(event.rating) : "";
  const dirty =
    title.trim() !== event.title.trim() ||
    kind !== event.kind ||
    eventDate !== event.eventDate ||
    location.trim() !== (event.location ?? "").trim() ||
    (attended &&
      (note.trim() !== (event.note ?? "").trim() || rating !== currentRating));

  const save = () => {
    if (!title.trim()) {
      setError("Skriv en titel.");
      return;
    }
    if (!eventDate) {
      setError("Välj datum.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateLiveEventAction({
        id: event.id,
        title,
        kind,
        eventDate,
        location,
        note: attended ? note : (event.note ?? ""),
        rating: attended
          ? rating.trim() === ""
            ? null
            : Number(rating)
          : event.rating,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      close();
    });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.backdrop} onClick={pending ? undefined : close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>
              {LIVE_EVENT_KIND_ICON[event.kind]} {LIVE_EVENT_KIND_LABEL[event.kind]}
            </p>
            <h2 id={titleId} className={styles.title}>
              Redigera
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            disabled={pending}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
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
                {LIVE_EVENT_KIND_ICON[k]} {LIVE_EVENT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <Input
            label="Titel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            disabled={pending}
          />
          <Input
            label="Datum"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            disabled={pending}
          />
          <Input
            label="Plats (valfritt)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            disabled={pending}
          />
          {attended ? (
            <>
              <Input
                label="Recension (valfritt)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                disabled={pending}
              />
              <label className={styles.ratingField}>
                <span className={styles.ratingLabel}>Betyg</span>
                <select
                  className={styles.ratingSelect}
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
            </>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={close}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={pending}
              disabled={pending || !dirty}
              onClick={save}
            >
              Spara
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
