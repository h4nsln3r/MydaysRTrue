"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveGigAction,
  createGigAction,
  markGigPlayedAction,
  resetGigPlayedAction,
  updateGigAction,
} from "@/app/(app)/gigs-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  GIG_RATING_MAX,
  GIG_RATING_MIN,
  MUSIC_BANDS,
  gigDetail,
  gigRatingLabel,
  type Gig,
  type MusicBand,
  type YearGigsContext,
} from "@/lib/gigs";
import styles from "./GigsYearBoard.module.scss";

const RATING_OPTIONS = Array.from(
  { length: GIG_RATING_MAX - GIG_RATING_MIN + 1 },
  (_, i) => GIG_RATING_MIN + i,
);

interface Props {
  yearGigs: YearGigsContext;
}

export function GigsYearBoard({ yearGigs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [band, setBand] = useState<MusicBand>("Totes");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");

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
      const res = await createGigAction({
        year: yearGigs.year,
        band,
        title,
        eventDate,
        venue,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setTitle("");
      setEventDate("");
      setVenue("");
      router.refresh();
    });
  };

  return (
    <div className={styles.board}>
      <p className={styles.hint}>
        Samla alla spelningar för {yearGigs.year} — med band, plats och datum.
        Markera som spelad efteråt med betyg och anteckning.
      </p>

      {yearGigs.gigs.length > 0 ? (
        <ul className={styles.list}>
          {yearGigs.gigs.map((gig) => (
            <GigRow
              key={gig.id}
              gig={gig}
              pending={pending}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Inga spelningar ännu.</p>
      )}

      <div className={styles.form}>
        <p className={styles.hint}>Lägg till</p>
        <div className={styles.bandRow} role="radiogroup" aria-label="Band">
          {MUSIC_BANDS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={band === b}
              aria-pressed={band === b}
              className={styles.bandBtn}
              onClick={() => setBand(b)}
              disabled={pending}
            >
              🎸 {b}
            </button>
          ))}
        </div>
        <Input
          label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="t.ex. EKenäsfestivalen, Kvarteret, Sommarfest"
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
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="t.ex. Ekenäs, Gröna Lund"
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

function GigRow({
  gig,
  pending,
  onError,
}: {
  gig: Gig;
  pending: boolean;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [markNote, setMarkNote] = useState("");
  const [editTitle, setEditTitle] = useState(gig.title);
  const [editBand, setEditBand] = useState(gig.band);
  const [editDate, setEditDate] = useState(gig.eventDate);
  const [editVenue, setEditVenue] = useState(gig.venue ?? "");
  const [editNote, setEditNote] = useState(gig.note ?? "");
  const [editRating, setEditRating] = useState(
    gig.rating != null ? String(gig.rating) : "",
  );
  const [localPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = pending || localPending;

  const saveEdit = () => {
    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await updateGigAction({
        id: gig.id,
        title: editTitle,
        band: editBand,
        eventDate: editDate,
        venue: editVenue,
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
      const res = await archiveGigAction(gig.id);
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  const resetPlayed = () => {
    onError(null);
    startTransition(async () => {
      const res = await resetGigPlayedAction(gig.id);
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      router.refresh();
    });
  };

  const markPlayed = () => {
    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await markGigPlayedAction({ id: gig.id, note: markNote });
      if (!res.ok) {
        setLocalError(res.error ?? "Kunde inte markera.");
        return;
      }
      setIsMarking(false);
      setMarkNote("");
      router.refresh();
    });
  };

  if (isMarking) {
    return (
      <li className={[styles.item, styles.itemEditing].join(" ")}>
        <div className={styles.editForm}>
          <p className={styles.hint}>
            Hur gick spelningen? Skriv gärna en kommentar.
          </p>
          <Input
            label="Kommentar (valfritt)"
            value={markNote}
            onChange={(e) => setMarkNote(e.target.value)}
            placeholder="t.ex. Bra publik, lite nervös i början"
            maxLength={280}
            disabled={busy}
          />
          {localError ? <p className={styles.error}>{localError}</p> : null}
          <div className={styles.editActions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setIsMarking(false);
                setLocalError(null);
              }}
              disabled={busy}
            >
              Avbryt
            </Button>
            <Button type="button" variant="primary" size="md" loading={busy} onClick={markPlayed}>
              Spelad ✓
            </Button>
          </div>
        </div>
      </li>
    );
  }

  if (isEditing) {
    return (
      <li className={[styles.item, styles.itemEditing].join(" ")}>
        <div className={styles.editForm}>
          <div className={styles.bandRow}>
            {MUSIC_BANDS.map((b) => (
              <button
                key={b}
                type="button"
                className={styles.bandBtn}
                aria-pressed={editBand === b}
                onClick={() => setEditBand(b)}
                disabled={busy}
              >
                {b}
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
            value={editVenue}
            onChange={(e) => setEditVenue(e.target.value)}
            maxLength={120}
            disabled={busy}
          />
          {gig.playedAt ? (
            <>
              <Input
                label="Anteckning"
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
        🎤
      </span>
      <div className={styles.itemMeta}>
        <span className={styles.itemTitle}>
          {gig.title}
          {gig.playedAt ? <span className={styles.doneBadge}> ✓</span> : null}
        </span>
        <span className={styles.itemSub}>{gigDetail(gig)}</span>
        {gig.note ? <span className={styles.itemNote}>{gig.note}</span> : null}
        {gigRatingLabel(gig.rating) && !gig.note ? (
          <span className={styles.itemNote}>{gigRatingLabel(gig.rating)}</span>
        ) : null}
      </div>
      <button type="button" className={styles.editBtn} onClick={() => setIsEditing(true)} disabled={busy}>
        Redigera
      </button>
      {!gig.playedAt ? (
        <button type="button" className={styles.editBtn} onClick={() => setIsMarking(true)} disabled={busy}>
          Spelad ✓
        </button>
      ) : null}
      {gig.playedAt ? (
        <button type="button" className={styles.resetBtn} onClick={resetPlayed} disabled={busy}>
          Ångra spelad
        </button>
      ) : null}
      <button type="button" className={styles.removeBtn} onClick={remove} disabled={busy}>
        Ta bort
      </button>
    </li>
  );
}
