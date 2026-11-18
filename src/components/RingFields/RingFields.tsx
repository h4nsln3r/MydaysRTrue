"use client";

import { RING_MET_ICON, RING_PERSONS, type RingPerson } from "@/lib/calls";
import styles from "@/components/GameFields/GameFields.module.scss";

interface Props {
  value: RingPerson | null;
  onChange: (person: RingPerson) => void;
  /** Ring or met in person — shown when onMetChange is given. */
  met?: boolean;
  onMetChange?: (met: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function RingFields({
  value,
  onChange,
  met = false,
  onMetChange,
  disabled = false,
  label = "Vem ringer du?",
}: Props) {
  return (
    <>
      {onMetChange ? (
        <div className={styles.wrap}>
          <span className={styles.label}>Ring eller träff?</span>
          <div className={styles.btns} role="radiogroup" aria-label="Ring eller träff?">
            {[
              { met: false, label: "📞 Ring" },
              { met: true, label: `${RING_MET_ICON} Träffats` },
            ].map((option) => {
              const active = met === option.met;
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={[styles.btn, active ? styles.btnActive : ""]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={disabled}
                  onClick={() => onMetChange(option.met)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
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
    </>
  );
}
