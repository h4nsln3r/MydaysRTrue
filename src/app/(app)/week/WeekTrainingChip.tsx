"use client";

import { useCallback, useState } from "react";
import {
  WeekTrainingLogDialog,
  type AnyTrainingSession,
  type WeekTrainingType,
} from "./WeekTrainingLogDialog";
import styles from "./week-progress.module.scss";

function cellClass(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface ChipMeta {
  icon: string;
  done: boolean;
  title: string;
  warmupIcon?: string;
}

interface Props {
  type: WeekTrainingType;
  session: AnyTrainingSession;
  meta: ChipMeta;
  chipClass?: string;
}

export function WeekTrainingChip({ type, session, meta, chipClass }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <li
        className={cellClass(
          styles.sessionChip,
          styles.sessionChipInteractive,
          chipClass,
          meta.done && styles.sessionChipDone,
        )}
        title={`${meta.title} · Dubbelklicka för att ${meta.done ? "ändra" : "logga"}`}
        role="button"
        tabIndex={0}
        onDoubleClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden>{meta.icon}</span>
        {meta.warmupIcon ? (
          <span className={styles.warmupCorner} aria-hidden>
            {meta.warmupIcon}
          </span>
        ) : null}
        {meta.done ? (
          <span className={styles.sessionCheck} aria-hidden>
            ✓
          </span>
        ) : (
          <span className={styles.sessionPending} aria-hidden>
            ○
          </span>
        )}
      </li>
      {open ? (
        <WeekTrainingLogDialog type={type} session={session} onClose={close} />
      ) : null}
    </>
  );
}
