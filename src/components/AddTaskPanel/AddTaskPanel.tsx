"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createHabitAction } from "@/app/(app)/actions";
import {
  createMonthlyTaskAction,
  createOneOffMonthlyTaskAction,
  createOneOffWeeklyTaskAction,
  createWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { todayLocalISO } from "@/lib/date";
import {
  WEEKDAYS,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type TaskCategory,
  type TaskScope,
  type Weekday,
} from "@/lib/tasks";
import styles from "./AddTaskPanel.module.scss";

export const OPEN_WEEK_PLAN_ADD_TASK_EVENT = "mydays:open-week-plan-add-task";

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
  "🎲",
  "💸",
  "📅",
  "🥤",
];

const PRESET_ACCENTS = [
  "#ff7a1a",
  "#6ee7a3",
  "#ffcf3a",
  "#ff5247",
  "#5fb6ff",
  "#c084fc",
];

const SCOPE_LABEL: Record<"daily" | "weekly" | "monthly", string> = {
  daily: "Daglig",
  weekly: "Veckovis",
  monthly: "Månadsvis",
};

type WizardStep = "title" | "day" | "look";

const WIZARD_STEPS: WizardStep[] = ["title", "day", "look"];

const WIZARD_TITLE: Record<WizardStep, string> = {
  title: "Vad ska du göra?",
  day: "Vilken dag?",
  look: "Utseende",
};

interface Props {
  categories: TaskCategory[];
  /** Pre-select scope based on which plan page we're on. */
  defaultScope?: TaskScope;
  /** Hide scope picker and only allow weekly tasks (veckoplan). */
  weeklyOnly?: boolean;
  /** Lighter layout when embedded in the week board. */
  embedded?: boolean;
  /** Current week (Monday) — enables the "only this week" one-off option. */
  weekStart?: string;
  /** Current month (YYYY-MM-01) — enables the "only this month" one-off option. */
  monthStart?: string;
  /** Allow creating a one-off task that only exists for `weekStart`. */
  allowOneOff?: boolean;
  /** Open via header button / custom event as a stepped modal. */
  externalTrigger?: boolean;
}

export function AddTaskPanel({
  categories,
  defaultScope = "weekly",
  weeklyOnly = false,
  embedded = false,
  weekStart,
  monthStart,
  allowOneOff = false,
  externalTrigger = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("title");
  const [mounted, setMounted] = useState(false);
  const [scope, setScope] = useState<TaskScope>(
    weeklyOnly ? "weekly" : defaultScope,
  );
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);
  const [oneOff, setOneOff] = useState(false);
  const [weekday, setWeekday] = useState<Weekday | null>(null);
  const [intervalDays, setIntervalDays] = useState(1);
  const [intervalAnchorDate, setIntervalAnchorDate] = useState(todayLocalISO());
  const [error, setError] = useState<string | null>(null);

  const canOneOffWeekly = allowOneOff && weekStart != null && scope === "weekly";
  const canOneOffMonthly =
    allowOneOff && monthStart != null && scope === "monthly" && !weeklyOnly;
  const forceOneOffWeekly = weeklyOnly && weekStart != null;
  const canOneOff = canOneOffWeekly || canOneOffMonthly;
  const placingOneOff = forceOneOffWeekly || (canOneOffWeekly && oneOff);

  const scopeCategories = useMemo(() => {
    const catScope = scope === "daily" ? "daily" : "task";
    return categories.filter((c) => c.scope === catScope);
  }, [categories, scope]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!externalTrigger) return;
    const onOpen = () => {
      setStep("title");
      setOpen(true);
    };
    window.addEventListener(OPEN_WEEK_PLAN_ADD_TASK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WEEK_PLAN_ADD_TASK_EVENT, onOpen);
  }, [externalTrigger]);

  const reset = useCallback(() => {
    setOpen(false);
    setStep("title");
    setTitle("");
    setCategoryId("");
    setDayOfMonth("");
    setIcon(PRESET_ICONS[0]);
    setAccent(PRESET_ACCENTS[0]);
    setOneOff(false);
    setWeekday(null);
    setIntervalDays(1);
    setIntervalAnchorDate(todayLocalISO());
    setError(null);
    setScope(weeklyOnly ? "weekly" : defaultScope);
  }, [weeklyOnly, defaultScope]);

  useEffect(() => {
    if (!externalTrigger || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) reset();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [externalTrigger, open, pending, reset]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Ange ett namn.");
      setStep("title");
      return;
    }

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
          intervalDays,
          intervalAnchorDate: intervalDays > 1 ? intervalAnchorDate : null,
        });
      } else if (scope === "weekly") {
        res =
          forceOneOffWeekly || (canOneOffWeekly && oneOff && weekStart)
            ? await createOneOffWeeklyTaskAction({
                title,
                weekStart: weekStart!,
                categoryId: categoryId || null,
                weekday: placingOneOff ? weekday : null,
                icon,
                accent,
              })
            : await createWeeklyTaskAction({
                title,
                categoryId: categoryId || null,
                icon,
                accent,
              });
      } else {
        res =
          canOneOffMonthly && oneOff && monthStart
            ? await createOneOffMonthlyTaskAction({
                title,
                monthStart,
                categoryId: categoryId || null,
                dayOfMonth: dom,
                icon,
                accent,
              })
            : await createMonthlyTaskAction({
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

  const stepIndex = WIZARD_STEPS.indexOf(step);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex >= WIZARD_STEPS.length - 1;

  const goNext = () => {
    setError(null);
    if (step === "title" && !title.trim()) {
      setError("Ange ett namn.");
      return;
    }
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    setError(null);
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const titleField = (
    <Input
      label={titleLabel}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder={titlePlaceholder}
      maxLength={scope === "daily" ? 32 : 80}
      autoFocus
      required
    />
  );

  const dayField = placingOneOff ? (
    <div className={styles.field}>
      <span className={styles.label} id="add-task-weekday-label">
        Dag
      </span>
      <div
        className={styles.weekdayRow}
        role="radiogroup"
        aria-labelledby="add-task-weekday-label"
      >
        {WEEKDAYS.map((day) => {
          const selected = weekday === day;
          return (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={selected}
              className={[
                styles.weekdayBtn,
                selected ? styles.weekdayBtnActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={pending}
              onClick={() => setWeekday(selected ? null : day)}
            >
              {WEEKDAY_SHORT[day]}
            </button>
          );
        })}
      </div>
      <p className={styles.weekdayHint}>
        {weekday == null
          ? "Välj en dag, eller lämna tom så hamnar den i veckoaktiviteterna."
          : `Läggs på ${WEEKDAY_LONG[weekday].toLowerCase()}.`}
      </p>
    </div>
  ) : null;

  const lookFields = (
    <>
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
    </>
  );

  if (externalTrigger) {
    if (!open || !mounted) return null;

    return createPortal(
      <div
        className={styles.backdrop}
        onClick={() => {
          if (!pending) reset();
        }}
      >
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-task-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.modalHeader}>
            {!isFirstStep ? (
              <button
                type="button"
                className={styles.modalBack}
                onClick={goBack}
                disabled={pending}
              >
                Tillbaka
              </button>
            ) : (
              <span className={styles.modalHeaderSpacer} />
            )}
            <h2 id="add-task-modal-title" className={styles.modalTitle}>
              {WIZARD_TITLE[step]}
            </h2>
            <div className={styles.modalHeaderEnd}>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => {
                  if (!pending) reset();
                }}
                disabled={pending}
                aria-label="Stäng"
              >
                ×
              </button>
            </div>
          </header>

          <div className={styles.stepDots} aria-hidden>
            {WIZARD_STEPS.map((s) => (
              <span
                key={s}
                className={[
                  styles.stepDot,
                  s === step ? styles.stepDotActive : "",
                  WIZARD_STEPS.indexOf(s) < stepIndex
                    ? styles.stepDotDone
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </div>

          <form
            className={styles.modalBody}
            onSubmit={(e) => {
              e.preventDefault();
              if (isLastStep) submit();
              else goNext();
            }}
          >
            {step === "title" ? titleField : null}
            {step === "day" ? dayField : null}
            {step === "look" ? lookFields : null}

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
              {isLastStep ? (
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={pending}
                >
                  Lägg till
                </Button>
              ) : (
                <Button type="submit" variant="primary" size="md">
                  Nästa
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>,
      document.body,
    );
  }

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
              ? "Skapar en engångsuppgift för den här veckan — välj vilken dag den ska ligga på"
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

          {titleField}

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

          {scope === "daily" ? (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-task-cadence">
                  Återkomst
                </label>
                <select
                  id="add-task-cadence"
                  className={styles.select}
                  value={intervalDays}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setIntervalDays(next);
                    if (next > 1 && !intervalAnchorDate) {
                      setIntervalAnchorDate(todayLocalISO());
                    }
                  }}
                >
                  <option value={1}>Varje dag</option>
                  <option value={2}>Varannan dag</option>
                </select>
              </div>
              {intervalDays > 1 ? (
                <Input
                  label="Startar"
                  type="date"
                  value={intervalAnchorDate}
                  onChange={(e) => setIntervalAnchorDate(e.target.value)}
                  required
                  hint="Visas den dagen och sedan varannan dag"
                />
              ) : null}
            </>
          ) : null}

          {lookFields}
          {dayField}

          {canOneOff && !forceOneOffWeekly ? (
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={oneOff}
                onChange={(e) => setOneOff(e.target.checked)}
              />
              <span className={styles.checkText}>
                {scope === "monthly" ? "Bara den här månaden" : "Bara den här veckan"}
                <span className={styles.checkHint}>
                  {scope === "monthly"
                    ? "Engångsräkning — återkommer inte nästa månad"
                    : "Engångsuppgift — återkommer inte nästa vecka"}
                </span>
              </span>
            </label>
          ) : null}

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
