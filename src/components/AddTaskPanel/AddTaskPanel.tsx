"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHabitAction } from "@/app/(app)/actions";
import {
  createMonthlyTaskAction,
  createWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import type { TaskCategory, TaskScope } from "@/lib/tasks";
import styles from "./AddTaskPanel.module.scss";

const PRESET_ICONS = [
  "✓",
  "🏃",
  "🧺",
  "🛒",
  "📞",
  "📚",
  "💪",
  "🎵",
  "🧹",
  "🍳",
  "💸",
  "📅",
];

const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
];

const SCOPE_LABEL: Record<TaskScope, string> = {
  daily: "Daglig",
  weekly: "Veckovis",
  monthly: "Månadsvis",
};

interface Props {
  categories: TaskCategory[];
  /** Pre-select scope based on which plan page we're on. */
  defaultScope?: TaskScope;
  /** Hide scope picker and only allow weekly tasks (veckoplan). */
  weeklyOnly?: boolean;
  /** Lighter layout when embedded in the week board. */
  embedded?: boolean;
}

export function AddTaskPanel({
  categories,
  defaultScope = "weekly",
  weeklyOnly = false,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<TaskScope>(
    weeklyOnly ? "weekly" : defaultScope,
  );
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);
  const [error, setError] = useState<string | null>(null);

  // Weekly + monthly tasks share one 'task' category set; daily habits use 'daily'.
  const scopeCategories = useMemo(() => {
    const catScope = scope === "daily" ? "daily" : "task";
    return categories.filter((c) => c.scope === catScope);
  }, [categories, scope]);

  const reset = () => {
    setOpen(false);
    setTitle("");
    setCategoryId("");
    setDayOfMonth("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setError(null);
    setScope(weeklyOnly ? "weekly" : defaultScope);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let dom: number | null = null;
    if (scope === "monthly" && dayOfMonth.trim()) {
      const n = Number(dayOfMonth);
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        setError("Dagen i månaden måste vara 1–31, eller lämna tom.");
        return;
      }
      dom = Math.round(n);
    }

    startTransition(async () => {
      let res: { ok: boolean; error?: string };

      if (scope === "daily") {
        res = await createHabitAction({
          label: title,
          icon,
          accent,
          categoryId: categoryId || null,
        });
      } else if (scope === "weekly") {
        res = await createWeeklyTaskAction({
          title,
          categoryId: categoryId || null,
          icon,
          accent,
        });
      } else {
        res = await createMonthlyTaskAction({
          title,
          categoryId: categoryId || null,
          dayOfMonth: dom,
          icon,
          accent,
        });
      }

      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till uppgiften.");
        return;
      }
      reset();
      router.refresh();
    });
  };

  const titleLabel =
    scope === "daily" ? "Namn på vanan" : "Uppgiftens namn";

  const titlePlaceholder =
    scope === "daily"
      ? "t.ex. Meditera"
      : scope === "weekly"
        ? "t.ex. Tvätt"
        : "t.ex. Betala hyra";

  return (
    <section
      className={[styles.panel, embedded ? styles.panelEmbedded : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {!embedded ? (
        <header className={styles.header}>
          <h2 className={styles.title}>Lägg till uppgift</h2>
          <p className={styles.sub}>
            {weeklyOnly
              ? "Skapar en uppgift under knappen — dra den till en veckodag"
              : "Dagliga vanor, veckouppgifter eller månadsuppgifter"}
          </p>
        </header>
      ) : null}

      {open ? (
        <form className={styles.form} onSubmit={submit}>
          {!weeklyOnly ? (
            <div className={styles.scopeRow} role="radiogroup" aria-label="Typ">
              {(["daily", "weekly", "monthly"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scope === s}
                  className={[
                    styles.scopeBtn,
                    scope === s ? styles.scopeBtnActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setScope(s);
                    setCategoryId("");
                  }}
                  disabled={pending}
                >
                  {SCOPE_LABEL[s]}
                </button>
              ))}
            </div>
          ) : null}

          <Input
            label={titleLabel}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={titlePlaceholder}
            maxLength={scope === "daily" ? 32 : 80}
            autoFocus
            required
          />

          {scope === "monthly" ? (
            <Input
              label="Dag i månaden (valfritt)"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="t.ex. 25"
              inputMode="numeric"
              maxLength={2}
            />
          ) : null}

          {scopeCategories.length > 0 ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="add-task-category">
                Kategori
              </label>
              <select
                id="add-task-category"
                className={styles.select}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— Ingen kategori —</option>
                {scopeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
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
                />
              ))}
            </div>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.actions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={reset}
              disabled={pending}
            >
              Avbryt
            </Button>
            <Button type="submit" variant="primary" size="md" loading={pending}>
              Lägg till
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="md"
          fullWidth
          onClick={() => setOpen(true)}
        >
          {embedded ? "+ Lägg till uppgift" : "+ Ny uppgift"}
        </Button>
      )}
    </section>
  );
}
