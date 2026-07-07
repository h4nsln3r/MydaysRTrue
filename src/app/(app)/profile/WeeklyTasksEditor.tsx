"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import {
  groupTasksByCategory,
  type TaskCategory,
  type WeeklyTask,
} from "@/lib/tasks";
import {
  archiveWeeklyTaskAction,
  createWeeklyTaskAction,
  setWeeklyTaskCategoryAction,
} from "@/app/(app)/tasks-actions";
import styles from "./profile.module.scss";

const PRESET_ICONS = ["✓", "🏃", "🧺", "🛒", "📞", "📚", "💪", "🎵", "🧹", "🍳"];
const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
];

interface Props {
  tasks: WeeklyTask[];
  categories: TaskCategory[];
}

export function WeeklyTasksEditor({ tasks, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [icon, setIcon] = useState<string>(PRESET_ICONS[0]);
  const [accent, setAccent] = useState<string>(PRESET_ACCENTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const reset = () => {
    setAdding(false);
    setTitle("");
    setCategoryId("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createWeeklyTaskAction({
        title,
        categoryId: categoryId || null,
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

  const changeCategory = (taskId: string, nextCategoryId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await setWeeklyTaskCategoryAction({
        taskId,
        categoryId: nextCategoryId || null,
      });
      if (!res.ok) setError(res.error ?? "Could not update category.");
      router.refresh();
    });
  };

  const archive = (taskId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveWeeklyTaskAction(taskId);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort uppgiften.");
        return;
      }
      setConfirmingId(null);
      router.refresh();
    });
  };

  const groups = groupTasksByCategory(categories, tasks);

  return (
    <div className={styles.subBlock}>
      <header className={styles.subHeader}>
        <h4 className={styles.h4}>Tasks</h4>
        <span className={styles.muted}>
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"} · slå av/på under{" "}
          <a href="/profile/tasks" className={styles.inlineLink}>
            uppgifter per kategori
          </a>
        </span>
      </header>

      {tasks.length > 0 ? (
        <div className={styles.stack}>
          {groups.map((group) => (
            <section key={group.id} className={styles.categoryTasksGroup}>
              <header className={styles.categoryTasksHeader}>
                <span
                  className={styles.categoryTasksChip}
                  style={{
                    borderColor: group.category?.accent ?? undefined,
                    color: group.category?.accent ?? undefined,
                  }}
                >
                  <span aria-hidden>{group.category?.icon ?? "•"}</span>
                  <span>{group.category?.name ?? "Ingen kategori"}</span>
                </span>
                <span className={styles.muted}>{group.items.length}</span>
              </header>
              <ul className={styles.habitList}>
                {group.items.map((t) => {
                  const isConfirming = confirmingId === t.id;
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
                      </div>
                      <div className={styles.habitItemActions}>
                        {categories.length > 0 ? (
                          <select
                            className={styles.habitCategorySelect}
                            value={t.categoryId ?? ""}
                            onChange={(e) => changeCategory(t.id, e.target.value)}
                            disabled={pending}
                            aria-label={`Kategori för ${t.title}`}
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
                              aria-label={`Bekräfta borttagning av ${t.title}`}
                            >
                              Ta bort
                            </button>
                            <button
                              type="button"
                              className={styles.habitConfirmNo}
                              onClick={() => setConfirmingId(null)}
                              disabled={pending}
                              aria-label="Avbryt"
                            >
                              Avbryt
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={styles.habitRemove}
                            onClick={() => setConfirmingId(t.id)}
                            aria-label={`Ta bort ${t.title}`}
                            disabled={pending}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.emptyNote}>
          No weekly tasks yet. Add things you do every week — laundry,
          training, calls.
        </p>
      )}

      {adding ? (
        <form className={styles.habitForm} onSubmit={submit}>
          <Input
            label="Task name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tvätt"
            maxLength={80}
            autoFocus
            required
          />

          {categories.length > 0 ? (
            <div className={styles.habitFormBlock}>
              <label className={styles.label} htmlFor="weekly-task-category">
                Category
              </label>
              <select
                id="weekly-task-category"
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
          + Add weekly task
        </Button>
      )}
      {!adding && error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
