"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./week-log-modal.module.scss";

export type WeekLogAccent = "default" | "water" | "food" | "activity" | "habit";

interface Props {
  kicker: string;
  title: string;
  labelledBy: string;
  accent?: WeekLogAccent;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function WeekLogDialogShell({
  kicker,
  title,
  labelledBy,
  accent = "default",
  wide = false,
  onClose,
  children,
}: Props) {
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

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={[
          styles.modal,
          wide ? styles.modalWide : "",
          styles[`accent_${accent}`],
        ]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>{kicker}</p>
            <h2 id={labelledBy} className={styles.title}>
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
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
