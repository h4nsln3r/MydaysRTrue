"use client";

import { CARDIO_KINDS, type CardioKind } from "@/lib/cardio";
import styles from "@/components/GameFields/GameFields.module.scss";

interface Props {
  value: CardioKind | null;
  onChange: (kind: CardioKind) => void;
  disabled?: boolean;
  label?: string;
}

export function CardioFields({
  value,
  onChange,
  disabled = false,
  label = "Vilken sorts cardio?",
}: Props) {
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <div className={styles.btns} role="radiogroup" aria-label={label}>
        {CARDIO_KINDS.map((k) => {
          const active = value === k.key;
          return (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={[styles.btn, active ? styles.btnActive : ""]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => onChange(k.key)}
            >
              {k.icon} {k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
