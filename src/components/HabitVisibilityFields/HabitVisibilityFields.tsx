import {
  habitVisibilityParts,
  partVisibilityFor,
} from "@/lib/habit-parts";
import type { HabitKind, HabitVisibility } from "@/lib/habits";
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
  compact = false,
  onChange,
}: {
  value: HabitVisibility;
  disabled?: boolean;
  /** Checkbox whose save is still in flight. */
  savingKey?: keyof HabitVisibility | null;
  /** Shorter hint when these flags apply to one part, not the whole habit. */
  compact?: boolean;
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
        {compact
          ? "Avmarkerat döljer bara den här delen. Semester gäller även resor."
          : "Avmarkerat döljer uppgiften de dagarna. Semester gäller även resor. Ledig är perioder i årskalendern. Sjuk är när dagen är markerad Är sjuk. Helg är lördag och söndag."}
      </p>
    </div>
  );
}

export function HabitPartVisibilityList({
  habit,
  disabled,
  saving = null,
  onChange,
}: {
  habit: {
    kind: HabitKind | string;
    partVisibility: Record<string, HabitVisibility>;
  };
  disabled?: boolean;
  saving?: { partKey: string; key: keyof HabitVisibility } | null;
  onChange: (
    partKey: string,
    key: keyof HabitVisibility,
    checked: boolean,
  ) => void;
}) {
  const parts = habitVisibilityParts(habit);
  if (parts.length === 0) return null;

  return (
    <div className={styles.parts}>
      <p className={styles.partsLabel}>Delar</p>
      {parts.map((part) => {
        const savingThis = saving?.partKey === part.key;
        return (
          <div key={part.key} className={styles.part}>
            <p className={styles.partTitle}>
              <span aria-hidden>{part.icon}</span>
              {part.label}
            </p>
            <HabitVisibilityFields
              compact
              value={partVisibilityFor(habit.partVisibility, part.key)}
              disabled={disabled || (saving != null && !savingThis)}
              savingKey={savingThis ? saving.key : null}
              onChange={(key, checked) => onChange(part.key, key, checked)}
            />
          </div>
        );
      })}
    </div>
  );
}
