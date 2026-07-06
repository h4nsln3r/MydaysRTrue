"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveLiveEventAction,
  createLiveEventAction,
  resetLiveEventAttendanceAction,
  updateLiveEventAction,
} from "@/app/(app)/live-events-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  LIVE_EVENT_KIND_ICON,
  LIVE_EVENT_KIND_LABEL,
  LIVE_RATING_MAX,
  LIVE_RATING_MIN,
  liveEventDetail,
  liveRatingLabel,
  type LiveEvent,
  type LiveEventKind,
  type YearLiveEventsContext,
} from "@/lib/live-events";
import styles from "./LiveEventsYearBoard.module.scss";

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
  yearLive: YearLiveEventsContext;
}

export function LiveEventsYearBoard({ yearLive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<LiveEventKind>("concert");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");

  const add = () => {
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
      const res = await createLiveEventAction({
        year: yearLive.year,
        kind,
        title,
        eventDate,
        location,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setTitle("");
      setEventDate("");
      setLocation("");
      router.refresh();
    });
  };

  return (
    <div className={styles.board}>
      <p className={styles.hint}>
        Planera konserter, matcher, lopp och fester för {yearLive.year}. På
        eventdagen dyker de upp i Dagens plan — klarmarkera och skriv en
        recension efteråt.
      </p>

      {yearLive.events.length > 0 ? (
        <ul className={styles.list}>
          {yearLive.events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              pending={pending}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Inget planerat ännu.</p>
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
              {LIVE_EVENT_KIND_ICON[k]} {LIVE_EVENT_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <Input
          label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="t.ex. The Ark, AIK–Djurgården, Midnattsloppet"
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
          placeholder="t.ex. Gröna Lund, Friends Arena"
          maxLength={120}
          disabled={pending}
        />
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

function EventRow({
  event,
  pending,
  onError,
}: {
  event: LiveEvent;
  pending: boolean;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editKind, setEditKind] = useState(event.kind);
  const [editDate, setEditDate] = useState(event.eventDate);
  const [editLocation, setEditLocation] = useState(event.location ?? "");
  const [editNote, setEditNote] = useState(event.note ?? "");
  const [editRating, setEditRating] = useState(
    event.rating != null ? String(event.rating) : "",
  );
  const [localPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = pending || localPending;

  const saveEdit = () => {
    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await updateLiveEventAction({
        id: event.id,
        title: editTitle,
        kind: editKind,
        eventDate: editDate,
        location: editLocation,
        note: editNote,
        rating: editRating.trim() === "" ? null : Number(editRating),
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
      const res = await archiveLiveEventAction(event.id);
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  const resetAttendance = () => {
    onError(null);
    startTransition(async () => {
      const res = await resetLiveEventAttendanceAction(event.id);
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      router.refresh();
    });
  };

  if (isEditing) {
    return (
      <li className={[styles.item, styles.itemEditing].join(" ")}>
        <div className={styles.editForm}>
          <div className={styles.kindRow}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={styles.kindBtn}
                aria-pressed={editKind === k}
                onClick={() => setEditKind(k)}
                disabled={busy}
              >
                {LIVE_EVENT_KIND_ICON[k]}
              </button>
            ))}
          </div>
          <Input
            label="Titel"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            maxLength={120}
            disabled={busy}
          />
          <Input
            label="Datum"
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            disabled={busy}
          />
          <Input
            label="Plats"
            value={editLocation}
            onChange={(e) => setEditLocation(e.target.value)}
            maxLength={120}
            disabled={busy}
          />
          {event.attendedAt ? (
            <>
              <Input
                label="Recension"
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
            <Button type="button" variant="ghost" size="md" onClick={() => setIsEditing(false)} disabled={busy}>
              Avbryt
            </Button>
            <Button type="button" variant="primary" size="md" loading={busy} onClick={saveEdit}>
              Spara
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <span className={styles.itemIcon} aria-hidden>
        {LIVE_EVENT_KIND_ICON[event.kind]}
      </span>
      <div className={styles.itemMeta}>
        <span className={styles.itemTitle}>
          {event.title}
          {event.attendedAt ? <span className={styles.doneBadge}> ✓</span> : null}
        </span>
        <span className={styles.itemSub}>{liveEventDetail(event)}</span>
        {event.note ? <span className={styles.itemNote}>{event.note}</span> : null}
      </div>
      <button type="button" className={styles.editBtn} onClick={() => setIsEditing(true)} disabled={busy}>
        Redigera
      </button>
      {event.attendedAt ? (
        <button type="button" className={styles.resetBtn} onClick={resetAttendance} disabled={busy}>
          Ångra besök
        </button>
      ) : null}
      <button type="button" className={styles.removeBtn} onClick={remove} disabled={busy}>
        Ta bort
      </button>
    </li>
  );
}
