"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import {
  MonthlyTaskEditForm,
  type MonthlyTaskEditValues,
} from "@/components/MonthlyTaskEditForm/MonthlyTaskEditForm";
import type { MonthlyTask, TaskCategory } from "@/lib/tasks";
import {
  archiveMonthlyTaskAction,
  createMonthlyTaskAction,
  updateMonthlyTaskAction,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [dayOfMonth, setDayOfMonth] = useState<string>("");
  const [icon, setIcon] = useState<string>(PRESET_ICONS[0]);
  const [accent, setAccent] = useState<string>(PRESET_ACCENTS[0]);
  const [error, setError] = useState<string | null>(null);

  const resetAdd = () => {
    setAdding(false);
    setTitle("");
    setCategoryId("");
    setDayOfMonth("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setError(null);
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let dom: number | null = null;
    if (dayOfMonth.trim()) {
      const n = Number(dayOfMonth);
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        setError("Dagen måste vara 1–31, eller lämna tom.");
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
        setError(res.error ?? "Kunde inte lägga till uppgiften.");
        return;
      }
      resetAdd();
      router.refresh();
    });
  };

  const saveEdit = (id: string, values: MonthlyTaskEditValues) => {
    setError(null);
    startTransition(async () => {
      const res = await updateMonthlyTaskAction({
        id,
        title: values.title,
        categoryId: values.categoryId,
        dayOfMonth: values.dayOfMonth,
        notes: values.notes,
        icon: values.icon,
        accent: values.accent,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveMonthlyTaskAction(id);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort uppgiften.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  };

  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className={styles.subBlock}>
      <header className={styles.subHeader}>
        <h4 className={styles.h4}>Månadsuppgifter</h4>
        <span className={styles.muted}>
          {tasks.length} {tasks.length === 1 ? "uppgift" : "uppgifter"}
        </span>
      </header>

      {tasks.length > 0 ? (
        <ul className={styles.habitList}>
          {tasks.map((t) => {
            const isEditing = editingId === t.id;
            const category = t.categoryId ? catById.get(t.categoryId) : null;
            const meta = [
              t.dayOfMonth ? `Dag ${t.dayOfMonth}` : "När som helst",
              category ? `${category.icon} ${category.name}` : "Ingen kategori",
            ].join(" · ");

            if (isEditing) {
              return (
                <li key={t.id} className={styles.habitItemEditing}>
                  <MonthlyTaskEditForm
                    task={t}
                    categories={categories}
                    pending={pending}
                    onSave={(values) => saveEdit(t.id, values)}
                    onDelete={() => remove(t.id)}
                    onCancel={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                  />
                  {error ? <p className={styles.error}>{error}</p> : null}
                </li>
              );
            }

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
                <button
                  type="button"
                  className={styles.habitEdit}
                  onClick={() => {
                    setEditingId(t.id);
                    setAdding(false);
                    setError(null);
                  }}
                  disabled={pending}
                  aria-label={`Redigera ${t.title}`}
                >
                  Redigera
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyNote}>
          Inga månadsuppgifter ännu. Lägg till hyra, räkningar, sparande m.m.
        </p>
      )}

      {adding ? (
        <form className={styles.habitForm} onSubmit={submitAdd}>
          <Input
            label="Namn"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="t.ex. Hyra"
            maxLength={80}
            autoFocus
            required
          />

          <Input
            label="Standarddag i månaden (valfritt)"
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            placeholder="t.ex. 1"
            hint="Lämna tom om uppgiften kan göras när som helst."
          />

          {categories.length > 0 ? (
            <div className={styles.habitFormBlock}>
              <label className={styles.label} htmlFor="monthly-task-category">
                Kategori
              </label>
              <select
                id="monthly-task-category"
                className={styles.select}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— Ingen kategori —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={styles.habitFormBlock}>
            <span className={styles.label}>Ikon</span>
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
            <span className={styles.label}>Färg</span>
            <div className={styles.habitAccentRow}>
              {PRESET_ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccent(c)}
                  aria-pressed={accent === c}
                  aria-label={`Färg ${c}`}
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
              onClick={resetAdd}
              disabled={pending}
            >
              Avbryt
            </Button>
            <Button type="submit" variant="primary" size="md" loading={pending}>
              Lägg till
            </Button>
          </div>
        </form>
      ) : editingId === null ? (
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => {
            setAdding(true);
            setError(null);
          }}
          fullWidth
        >
          + Lägg till månadsuppgift
        </Button>
      ) : null}
      {!adding && editingId === null && error ? (
        <p className={styles.error}>{error}</p>
      ) : null}
    </div>
  );
}
