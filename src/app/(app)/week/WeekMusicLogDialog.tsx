"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MusicTaskChecklist } from "@/components/MusicTaskChecklist/MusicTaskChecklist";
import {
  completeWeeklyTaskAction,
  uncompleteWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  formatWeeklyTaskDetail,
  isMusicRepTask,
  MUSIC_BANDS,
  MUSIC_LOG_KIND_LABEL,
  type MusicBand,
  type MusicLogKind,
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

  const [band, setBand] = useState<MusicBand | null>(placement?.band ?? null);
  const [musicLogKind, setMusicLogKind] = useState<MusicLogKind | null>(
    placement?.musicLogKind ?? null,
  );
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

  const complete = () => {
    setError(null);
    startTransition(async () => {
      const res = await completeWeeklyTaskAction({
        taskId: task.id,
        weekStart,
        note: taskNote,
        band: band ?? undefined,
        musicLogKind,
        musicTitle: musicLogKind ? musicTitle : undefined,
        musicPlace: musicLogKind ? musicPlace : undefined,
        musicRating:
          musicLogKind && musicRating.trim() !== ""
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
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ångra.");
        return;
      }
      router.refresh();
      close();
    });
  };

  const isRep = isMusicRepTask(task.key);
  const detail = placement ? formatWeeklyTaskDetail(placement) : null;
  const title = `${formatWeekdayShort(localDate)} ${formatDayShort(localDate)}`;

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>
              {task.icon} {task.title} · {title}
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
          <MusicTaskChecklist
            taskId={task.id}
            items={task.checklist}
            localDate={localDate}
            disabled={pending}
          />

          <div className={styles.divider} />

          <div className={styles.bandPicker}>
            <span className={styles.bandLabel}>Typ</span>
            <div className={styles.bandBtns}>
              <button
                type="button"
                className={[
                  styles.bandBtn,
                  musicLogKind == null ? styles.bandBtnActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={musicLogKind == null}
                disabled={pending}
                onClick={() => setMusicLogKind(null)}
              >
                Övning
              </button>
              {(Object.keys(MUSIC_LOG_KIND_LABEL) as MusicLogKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={[
                    styles.bandBtn,
                    musicLogKind === k ? styles.bandBtnActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={musicLogKind === k}
                  disabled={pending}
                  onClick={() => setMusicLogKind(k)}
                >
                  {MUSIC_LOG_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          {musicLogKind == null ? (
            <>
              {isRep ? (
                <div className={styles.bandPicker}>
                  <span className={styles.bandLabel}>Vilket band? (valfritt)</span>
                  <div className={styles.bandBtns}>
                    {MUSIC_BANDS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={[
                          styles.bandBtn,
                          band === b ? styles.bandBtnActive : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={band === b}
                        disabled={pending}
                        onClick={() => setBand((prev) => (prev === b ? null : b))}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <Input
                label="Kommentar"
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                placeholder="Vad gjorde du?"
                maxLength={500}
                disabled={pending}
              />
            </>
          ) : (
            <>
              {musicLogKind === "gig" ? (
                <div className={styles.bandPicker}>
                  <span className={styles.bandLabel}>Vilket band?</span>
                  <div className={styles.bandBtns}>
                    {MUSIC_BANDS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={[
                          styles.bandBtn,
                          band === b ? styles.bandBtnActive : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={band === b}
                        disabled={pending}
                        onClick={() => setBand(b)}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <Input
                label="Titel"
                value={musicTitle}
                onChange={(e) => setMusicTitle(e.target.value)}
                placeholder={
                  musicLogKind === "gig"
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
                  musicLogKind === "gig"
                    ? "t.ex. Debaser, Malmö"
                    : "t.ex. Annexet, Stockholm"
                }
                maxLength={120}
                disabled={pending}
              />
              <Input
                label="Kommentar (valfritt)"
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                placeholder={
                  musicLogKind === "gig"
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
