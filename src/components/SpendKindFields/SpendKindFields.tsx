"use client";

import {
  SPEND_KIND_HINT,
  SPEND_KIND_ICON,
  SPEND_KIND_LABEL,
  type SpendKind,
} from "@/lib/tasks";
import styles from "@/components/MusicActivityFields/MusicActivityFields.module.scss";

interface Props {
  kinds: readonly SpendKind[];
  value: SpendKind | null;
  onChange: (kind: SpendKind | null) => void;
  disabled?: boolean;
  label?: string;
}

export function SpendKindFields({
  kinds,
  value,
  onChange,
  disabled = false,
  label = "Vad gäller det?",
}: Props) {
  const hint = value ? SPEND_KIND_HINT[value] : null;

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <div className={styles.btns}>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={[styles.btn, value === kind ? styles.btnActive : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={value === kind}
            disabled={disabled}
            onClick={() => onChange(kind)}
          >
            {SPEND_KIND_ICON[kind]} {SPEND_KIND_LABEL[kind]}
          </button>
        ))}
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
