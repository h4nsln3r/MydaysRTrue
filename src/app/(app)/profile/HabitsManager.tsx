"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import type { Habit } from "@/lib/habits";
import type { TaskCategory } from "@/lib/tasks";
import { archiveHabitAction, createHabitAction } from "@/app/(app)/actions";
import { setHabitCategoryAction } from "@/app/(app)/tasks-actions";
import styles from "./profile.module.scss";

const PRESET_ICONS = ["✓", "🚭", "🍭", "🏃", "📚", "🧘", "💪", "🌙", "🥗", "☕"];
const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
];

interface Props {
  habits: Habit[];
  categories: TaskCategory[];
}

export function HabitsManager({ habits, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [icon, setIcon] = useState<string>("✓");
  const [accent, setAccent] = useState<string>(PRESET_ACCENTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const catById = new Map(categories.map((c) => [c.id, c]));

  const reset = () => {
    setAdding(false);
    setLabel("");
    setCategoryId("");
    setIcon("✓");
    setAccent(PRESET_ACCENTS[0]);
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createHabitAction({
        label,
        icon,
        accent,
        categoryId: categoryId || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not add habit.");
        return;
      }
      reset();
      router.refresh();
    });
  };

  const archive = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveHabitAction(id);
      if (!res.ok) {
        setError(res.error ?? "Could not remove habit.");
        return;
      }
      setConfirmingId(null);
      router.refresh();
    });
  };

  const changeCategory = (habitId: string, nextCategoryId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await setHabitCategoryAction({
        habitId,
        categoryId: nextCategoryId || null,
      });
      if (!res.ok) setError(res.error ?? "Could not update category.");
      router.refresh();
    });
  };

  return (
    <div className={styles.habitsWrap}>
      <ul className={styles.habitList}>
        {habits.map((h) => {
          const isConfirming = confirmingId === h.id;
          const isWater = h.kind === "water";
          const category = h.categoryId ? catById.get(h.categoryId) : null;
          return (
            <li key={h.id} className={styles.habitItem}>
              <span
                className={styles.habitIcon}
                aria-hidden
                style={{ borderColor: h.accent }}
              >
                {h.icon}
              </span>
              <div className={styles.habitText}>
                <span className={styles.habitLabel}>{h.label}</span>
                <span className={styles.habitKind}>
                  {isWater
                    ? "Water · auto"
                    : category
                      ? `${category.icon} ${category.name}`
                      : "Yes / Half / No"}
                </span>
              </div>
              {!isWater && categories.length > 0 ? (
                <select
                  className={styles.habitCategorySelect}
                  value={h.categoryId ?? ""}
                  onChange={(e) => changeCategory(h.id, e.target.value)}
                  disabled={pending}
                  aria-label={`Category for ${h.label}`}
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {isWater ? (
                <span className={styles.habitLocked} aria-hidden>
                  built-in
                </span>
              ) : isConfirming ? (
                <span className={styles.habitConfirm}>
                  <button
                    type="button"
                    className={styles.habitConfirmYes}
                    onClick={() => archive(h.id)}
                    disabled={pending}
                    aria-label="Confirm remove"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className={styles.habitConfirmNo}
                    onClick={() => setConfirmingId(null)}
                    disabled={pending}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.habitRemove}
                  onClick={() => setConfirmingId(h.id)}
                  aria-label={`Remove ${h.label}`}
                  disabled={pending}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form className={styles.habitForm} onSubmit={submit}>
          <Input
            label="Habit name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 8K steg"
            maxLength={32}
            autoFocus
            required
          />

          {categories.length > 0 ? (
            <div className={styles.habitFormBlock}>
              <label className={styles.label} htmlFor="habit-category">
                Category
              </label>
              <select
                id="habit-category"
                className={styles.select}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— No category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={styles.habitFormBlock}>
            <span className={styles.label}>Icon</span>
            <div className={styles.habitIconRow}>
              {PRESET_ICONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setIcon(p)}
                  aria-pressed={icon === p}
                  className={styles.habitIconBtn}
                >
                  <span aria-hidden>{p}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.habitFormBlock}>
            <span className={styles.label}>Accent</span>
            <div className={styles.habitAccentRow}>
              {PRESET_ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccent(c)}
                  aria-pressed={accent === c}
                  aria-label={`Use color ${c}`}
                  className={styles.habitAccentBtn}
                  style={{
                    background: c,
                    boxShadow: accent === c ? `0 0 0 3px ${c}55` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.habitFormActions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={reset}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={pending}>
              Add habit
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setAdding(true)}
          fullWidth
        >
          + Add habit
        </Button>
      )}
      {!adding && error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
