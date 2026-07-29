"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MediaDayLogging } from "@/components/MediaDayLogging/MediaDayLogging";
import type { DailyMediaContext } from "@/lib/media";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import styles from "./week-media-modal.module.scss";

interface Props {
  date: string;
  context: DailyMediaContext;
  onClose: () => void;
}

export function WeekMediaLogDialog({ date, context, onClose }: Props) {
  const router = useRouter();
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

  const yearHref = `/year?y=${context.year}&view=plan`;
  const title = `${formatWeekdayShort(date)} ${formatDayShort(date)}`;

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-media-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>Läsa &amp; titta</p>
            <h2 id="week-media-modal-title" className={styles.title}>
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
          <MediaDayLogging
            date={date}
            media={context}
            yearHref={yearHref}
            variant="plan"
            onDone={() => router.refresh()}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
