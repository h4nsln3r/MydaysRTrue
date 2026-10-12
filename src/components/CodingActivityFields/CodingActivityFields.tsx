"use client";

import {
  CODING_ACTIVITIES,
  CODING_ACTIVITY_ICON,
  CODING_ACTIVITY_LABEL,
  type CodingActivity,
} from "@/lib/tasks";
import styles from "@/components/GameFields/GameFields.module.scss";

interface Props {
  value: CodingActivity | null;
  onChange: (activity: CodingActivity) => void;
  disabled?: boolean;
  label?: string;
}

export function CodingActivityFields({
  value,
  onChange,
  disabled = false,
  label = "Vad ska du koda?",
}: Props) {
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <div className={styles.btns} role="radiogroup" aria-label={label}>
        {CODING_ACTIVITIES.map((activity) => {
          const active = value === activity;
          return (
            <button
              key={activity}
              type="button"
              role="radio"
              aria-checked={active}
              className={[styles.btn, active ? styles.btnActive : ""]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => onChange(activity)}
            >
              {CODING_ACTIVITY_ICON[activity]} {CODING_ACTIVITY_LABEL[activity]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
