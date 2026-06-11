"use client";

import { WEEKDAY_LONG, WEEKDAYS, type Weekday } from "@/lib/tasks";
import styles from "./DefaultWeekdaySelect.module.scss";

interface Props {
  id: string;
  value: Weekday | null;
  onChange: (weekday: Weekday | null) => void;
  disabled?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
}

export function DefaultWeekdaySelect({
  id,
  value,
  onChange,
  disabled = false,
  allowNone = true,
  noneLabel = "Ingen standard",
}: Props) {
  return (
    <select
      id={id}
      className={styles.select}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw ? (Number(raw) as Weekday) : null);
      }}
      disabled={disabled}
      aria-label="Standarddag i veckan"
    >
      {allowNone ? <option value="">{noneLabel}</option> : null}
      {WEEKDAYS.map((d) => (
        <option key={d} value={d}>
          {WEEKDAY_LONG[d]}
        </option>
      ))}
    </select>
  );
}
