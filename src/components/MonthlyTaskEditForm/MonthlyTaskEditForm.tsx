"use client";

import { useState } from "react";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import type { MonthlyTask, TaskCategory } from "@/lib/tasks";
import { parseKrInput } from "@/lib/monthly-finance";
import { billsCategoryId } from "@/lib/monthly-bills";
import styles from "./MonthlyTaskEditForm.module.scss";

const PRESET_ICONS = ["✓", "💸", "🧾", "🚗", "🏠", "📞", "📅", "🛠", "🩺", "🎁", "⚡", "🌐", "💰", "📊"];
const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
];

export interface MonthlyTaskEditValues {
  title: string;
  categoryId: string | null;
  dayOfMonth: number | null;
  notes: string | null;
  icon: string;
  accent: string;
  defaultAmountKr: number | null;
}

interface Props {
  task: Pick<
    MonthlyTask,
    | "title"
    | "categoryId"
    | "dayOfMonth"
    | "notes"
    | "icon"
    | "accent"
    | "singleMonthStart"
    | "defaultAmountKr"
  >;
  categories: TaskCategory[];
  pending: boolean;
  onSave: (values: MonthlyTaskEditValues) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function MonthlyTaskEditForm({
  task,
  categories,
  pending,
  onSave,
  onDelete,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(task.categoryId ?? "");
  const [dayOfMonth, setDayOfMonth] = useState(
    task.dayOfMonth != null ? String(task.dayOfMonth) : "",
  );
  const [notes, setNotes] = useState(task.notes ?? "");
  const [icon, setIcon] = useState(task.icon);
  const [accent, setAccent] = useState(task.accent);
  const [defaultAmountKr, setDefaultAmountKr] = useState(
    task.defaultAmountKr != null ? String(task.defaultAmountKr) : "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billsCatId = billsCategoryId(categories);
  const showBillCost =
    billsCatId != null &&
    (categoryId === billsCatId || task.categoryId === billsCatId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Ange ett namn.");
      return;
    }
    let dom: number | null = null;
    if (dayOfMonth.trim()) {
      const n = Number(dayOfMonth);
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        setError("Dagen måste vara 1–31, eller lämna tom.");
        return;
      }
      dom = Math.round(n);
    }
    onSave({
      title: trimmed,
      categoryId: categoryId || null,
      dayOfMonth: dom,
      notes: notes.trim() || null,
      icon,
      accent,
      defaultAmountKr: showBillCost ? parseKrInput(defaultAmountKr) : null,
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.kicker}>
        {task.singleMonthStart ? "Engångsuppgift den här månaden" : "Redigera uppgift"}
      </p>

      <Input
        label="Namn"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        required
        disabled={pending}
      />

      <Input
        label="Standarddag i månaden (valfritt)"
        value={dayOfMonth}
        onChange={(e) => setDayOfMonth(e.target.value)}
        placeholder="t.ex. 1"
        inputMode="numeric"
        maxLength={2}
        disabled={pending}
        hint="Föreslagen dag varje månad — du kan fortfarande placera om per månad."
      />

      {categories.length > 0 ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="monthly-edit-category">
            Kategori
          </label>
          <select
            id="monthly-edit-category"
            className={styles.select}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={pending}
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

      <Input
        label="Anteckning (valfritt)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Beskrivning av uppgiften"
        maxLength={500}
        disabled={pending}
      />

      {showBillCost ? (
        <Input
          label="Månadskostnad (kr)"
          value={defaultAmountKr}
          onChange={(e) => setDefaultAmountKr(e.target.value)}
          placeholder="t.ex. 8500"
          inputMode="decimal"
          disabled={pending}
          hint="Standardbelopp varje månad — kan justeras per månad på uppgiften."
        />
      ) : null}

      <div className={styles.field}>
        <span className={styles.label}>Ikon</span>
        <div className={styles.iconRow}>
          {PRESET_ICONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setIcon(p)}
              aria-pressed={icon === p}
              className={styles.iconBtn}
              disabled={pending}
            >
              <span aria-hidden>{p}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Färg</span>
        <div className={styles.accentRow}>
          {PRESET_ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              aria-pressed={accent === c}
              aria-label={`Färg ${c}`}
              className={styles.accentBtn}
              style={{
                background: c,
                boxShadow: accent === c ? `0 0 0 3px ${c}55` : undefined,
              }}
              disabled={pending}
            />
          ))}
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={pending}>
          Avbryt
        </Button>
        <Button type="submit" variant="primary" size="md" loading={pending}>
          Spara
        </Button>
      </div>

      <div className={styles.deleteZone}>
        {confirmDelete ? (
          <div className={styles.deleteConfirm}>
            <p className={styles.deleteWarn}>
              Ta bort &quot;{task.title}&quot;? Detta går inte att ångra.
            </p>
            <div className={styles.deleteActions}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
              >
                Nej
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={pending}
                onClick={onDelete}
                className={styles.deleteBtn}
              >
                Ja, ta bort
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.deleteLink}
            onClick={() => setConfirmDelete(true)}
            disabled={pending}
          >
            Ta bort uppgift
          </button>
        )}
      </div>
    </form>
  );
}
