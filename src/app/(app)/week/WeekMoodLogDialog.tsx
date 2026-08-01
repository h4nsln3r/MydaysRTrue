"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveMoodDailyLogAction } from "@/app/(app)/mood-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MOOD_OPTIONS, type MoodKey } from "@/lib/mood";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import styles from "./week-mood-modal.module.scss";

interface Props {
  date: string;
  currentMood: MoodKey | null;
  currentNote: string | null;
  onClose: () => void;
}

export function WeekMoodLogDialog({
  date,
  currentMood,
  currentNote,
  onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MoodKey | null>(currentMood);
  const [note, setNote] = useState(currentNote ?? "");
  const [drafting, setDrafting] = useState(false);
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    setSelected(currentMood);
    setNote(currentNote ?? "");
    setDrafting(false);
  }, [currentMood, currentNote, date]);

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

  const persist = (mood: MoodKey | null, nextNote: string | null) => {
    setError(null);
    startTransition(async () => {
      const res = await saveMoodDailyLogAction({
        localDate: date,
        mood,
        note: mood ? nextNote : null,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      close();
    });
  };

  const pick = (key: MoodKey) => {
    if (pending) return;

    if (drafting && selected === key) {
      setSelected(currentMood);
      setNote(currentNote ?? "");
      setDrafting(false);
      setError(null);
      return;
    }

    if (!drafting && selected === key && currentMood === key) {
      // Keep selection; user can still edit note or clear via button.
      return;
    }

    setSelected(key);
    setDrafting(true);
    setError(null);
    if (currentMood === key && currentNote) {
      setNote(currentNote);
    } else if (!currentNote) {
      setNote("");
    } else {
      setNote(currentNote);
    }
  };

  const title = `${formatWeekdayShort(date)} ${formatDayShort(date)}`;
  const showComment = selected != null;
  const savedNoteDirty =
    !drafting &&
    selected != null &&
    currentMood === selected &&
    note.trim() !== (currentNote ?? "").trim();

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-mood-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>Dagskänsla</p>
            <h2 id="week-mood-modal-title" className={styles.title}>
              {title}
            </h2>
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
          <p className={styles.prompt}>
            {drafting ? "Hur kändes dagen? Lägg till en kommentar?" : "Hur kändes dagen?"}
          </p>
          <div
            className={styles.options}
            role="radiogroup"
            aria-label="Dagskänsla"
          >
            {MOOD_OPTIONS.map((option) => {
              const active = selected === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={option.label}
                  title={option.label}
                  className={[styles.option, active ? styles.optionActive : ""]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => pick(option.key)}
                  disabled={pending}
                >
                  <span className={styles.optionIcon} aria-hidden>
                    {option.icon}
                  </span>
                  <span className={styles.optionLabel}>{option.label}</span>
                </button>
              );
            })}
          </div>

          {showComment ? (
            <div className={styles.comment}>
              <Input
                label="Kommentar (valfritt)"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="t.ex. Jobbigt möte, men fin kväll"
                maxLength={280}
                disabled={pending}
              />
              {drafting ? (
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={pending}
                    disabled={pending}
                    onClick={() => selected && persist(selected, note)}
                  >
                    Spara
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    fullWidth
                    disabled={pending}
                    onClick={() => selected && persist(selected, null)}
                  >
                    Hoppa över
                  </Button>
                </div>
              ) : null}
              {savedNoteDirty ? (
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={pending}
                    disabled={pending}
                    onClick={() => selected && persist(selected, note)}
                  >
                    Spara kommentar
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {currentMood && !drafting ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => persist(null, null)}
              disabled={pending}
            >
              Ta bort dagskänsla
            </button>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
