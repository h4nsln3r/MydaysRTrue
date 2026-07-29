"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveMoodDailyLogAction } from "@/app/(app)/mood-actions";
import { MOOD_OPTIONS, type MoodKey } from "@/lib/mood";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import styles from "./week-mood-modal.module.scss";

interface Props {
  date: string;
  currentMood: MoodKey | null;
  onClose: () => void;
}

export function WeekMoodLogDialog({ date, currentMood, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => onClose(), [onClose]);

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

  const save = (mood: MoodKey | null) => {
    setError(null);
    startTransition(async () => {
      const res = await saveMoodDailyLogAction({ localDate: date, mood });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      close();
    });
  };

  const title = `${formatWeekdayShort(date)} ${formatDayShort(date)}`;

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
          <p className={styles.prompt}>Hur kändes dagen?</p>
          <div
            className={styles.options}
            role="radiogroup"
            aria-label="Dagskänsla"
          >
            {MOOD_OPTIONS.map((option) => {
              const active = currentMood === option.key;
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
                  onClick={() => save(active ? null : option.key)}
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

          {currentMood ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => save(null)}
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
