"use client";

import type { RescheduleDay } from "@/lib/use-day-reschedule";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

interface Props {
  isOverdue: boolean;
  days: RescheduleDay[];
  pending: boolean;
  onSelect: (value: string) => void;
}

export function TrainingRescheduleSelect({
  isOverdue,
  days,
  pending,
  onSelect,
}: Props) {
  return (
    <div className={styles.reschedule}>
      <span className={styles.rescheduleLabel}>
        {isOverdue ? "Försenad" : "Hinner du inte? Planera om"}
      </span>
      <select
        className={styles.rescheduleSelect}
        value=""
        disabled={pending}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Planera om uppgift"
      >
        <option value="" disabled>
          Planera om…
        </option>
        {days.map((d) => (
          <option key={d.weekday} value={String(d.weekday)}>
            {d.label}
          </option>
        ))}
        <option value="remove">Ta bort från veckoplanen</option>
      </select>
    </div>
  );
}
