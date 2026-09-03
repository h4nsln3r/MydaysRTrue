"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  logWaterAction,
  saveDailyActivityAction,
  saveSnackAction,
  setHabitStatusAction,
} from "@/app/(app)/actions";
import { clearIntakeAction, saveIntakeAction } from "@/app/(app)/intake-actions";
import { saveMobileGamesDailyLogAction } from "@/app/(app)/mobile-games-actions";
import { saveSmokeFreeDailyLogAction } from "@/app/(app)/smoke-free-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { formatDayShort, formatWeekdayShort } from "@/lib/date";
import {
  MEAL_ICON,
  MEAL_ORDER,
  SNACK_ICON,
  SNACK_LABEL,
  SNACK_SLOTS,
  nextHabitStatus,
  type HabitStatus,
  type MealKey,
  type SnackEntry,
  type SnackSlot,
} from "@/lib/habits";
import {
  INTAKE_DESCRIPTION_LABEL,
  INTAKE_DESCRIPTION_PLACEHOLDER,
  INTAKE_HAS_WATER,
  INTAKE_ICON,
  INTAKE_LABEL,
  INTAKE_REQUIRES_DESCRIPTION,
  applicableIntakeKinds,
  type IntakeKind,
} from "@/lib/intake";
import type { WeekMealDay } from "@/lib/meal-box.server";
import {
  MOBILE_GAME_STEPS,
  type DailyMobileGamesContext,
  type MobileGameKey,
} from "@/lib/mobile-games";
import {
  SMOKE_FREE_SUBSTANCES,
  type SmokeFreeSubstance,
} from "@/lib/smoke-free";
import { QUICK_ADDS, formatMl } from "@/lib/water";
import { WeekLogDialogShell } from "./WeekLogDialogShell";
import styles from "./week-log-modal.module.scss";

const MEAL_LABEL_SV: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
};

const CHOICES: { value: HabitStatus; label: string }[] = [
  { value: "yes", label: "Ja" },
  { value: "half", label: "½" },
  { value: "no", label: "Nej" },
];

function dayTitle(date: string): string {
  return `${formatWeekdayShort(date)} ${formatDayShort(date)}`;
}

export function WeekWaterLogDialog({
  date,
  totalMl,
  goalMl,
  onClose,
}: {
  date: string;
  totalMl: number;
  goalMl: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("250");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = (ml: number) => {
    if (pending) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await logWaterAction({ amountMl: ml, localDate: date });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      setSuccess(`+${formatMl(ml)}`);
      router.refresh();
    });
  };

  return (
    <WeekLogDialogShell
      kicker="Vatten"
      title={dayTitle(date)}
      labelledBy="week-water-modal-title"
      accent="water"
      onClose={onClose}
    >
      <p className={styles.goal}>
        {formatMl(totalMl)} / {formatMl(goalMl)}
      </p>
      <div className={styles.presets}>
        {QUICK_ADDS.map((q) => (
          <button
            key={q.ml}
            type="button"
            className={[
              styles.preset,
              amount === String(q.ml) ? styles.presetActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setAmount(String(q.ml))}
            disabled={pending}
          >
            <span className={styles.presetIcon} aria-hidden>
              {q.icon}
            </span>
            {q.ml} ml
          </button>
        ))}
      </div>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit(Number(amount));
        }}
      >
        <Input
          label="Mängd"
          type="number"
          min={1}
          max={5000}
          step={50}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          suffix="ml"
          inputMode="numeric"
          disabled={pending}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          loading={pending}
          disabled={pending}
        >
          Lägg till vatten
        </Button>
      </form>
      {success ? <p className={styles.success}>{success}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </WeekLogDialogShell>
  );
}

export function WeekActivityLogDialog({
  date,
  currentHours,
  hoursGoal,
  onClose,
}: {
  date: string;
  currentHours: number | null;
  hoursGoal: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [hoursVal, setHoursVal] = useState(
    currentHours != null ? String(currentHours) : "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHoursVal(currentHours != null ? String(currentHours) : "");
    setError(null);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [currentHours, date]);

  const persist = (next: number | null) => {
    setError(null);
    startTransition(async () => {
      const res = await saveDailyActivityAction({
        localDate: date,
        activityHours: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const save = () => {
    if (pending) return;
    const trimmed = hoursVal.trim();
    if (trimmed === "") {
      persist(null);
      return;
    }
    const next = Math.round(Number(trimmed) * 10) / 10;
    if (!Number.isFinite(next) || next < 0 || next > 24) {
      setError("Aktivitetstimmar måste vara 0–24.");
      return;
    }
    persist(next);
  };

  const hasSaved = currentHours != null && currentHours > 0;

  return (
    <WeekLogDialogShell
      kicker="Aktivitet"
      title={dayTitle(date)}
      labelledBy="week-activity-modal-title"
      accent="activity"
      onClose={onClose}
    >
      <p className={styles.goal}>Mål: {hoursGoal} timmar</p>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          ref={inputRef}
          label="Aktiva timmar"
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={hoursVal}
          onChange={(e) => setHoursVal(e.target.value)}
          placeholder={`T.ex. ${hoursGoal}`}
          inputMode="decimal"
          suffix="h"
          disabled={pending}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          loading={pending}
          disabled={pending}
        >
          Spara aktivitet
        </Button>
      </form>
      {hasSaved ? (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => persist(null)}
          disabled={pending}
        >
          Ta bort aktivitet
        </button>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </WeekLogDialogShell>
  );
}

export function WeekFoodPickDialog({
  date,
  mealDay,
  onPickMeal,
  onPickSnack,
  onClose,
}: {
  date: string;
  mealDay: WeekMealDay | undefined;
  onPickMeal: (meal: MealKey) => void;
  onPickSnack: (slot: SnackSlot) => void;
  onClose: () => void;
}) {
  return (
    <WeekLogDialogShell
      kicker="Mat"
      title={dayTitle(date)}
      labelledBy="week-food-pick-title"
      accent="food"
      onClose={onClose}
    >
      <p className={styles.prompt}>Välj måltid eller mellanmål att logga.</p>
      <div className={styles.stack}>
        {MEAL_ORDER.map((meal) => {
          const entry = mealDay?.meals[meal] ?? null;
          return (
            <button
              key={meal}
              type="button"
              className={styles.pickBtn}
              onClick={() => onPickMeal(meal)}
            >
              <span aria-hidden>{MEAL_ICON[meal]}</span>
              <span>{MEAL_LABEL_SV[meal]}</span>
              <span className={styles.pickDetail}>
                {entry?.description.trim() || (entry ? "Loggad" : "Logga")}
              </span>
            </button>
          );
        })}
        {SNACK_SLOTS.map((slot) => {
          const entry = mealDay?.snacks[slot] ?? null;
          return (
            <button
              key={slot}
              type="button"
              className={styles.pickBtn}
              onClick={() => onPickSnack(slot)}
            >
              <span aria-hidden>{SNACK_ICON[slot]}</span>
              <span>{SNACK_LABEL[slot]}</span>
              <span className={styles.pickDetail}>
                {entry?.description.trim() || (entry ? "Loggad" : "Logga")}
              </span>
            </button>
          );
        })}
      </div>
    </WeekLogDialogShell>
  );
}

export function WeekSnackLogDialog({
  date,
  slot,
  initial,
  onClose,
}: {
  date: string;
  slot: SnackSlot;
  initial: SnackEntry | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDescription(initial?.description ?? "");
    setError(null);
  }, [initial, date, slot]);

  const save = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await saveSnackAction({
        localDate: date,
        slot,
        description,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <WeekLogDialogShell
      kicker={SNACK_LABEL[slot]}
      title={dayTitle(date)}
      labelledBy="week-snack-modal-title"
      accent="food"
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          label="Vad innehöll mellanmålet?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="t.ex. äpple och nötter"
          maxLength={280}
          autoFocus
          required
          disabled={pending}
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          loading={pending}
          disabled={pending || !description.trim()}
        >
          {initial ? "Spara" : "Markera äten"}
        </Button>
      </form>
      {error ? <p className={styles.error}>{error}</p> : null}
    </WeekLogDialogShell>
  );
}

function IntakeKindForm({
  date,
  kind,
  logged,
  onDone,
}: {
  date: string;
  kind: IntakeKind;
  logged: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [waterMl, setWaterMl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasWater = INTAKE_HAS_WATER[kind];
  const requiresDescription = INTAKE_REQUIRES_DESCRIPTION[kind];

  const save = () => {
    if (pending) return;
    let parsedWater = 0;
    if (hasWater) {
      parsedWater = waterMl.trim() === "" ? 0 : Number(waterMl);
      if (!Number.isFinite(parsedWater) || parsedWater < 0) {
        setError("Vattnet måste vara ett positivt tal.");
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      const res = await saveIntakeAction({
        kind,
        localDate: date,
        description,
        waterMl: hasWater ? Math.round(parsedWater) : 0,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onDone();
    });
  };

  const clear = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await clearIntakeAction({ kind, localDate: date });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort.");
        return;
      }
      onDone();
    });
  };

  return (
    <div className={styles.subRow}>
      <div className={styles.subHead}>
        <div className={styles.subIdentity}>
          <span className={styles.subIcon} aria-hidden>
            {INTAKE_ICON[kind]}
          </span>
          <span className={styles.subLabel}>{INTAKE_LABEL[kind]}</span>
        </div>
        {logged ? <span className={styles.subMeta}>Loggad</span> : null}
      </div>
      {!logged ? (
        <>
          <Input
            label={INTAKE_DESCRIPTION_LABEL[kind]}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={INTAKE_DESCRIPTION_PLACEHOLDER[kind]}
            maxLength={280}
            required={requiresDescription}
            disabled={pending}
          />
          {hasWater ? (
            <Input
              label="Vatten (valfritt)"
              type="number"
              min={0}
              max={5000}
              step={50}
              value={waterMl}
              onChange={(e) => setWaterMl(e.target.value)}
              placeholder="0"
              suffix="ml"
              disabled={pending}
            />
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending}
            disabled={pending || (requiresDescription && !description.trim())}
            onClick={save}
          >
            Markera klart
          </Button>
        </>
      ) : (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={clear}
          disabled={pending}
        >
          Ångra
        </button>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

export function WeekIntakeLogDialog({
  date,
  kind,
  loggedByKind,
  onClose,
}: {
  date: string;
  kind?: IntakeKind;
  loggedByKind: Partial<Record<IntakeKind, boolean>>;
  onClose: () => void;
}) {
  const router = useRouter();
  const applicable = applicableIntakeKinds(date);
  const kinds = kind
    ? applicable.includes(kind)
      ? [kind]
      : []
    : applicable;

  return (
    <WeekLogDialogShell
      kicker="Intake"
      title={dayTitle(date)}
      labelledBy="week-intake-modal-title"
      accent="habit"
      wide
      onClose={onClose}
    >
      {kinds.length === 0 ? (
        <p className={styles.prompt}>
          Det här intaget loggas inte den här dagen.
        </p>
      ) : (
        <div className={styles.stack}>
          {kinds.map((k) => (
            <IntakeKindForm
              key={k}
              date={date}
              kind={k}
              logged={Boolean(loggedByKind[k])}
              onDone={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </WeekLogDialogShell>
  );
}

export function WeekSmokeFreeLogDialog({
  date,
  nicotine,
  cannabis,
  onClose,
}: {
  date: string;
  nicotine: HabitStatus | null;
  cannabis: HabitStatus | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState({ nicotine, cannabis });

  useEffect(() => {
    setLocal({ nicotine, cannabis });
  }, [nicotine, cannabis, date]);

  const toggle = (substance: SmokeFreeSubstance, pressed: HabitStatus) => {
    const current = substance === "nicotine" ? local.nicotine : local.cannabis;
    const next = nextHabitStatus(current, pressed);
    setLocal((prev) =>
      substance === "nicotine"
        ? { ...prev, nicotine: next }
        : { ...prev, cannabis: next },
    );
    setError(null);
    startTransition(async () => {
      const res = await saveSmokeFreeDailyLogAction({
        localDate: date,
        substance,
        status: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        setLocal({ nicotine, cannabis });
        return;
      }
      router.refresh();
    });
  };

  return (
    <WeekLogDialogShell
      kicker="Rökfritt"
      title={dayTitle(date)}
      labelledBy="week-smoke-modal-title"
      accent="habit"
      onClose={onClose}
    >
      <div className={styles.stack}>
        {SMOKE_FREE_SUBSTANCES.map((sub) => {
          const status =
            sub.key === "nicotine" ? local.nicotine : local.cannabis;
          return (
            <div key={sub.key} className={styles.subRow}>
              <div className={styles.subIdentity}>
                <span className={styles.subIcon} aria-hidden>
                  {sub.icon}
                </span>
                <span className={styles.subLabel}>{sub.label}</span>
              </div>
              <div
                className={styles.choices}
                role="radiogroup"
                aria-label={sub.label}
              >
                {CHOICES.map((choice) => {
                  const active = status === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={[
                        styles.choice,
                        styles[`choice_${choice.value}`],
                        active ? styles.choiceActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggle(sub.key, choice.value)}
                      disabled={pending}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </WeekLogDialogShell>
  );
}

export function WeekHabitStatusLogDialog({
  date,
  habitId,
  label,
  currentStatus,
  onClose,
}: {
  date: string;
  habitId: string;
  label: string;
  currentStatus: HabitStatus | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<HabitStatus | null>(currentStatus);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus, date, habitId]);

  const toggle = (pressed: HabitStatus) => {
    const prev = status;
    const next = nextHabitStatus(status, pressed);
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const res = await setHabitStatusAction({
        habitId,
        localDate: date,
        status: next,
      });
      if (!res.ok) {
        setStatus(prev);
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <WeekLogDialogShell
      kicker={label}
      title={dayTitle(date)}
      labelledBy="week-status-modal-title"
      accent="habit"
      onClose={onClose}
    >
      <p className={styles.prompt}>Klarade du det den här dagen?</p>
      <div className={styles.choices} role="radiogroup" aria-label={label}>
        {CHOICES.map((choice) => {
          const active = status === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={[
                styles.choice,
                styles[`choice_${choice.value}`],
                active ? styles.choiceActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => toggle(choice.value)}
              disabled={pending}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </WeekLogDialogShell>
  );
}

function gamesValue(
  ctx: DailyMobileGamesContext,
  key: MobileGameKey,
): boolean {
  if (key === "chess") return ctx.chess;
  if (key === "duolingo") return ctx.duolingo;
  return ctx.pokemonGo;
}

function patchGames(
  ctx: DailyMobileGamesContext,
  key: MobileGameKey,
  value: boolean,
): DailyMobileGamesContext {
  if (key === "chess") return { ...ctx, chess: value, hasLog: true };
  if (key === "duolingo") return { ...ctx, duolingo: value, hasLog: true };
  return { ...ctx, pokemonGo: value, hasLog: true };
}

export function WeekMobileGamesLogDialog({
  date,
  games,
  onClose,
}: {
  date: string;
  games: DailyMobileGamesContext;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(games);

  useEffect(() => {
    setLocal(games);
  }, [games, date]);

  const toggle = (key: MobileGameKey) => {
    const next = patchGames(local, key, !gamesValue(local, key));
    setLocal(next);
    setError(null);
    startTransition(async () => {
      const res = await saveMobileGamesDailyLogAction({
        localDate: date,
        chess: next.chess,
        duolingo: next.duolingo,
        pokemonGo: next.pokemonGo,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        setLocal(games);
        return;
      }
      router.refresh();
    });
  };

  return (
    <WeekLogDialogShell
      kicker="Mobilspel"
      title={dayTitle(date)}
      labelledBy="week-games-modal-title"
      accent="habit"
      onClose={onClose}
    >
      <div className={styles.stack}>
        {MOBILE_GAME_STEPS.map((step) => {
          const done = gamesValue(local, step.key);
          return (
            <button
              key={step.key}
              type="button"
              className={[styles.toggle, done ? styles.toggleDone : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => toggle(step.key)}
              disabled={pending}
              aria-pressed={done}
            >
              <span aria-hidden>{step.icon}</span>
              <span>{step.label}</span>
              {done ? (
                <span className={styles.toggleCheck} aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </WeekLogDialogShell>
  );
}
