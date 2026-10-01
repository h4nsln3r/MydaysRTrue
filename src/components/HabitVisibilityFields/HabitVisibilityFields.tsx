import type { HabitVisibility } from "@/lib/habits";
import styles from "./HabitVisibilityFields.module.scss";

const OPTIONS: { key: keyof HabitVisibility; label: string }[] = [
  { key: "showOnVacation", label: "Visa på semester och resa" },
  { key: "showOnDayOff", label: "Visa när ledig" },
  { key: "showOnSick", label: "Visa när sjuk" },
  { key: "showOnWeekend", label: "Visa på helg" },
];

export function HabitVisibilityFields({
  value,
  disabled,
  savingKey = null,
  onChange,
}: {
  value: HabitVisibility;
  disabled?: boolean;
  /** Checkbox whose save is still in flight. */
  savingKey?: keyof HabitVisibility | null;
  onChange: (key: keyof HabitVisibility, checked: boolean) => void;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        {OPTIONS.map((option) => {
          const saving = savingKey === option.key;
          return (
            <label
              key={option.key}
              className={[styles.option, saving ? styles.optionSaving : ""]
                .filter(Boolean)
                .join(" ")}
              aria-busy={saving || undefined}
            >
              <input
                type="checkbox"
                checked={value[option.key]}
                disabled={disabled || savingKey != null}
                onChange={(e) => onChange(option.key, e.target.checked)}
              />
              {option.label}
              {saving ? (
                <span className={styles.saving}>
                  <span className={styles.spinner} aria-hidden />
                  Sparar
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <p className={styles.hint}>
        Avmarkerat döljer uppgiften de dagarna. Semester gäller även resor.
        Ledig är perioder i årskalendern. Sjuk är när dagen är markerad Är
        sjuk. Helg är lördag och söndag.
      </p>
    </div>
  );
}
