"use client";

import { useState } from "react";
import { WEEKDAY_SHORT, WEEKDAYS, type Weekday } from "@/lib/tasks";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

interface Props {
  currentWeekday: Weekday;
  pending: boolean;
  onMove: (weekday: Weekday) => void;
  onRemove: () => void;
}

export function DayPlanTrashMenu({
  currentWeekday,
  pending,
  onMove,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false);
  const days = WEEKDAYS.filter((day) => day !== currentWeekday);

  return (
    <>
      <button
        type="button"
        className={[styles.dayTrash, open ? styles.dayTrashOpen : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label="Flytta eller ta bort från veckan"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className={styles.relocate}>
          <span className={styles.relocateLabel}>Lägg på en annan dag</span>
          <div className={styles.dayChoices}>
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className={styles.dayChoice}
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  onMove(day);
                }}
              >
                {WEEKDAY_SHORT[day]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.removeWeekBtn}
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            Ta bort från veckan
          </button>
        </div>
      ) : null}
    </>
  );
}
