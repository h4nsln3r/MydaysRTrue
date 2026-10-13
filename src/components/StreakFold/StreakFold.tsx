"use client";

import { useState, type ReactNode } from "react";
import styles from "./StreakFold.module.scss";

interface Props {
  label: string;
  children: ReactNode;
}

export function StreakFold({ label, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.box}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <span
          className={[styles.chevron, open ? styles.chevronOpen : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? <div className={styles.result}>{children}</div> : null}
    </div>
  );
}

export function StreakStat({
  icon,
  count,
  label,
}: {
  icon: string;
  count: number;
  label: string;
}) {
  return (
    <span className={styles.item} title={label} aria-label={label}>
      <span className={styles.struck} aria-hidden>
        {icon}
      </span>
      <span className={styles.count} aria-hidden>
        {count}
      </span>
    </span>
  );
}
