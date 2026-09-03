"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveDailyActivityAction } from "@/app/(app)/actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import { formatInteger } from "@/lib/format";
import styles from "./week-steps-modal.module.scss";

interface Props {
  date: string;
  currentSteps: number | null;
  stepsGoal: number;
  onClose: () => void;
}

export function WeekStepsLogDialog({
  date,
  currentSteps,
  stepsGoal,
  onClose,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stepsVal, setStepsVal] = useState(
    currentSteps != null ? String(currentSteps) : "",
  );
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    setStepsVal(currentSteps != null ? String(currentSteps) : "");
    setError(null);
  }, [currentSteps, date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close, date]);

  const persist = (next: number | null) => {
    setError(null);
    startTransition(async () => {
      const res = await saveDailyActivityAction({
        localDate: date,
        steps: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      close();
    });
  };

  const save = () => {
    if (pending) return;
    const trimmed = stepsVal.trim();
    if (trimmed === "") {
      persist(null);
      return;
    }
    const next = Math.round(Number(trimmed));
    if (!Number.isFinite(next) || next < 0 || next > 200000) {
      setError("Steg måste vara 0–200000.");
      return;
    }
    persist(next);
  };

  const title = `${formatWeekdayShort(date)} ${formatDayShort(date)}`;
  const hasSaved = currentSteps != null && currentSteps > 0;

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-steps-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>Steg</p>
            <h2 id="week-steps-modal-title" className={styles.title}>
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
          <p className={styles.goal}>
            Mål: {formatInteger(stepsGoal)} steg
          </p>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input
              ref={inputRef}
              label="Antal steg"
              type="number"
              min={0}
              max={200000}
              step={100}
              value={stepsVal}
              onChange={(e) => setStepsVal(e.target.value)}
              placeholder={`T.ex. ${formatInteger(stepsGoal)}`}
              inputMode="numeric"
              suffix="steg"
              disabled={pending}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              loading={pending}
              disabled={pending}
            >
              Spara steg
            </Button>
          </form>

          {hasSaved ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => persist(null)}
              disabled={pending}
            >
              Ta bort steg
            </button>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
