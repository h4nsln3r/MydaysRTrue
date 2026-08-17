"use client";

import { WEEKDAYS, WEEKDAY_SHORT, type Weekday } from "@/lib/tasks";
import styles from "./WeekdayChips.module.scss";

interface Props {
  value: Weekday[];
  onChange: (next: Weekday[]) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

export function WeekdayChips({
  value,
  onChange,
  disabled = false,
  label = "Veckodagar",
  hint,
}: Props) {
  const selected = new Set(value);

  const toggle = (day: Weekday) => {
    const next = selected.has(day)
      ? value.filter((d) => d !== day)
      : [...value, day].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <div className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.row} role="group" aria-label={label || "Veckodagar"}>
        {WEEKDAYS.map((day) => {
          const on = selected.has(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              className={[styles.chip, on ? styles.chipOn : ""].filter(Boolean).join(" ")}
              onClick={() => toggle(day)}
              disabled={disabled}
            >
              {WEEKDAY_SHORT[day]}
            </button>
          );
        })}
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
