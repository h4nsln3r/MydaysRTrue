"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import type { MonthlyTask, TaskCategory } from "@/lib/tasks";
import {
  archiveMonthlyTaskAction,
  createMonthlyTaskAction,
  setMonthlyTaskCategoryAction,
} from "@/app/(app)/tasks-actions";
import styles from "./profile.module.scss";

const PRESET_ICONS = ["✓", "💸", "🧾", "🚗", "🏠", "📞", "📅", "🛠", "🩺", "🎁"];
const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
];

interface Props {
  tasks: MonthlyTask[];
  categories: TaskCategory[];
}

export function MonthlyTasksEditor({ tasks, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [dayOfMonth, setDayOfMonth] = useState<string>("");
  const [icon, setIcon] = useState<string>(PRESET_ICONS[0]);
  const [accent, setAccent] = useState<string>(PRESET_ACCENTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const reset = () => {
    setAdding(false);
    setTitle("");
    setCategoryId("");
    setDayOfMonth("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let dom: number | null = null;
    if (dayOfMonth.trim()) {
      const n = Number(dayOfMonth);
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        setError("Day of month must be 1–31, or leave it blank.");
        return;
      }
      dom = Math.round(n);
    }
    startTransition(async () => {
      const res = await createMonthlyTaskAction({
        title,
        categoryId: categoryId || null,
        dayOfMonth: dom,
        icon,
        accent,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not add task.");
        return;
      }
      reset();
      router.refresh();
    });
  };

  const archive = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveMonthlyTaskAction(id);
      if (!res.ok) {
        setError(res.error ?? "Could not remove task.");
        return;
      }
      setConfirmingId(null);
      router.refresh();
    });
  };

  const changeCategory = (taskId: string, nextCategoryId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await setMonthlyTaskCategoryAction({
        taskId,
        categoryId: nextCategoryId || null,
      });
      if (!res.ok) setError(res.error ?? "Could not update category.");
      router.refresh();
    });
  };

  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className={styles.subBlock}>
      <header className={styles.subHeader}>
        <h4 className={styles.h4}>Tasks</h4>
        <span className={styles.muted}>
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </header>

      {tasks.length > 0 ? (
        <ul className={styles.habitList}>
          {tasks.map((t) => {
            const isConfirming = confirmingId === t.id;
            const category = t.categoryId ? catById.get(t.categoryId) : null;
            const meta = [
              t.dayOfMonth ? `Day ${t.dayOfMonth}` : "Anytime",
              category ? `${category.icon} ${category.name}` : "No category",
            ].join(" · ");
            return (
              <li key={t.id} className={styles.habitItem}>
                <span
                  className={styles.habitIcon}
                  aria-hidden
                  style={{ borderColor: t.accent }}
                >
                  {t.icon}
                </span>
                <div className={styles.habitText}>
                  <span className={styles.habitLabel}>{t.title}</span>
                  <span className={styles.habitKind}>{meta}</span>
                </div>
                {categories.length > 0 ? (
                  <select
                    className={styles.habitCategorySelect}
                    value={t.categoryId ?? ""}
                    onChange={(e) => changeCategory(t.id, e.target.value)}
                    disabled={pending}
                    aria-label={`Category for ${t.title}`}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {isConfirming ? (
                  <span className={styles.habitConfirm}>
                    <button
                      type="button"
                      className={styles.habitConfirmYes}
                      onClick={() => archive(t.id)}
                      disabled={pending}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className={styles.habitConfirmNo}
                      onClick={() => setConfirmingId(null)}
                      disabled={pending}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.habitRemove}
                    onClick={() => setConfirmingId(t.id)}
                    aria-label={`Remove ${t.title}`}
                    disabled={pending}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyNote}>
          No monthly tasks yet. Add things you do every month — rent, dentist,
          car payment.
        </p>
      )}

      {adding ? (
        <form className={styles.habitForm} onSubmit={submit}>
          <Input
            label="Task name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Räkningar"
            maxLength={80}
            autoFocus
            required
          />

          <Input
            label="Day of month"
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            placeholder="optional, 1–31"
            hint="Leave blank if you can do it anytime in the month."
          />

          {categories.length > 0 ? (
            <div className={styles.habitFormBlock}>
              <label className={styles.label} htmlFor="monthly-task-category">
                Category
              </label>
              <select
                id="monthly-task-category"
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
              Add task
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
          + Add monthly task
        </Button>
      )}
      {!adding && error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
