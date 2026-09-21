"use client";

import { RING_PERSONS, type RingPerson } from "@/lib/calls";
import styles from "@/components/GameFields/GameFields.module.scss";

interface Props {
  value: RingPerson | null;
  onChange: (person: RingPerson) => void;
  disabled?: boolean;
  label?: string;
}

export function RingFields({
  value,
  onChange,
  disabled = false,
  label = "Vem ringer du?",
}: Props) {
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <div className={styles.btns} role="radiogroup" aria-label={label}>
        {RING_PERSONS.map((p) => {
          const active = value === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={[styles.btn, active ? styles.btnActive : ""]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => onChange(p.key)}
            >
              {p.icon} {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
