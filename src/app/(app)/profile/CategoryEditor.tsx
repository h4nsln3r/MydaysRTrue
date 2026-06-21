"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import type { TaskCategory, TaskScope } from "@/lib/tasks";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/(app)/tasks-actions";
import styles from "./profile.module.scss";

const PRESET_ICONS = ["📁", "🏃", "🥗", "🏠", "💼", "🎵", "💸", "📚", "🧘", "🛠"];
const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
];

interface Props {
  scope: TaskScope;
  categories: TaskCategory[];
}

export function CategoryEditor({ scope, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Inline edit state for an existing category.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState(PRESET_ICONS[0]);
  const [editAccent, setEditAccent] = useState(PRESET_ACCENTS[0]);

  const reset = () => {
    setAdding(false);
    setName("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setError(null);
  };

  const startEdit = (c: TaskCategory) => {
    setError(null);
    setConfirmingId(null);
    setEditingId(c.id);
    setEditName(c.name);
    setEditIcon(c.icon);
    setEditAccent(c.accent);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createCategoryAction({ scope, name, icon, accent });
      if (!res.ok) {
        setError(res.error ?? "Could not add category.");
        return;
      }
      reset();
      router.refresh();
    });
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const res = await updateCategoryAction({
        id: editingId,
        name: editName,
        icon: editIcon,
        accent: editAccent,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not update category.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteCategoryAction(id);
      if (!res.ok) {
        setError(res.error ?? "Could not remove category.");
        return;
      }
      setConfirmingId(null);
      router.refresh();
    });
  };

  return (
    <div className={styles.subBlock}>
      <header className={styles.subHeader}>
        <h4 className={styles.h4}>Categories</h4>
        <span className={styles.muted}>
          {categories.length} {categories.length === 1 ? "group" : "groups"}
        </span>
      </header>

      {categories.length > 0 ? (
        <ul className={styles.categoryList}>
          {categories.map((c) => {
            const isConfirming = confirmingId === c.id;
            const isEditing = editingId === c.id;

            if (isEditing) {
              return (
                <li key={c.id} className={styles.categoryItemEditing}>
                  <form className={styles.habitForm} onSubmit={saveEdit}>
                    <Input
                      label="Category name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={32}
                      autoFocus
                      required
                    />

                    <div className={styles.habitFormBlock}>
                      <span className={styles.label}>Icon</span>
                      <div className={styles.habitIconRow}>
                        {PRESET_ICONS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setEditIcon(p)}
                            aria-pressed={editIcon === p}
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
                        {PRESET_ACCENTS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setEditAccent(col)}
                            aria-pressed={editAccent === col}
                            aria-label={`Use color ${col}`}
                            className={styles.habitAccentBtn}
                            style={{
                              background: col,
                              boxShadow:
                                editAccent === col ? `0 0 0 3px ${col}55` : undefined,
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
                        onClick={cancelEdit}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        loading={pending}
                      >
                        Save
                      </Button>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li key={c.id} className={styles.categoryItem}>
                <span
                  className={styles.categoryChip}
                  style={{ borderColor: c.accent }}
                >
                  <span className={styles.categoryIcon} aria-hidden>
                    {c.icon}
                  </span>
                  <span className={styles.categoryName}>{c.name}</span>
                </span>
                {isConfirming ? (
                  <span className={styles.habitConfirm}>
                    <button
                      type="button"
                      className={styles.habitConfirmYes}
                      onClick={() => remove(c.id)}
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
                  <span className={styles.categoryActions}>
                    <button
                      type="button"
                      className={styles.habitRemove}
                      onClick={() => startEdit(c)}
                      aria-label={`Edit ${c.name}`}
                      disabled={pending}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={styles.habitRemove}
                      onClick={() => setConfirmingId(c.id)}
                      aria-label={`Remove ${c.name}`}
                      disabled={pending}
                    >
                      ×
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyNote}>
          No categories yet. Add one to group your tasks.
        </p>
      )}

      {adding ? (
        <form className={styles.habitForm} onSubmit={submit}>
          <Input
            label="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Träning"
            maxLength={32}
            autoFocus
            required
          />

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
              Add category
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
          + Add category
        </Button>
      )}
      {!adding && editingId === null && error ? (
        <p className={styles.error}>{error}</p>
      ) : null}
    </div>
  );
}
