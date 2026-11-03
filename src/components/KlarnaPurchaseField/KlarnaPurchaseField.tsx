"use client";

import { KLARNA_NOTE_MAX } from "@/lib/tasks";
import styles from "./KlarnaPurchaseField.module.scss";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function KlarnaPurchaseField({ value, onChange, disabled }: Props) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>Köpen den här månaden</span>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, KLARNA_NOTE_MAX))}
        placeholder={"Skor 499 kr\nHörlurar 1 290 kr"}
        rows={5}
        maxLength={KLARNA_NOTE_MAX}
        disabled={disabled}
      />
      <span className={styles.hint}>
        En rad per köp, med vad det kostade. Är räkningen 0 kr lämnar du listan
        tom — då står det att du inte handlat något.
      </span>
    </label>
  );
}
