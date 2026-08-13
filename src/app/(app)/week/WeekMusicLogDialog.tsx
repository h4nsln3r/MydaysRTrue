"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MusicActivityFields } from "@/components/MusicActivityFields/MusicActivityFields";
import {
  completeWeeklyTaskAction,
  uncompleteWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  formatWeeklyTaskDetail,
  musicActivityCreatesGig,
  musicActivityCreatesLiveEvent,
  musicSessionIcon,
  musicSessionTitle,
  parseMusicActivity,
  type MusicActivity,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import { GIG_RATING_MAX, GIG_RATING_MIN } from "@/lib/gigs";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import styles from "./week-music-modal.module.scss";

interface Props {
  task: WeeklyTaskForWeek;
  weekStart: string;
  localDate: string;
  onClose: () => void;
}

export function WeekMusicLogDialog({
  task,
  weekStart,
  localDate,
  onClose,
}: Props) {
  const router = useRouter();
  const close = useCallback(() => onClose(), [onClose]);

  const placement = task.placement;
  const done = Boolean(placement?.doneAt);

  const [musicActivity, setMusicActivity] = useState<MusicActivity | null>(
    parseMusicActivity(placement?.musicActivity),
  );
  const [band, setBand] = useState<string | null>(placement?.band ?? null);
  const [musicTitle, setMusicTitle] = useState(
    placement?.musicLogKind ? (placement.note ?? "") : "",
  );
  const [musicPlace, setMusicPlace] = useState("");
  const [musicRating, setMusicRating] = useState("");
  const [taskNote, setTaskNote] = useState(placement?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const isGig = musicActivityCreatesGig(musicActivity);
  const isLive = musicActivityCreatesLiveEvent(musicActivity);

  const complete = () => {
    setError(null);
    startTransition(async () => {
      const res = await completeWeeklyTaskAction({
        taskId: task.id,
        weekStart,
        placementId: placement?.id,
        note: taskNote,
        band: band ?? undefined,
        musicActivity,
        musicTitle: isGig || isLive ? musicTitle : undefined,
        musicPlace: isGig || isLive ? musicPlace : undefined,
        musicRating:
          (isGig || isLive) && musicRating.trim() !== ""
            ? Number(musicRating)
            : null,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      close();
    });
  };

  const uncomplete = () => {
    setError(null);
    startTransition(async () => {
      const res = await uncompleteWeeklyTaskAction({
        taskId: task.id,
        weekStart,
        placementId: placement?.id,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ångra.");
        return;
      }
      router.refresh();
      close();
    });
  };

  const detail = placement ? formatWeeklyTaskDetail(placement) : null;
  const title = `${formatWeekdayShort(localDate)} ${formatDayShort(localDate)}`;
  const sessionTitle = musicSessionTitle(task, placement);

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={sessionTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>
              {musicSessionIcon(task, placement)} {sessionTitle} · {title}
            </p>
            <h2 className={styles.title}>Logga musik</h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {placement?.planTodo ? (
            <p className={styles.hint}>Uppgift: {placement.planTodo}</p>
          ) : null}
          {placement?.planNote ? (
            <p className={styles.hint}>Anteckning: {placement.planNote}</p>
          ) : null}

          <MusicActivityFields
            activity={musicActivity}
            onActivityChange={setMusicActivity}
            band={band}
            onBandChange={setBand}
            disabled={pending}
          />

          {isGig || isLive ? (
            <>
              <Input
                label="Titel"
                value={musicTitle}
                onChange={(e) => setMusicTitle(e.target.value)}
                placeholder={
                  isGig
                    ? "t.ex. Ekenäsfestivalen, Kvarteret"
                    : "t.ex. Artist / band på scen"
                }
                maxLength={120}
                disabled={pending}
              />
              <Input
                label="Plats (valfritt)"
                value={musicPlace}
                onChange={(e) => setMusicPlace(e.target.value)}
                placeholder={
                  isGig ? "t.ex. Debaser, Malmö" : "t.ex. Annexet, Stockholm"
                }
                maxLength={120}
                disabled={pending}
              />
              <Input
                label="Kommentar (valfritt)"
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                placeholder={
                  isGig
                    ? "t.ex. Bra publik, lite nervös i början"
                    : "t.ex. Fantastisk stämning, bra setlista!"
                }
                maxLength={280}
                disabled={pending}
              />
              <label className={styles.ratingField}>
                <span className={styles.bandLabel}>Betyg</span>
                <select
                  className={styles.ratingSelect}
                  value={musicRating}
                  onChange={(e) => setMusicRating(e.target.value)}
                  disabled={pending}
                >
                  <option value="">–</option>
                  {Array.from(
                    { length: GIG_RATING_MAX - GIG_RATING_MIN + 1 },
                    (_, i) => GIG_RATING_MIN + i,
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n}/10
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <Input
              label="Kommentar (valfritt)"
              value={taskNote}
              onChange={(e) => setTaskNote(e.target.value)}
              placeholder="Vad gjorde du?"
              maxLength={500}
              disabled={pending}
            />
          )}

          {done && detail ? <p className={styles.hint}>Loggat: {detail}</p> : null}

          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending}
            disabled={pending}
            onClick={complete}
          >
            {done ? "Spara ändringar" : "Markera klart"}
          </Button>
          {done ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={uncomplete}
              disabled={pending}
            >
              Ångra klarmarkering
            </button>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
