"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateDayCompletionAction } from "@/app/(app)/completions-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import type { DayCompletion } from "@/lib/completions";
import styles from "./CompletionQuickEdit.module.scss";

interface Props {
  item: DayCompletion;
  className?: string;
}

/** Pencil that opens a modal to edit completion date + comment. */
export function CompletionQuickEdit({ item, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={[styles.pencil, className].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
        aria-label={`Redigera ${item.title}`}
      >
        ✎
      </button>
      {open ? (
        <CompletionEditModal item={item} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function CompletionEditModal({
  item,
  onClose,
}: {
  item: DayCompletion;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  const [date, setDate] = useState(item.date);
  const [note, setNote] = useState(item.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setDate(item.date);
    setNote(item.note ?? "");
    setError(null);
  }, [item.id, item.date, item.note]);

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

  const dirty =
    date !== item.date || note.trim() !== (item.note ?? "").trim();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateDayCompletionAction({
        domain: item.domain,
        entityId: item.entityId,
        date,
        note,
        title: item.title,
        subtitle: item.subtitle,
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
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>{item.subtitle}</p>
            <h2 id={titleId} className={styles.title}>
              {item.title}
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
          <Input
            label="Klart den"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
          />
          <label className={styles.noteField}>
            <span className={styles.noteLabel}>Kommentar</span>
            <textarea
              className={styles.noteTextarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="valfritt — sparas i dagboken"
              maxLength={280}
              rows={4}
              disabled={pending}
            />
          </label>
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
