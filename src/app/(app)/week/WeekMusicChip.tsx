"use client";

import { useCallback, useState } from "react";
import { WeekMusicLogDialog } from "./WeekMusicLogDialog";
import type { WeeklyTaskForWeek } from "@/lib/tasks";
import { musicSessionIcon, musicSessionTitle } from "@/lib/tasks";
import styles from "./week-progress.module.scss";

function cellClass(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface Props {
  task: WeeklyTaskForWeek;
  localDate: string;
}

export function WeekMusicChip({ task, localDate }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const done = Boolean(task.placement?.doneAt);
  const weekStart = task.placement?.weekStart;

  return (
    <>
      <li
        className={cellClass(
          styles.categoryTaskChip,
          styles.categoryTaskChipInteractive,
          done && styles.categoryTaskChipDone,
        )}
        title={`${musicSessionTitle(task, task.placement)} · Dubbelklicka för att ${done ? "ändra" : "logga"}`}
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
        <span aria-hidden>{musicSessionIcon(task, task.placement)}</span>
        <span className={styles.categoryTaskChipMark} aria-hidden>
          {done ? "✓" : "○"}
        </span>
      </li>
      {open && weekStart ? (
        <WeekMusicLogDialog
          task={task}
          weekStart={weekStart}
          localDate={localDate}
          onClose={close}
        />
      ) : null}
    </>
  );
}
