"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  completeGymSessionAction,
  uncompleteGymSessionAction,
} from "@/app/(app)/gym-actions";
import {
  completeCardioSessionAction,
  uncompleteCardioSessionAction,
} from "@/app/(app)/cardio-actions";
import {
  completeSportSessionAction,
  uncompleteSportSessionAction,
} from "@/app/(app)/sport-actions";
import {
  completeBathingSessionAction,
  uncompleteBathingSessionAction,
} from "@/app/(app)/bathing-actions";
import {
  GYM_WARMUPS,
  GYM_WARMUP_ICON,
  GYM_WARMUP_LABEL,
  type GymSessionForWeek,
  type GymWarmup,
} from "@/lib/gym";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { SportSessionForWeek } from "@/lib/sport";
import {
  bathingRequiresWaterTemp,
  formatWaterTemp,
  type BathingSessionForWeek,
} from "@/lib/bathing";
import {
  WEEK_PROGRESS_TRAINING_META,
  type WeekProgressTrainingKey,
} from "@/lib/week-progress-layout";
import { addDaysISO, formatDayShort, formatWeekdayShort } from "@/lib/date";
import styles from "./week-training-modal.module.scss";

export type WeekTrainingType = WeekProgressTrainingKey;

export type AnyTrainingSession =
  | GymSessionForWeek
  | CardioSessionForWeek
  | SportSessionForWeek
  | BathingSessionForWeek;

interface Props {
  type: WeekTrainingType;
  session: AnyTrainingSession;
  onClose: () => void;
}

export function WeekTrainingLogDialog({ type, session, onClose }: Props) {
  const router = useRouter();
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const onSaved = () => {
    router.refresh();
    close();
  };

  const meta = WEEK_PROGRESS_TRAINING_META[type];
  const weekStart = session.placement.weekStart;
  const date =
    session.placement.weekday != null
      ? addDaysISO(weekStart, session.placement.weekday - 1)
      : null;

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`${meta.label} – ${session.label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>
              {meta.icon} {meta.label}
              {date ? ` · ${formatWeekdayShort(date)} ${formatDayShort(date)}` : ""}
            </p>
            <h2 className={styles.title}>{session.label}</h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {type === "gym" ? (
            <GymForm
              session={session as GymSessionForWeek}
              weekStart={weekStart}
              onSaved={onSaved}
            />
          ) : type === "cardio" ? (
            <CardioForm
              session={session as CardioSessionForWeek}
              weekStart={weekStart}
              onSaved={onSaved}
            />
          ) : type === "sport" ? (
            <SportForm
              session={session as SportSessionForWeek}
              weekStart={weekStart}
              onSaved={onSaved}
            />
          ) : (
            <BathingForm
              session={session as BathingSessionForWeek}
              weekStart={weekStart}
              onSaved={onSaved}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function UndoButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.undoBtn}
      onClick={onClick}
      disabled={disabled}
    >
      Ångra klarmarkering
    </button>
  );
}

function GymForm({
  session,
  weekStart,
  onSaved,
}: {
  session: GymSessionForWeek;
  weekStart: string;
  onSaved: () => void;
}) {
  const done = Boolean(session.placement.doneAt);
  const [warmup, setWarmup] = useState<GymWarmup | null>(
    session.placement.warmup,
  );
  const [note, setNote] = useState(session.placement.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = () => {
    if (!warmup) {
      setError("Välj uppvärmning innan du markerar klart.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await completeGymSessionAction({
        templateId: session.id,
        weekStart,
        warmup,
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onSaved();
    });
  };

  const uncomplete = () => {
    setError(null);
    startTransition(async () => {
      const res = await uncompleteGymSessionAction({
        templateId: session.id,
        weekStart,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ångra.");
        return;
      }
      onSaved();
    });
  };

  return (
    <>
      <p className={styles.fieldLabel}>Uppvärmning</p>
      <div className={styles.warmupRow}>
        {GYM_WARMUPS.map((w) => (
          <button
            key={w}
            type="button"
            className={[
              styles.warmupBtn,
              warmup === w ? styles.warmupBtnActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={warmup === w}
            onClick={() => setWarmup(w)}
            disabled={pending}
          >
            <span aria-hidden>{GYM_WARMUP_ICON[w]}</span>
            {GYM_WARMUP_LABEL[w]}
          </button>
        ))}
      </div>
      <Input
        label="Kommentar"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="t.ex. gym på Berga i Helsingborg"
        maxLength={280}
        disabled={pending}
      />
      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        loading={pending}
        disabled={pending}
        onClick={complete}
      >
        {done ? "Spara ändringar" : "Markera klart"}
      </Button>
      {done ? <UndoButton onClick={uncomplete} disabled={pending} /> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </>
  );
}

function CardioForm({
  session,
  weekStart,
  onSaved,
}: {
  session: CardioSessionForWeek;
  weekStart: string;
  onSaved: () => void;
}) {
  const done = Boolean(session.placement.doneAt);
  const [note, setNote] = useState(session.placement.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = () => {
    if (!note.trim()) {
      setError("Skriv en kommentar om passet.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await completeCardioSessionAction({
        templateId: session.id,
        weekStart,
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onSaved();
    });
  };

  const uncomplete = () => {
    setError(null);
    startTransition(async () => {
      const res = await uncompleteCardioSessionAction({
        templateId: session.id,
        weekStart,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ångra.");
        return;
      }
      onSaved();
    });
  };

  return (
    <>
      <Input
        label="Kommentar"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="t.ex. 5 km löprunda i skogen"
        maxLength={280}
        disabled={pending}
      />
      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        loading={pending}
        disabled={pending}
        onClick={complete}
      >
        {done ? "Spara ändringar" : "Markera klart"}
      </Button>
      {done ? <UndoButton onClick={uncomplete} disabled={pending} /> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </>
  );
}

function SportForm({
  session,
  weekStart,
  onSaved,
}: {
  session: SportSessionForWeek;
  weekStart: string;
  onSaved: () => void;
}) {
  const done = Boolean(session.placement.doneAt);
  const [actualSport, setActualSport] = useState(
    session.placement.actualSport ?? session.placement.planSport ?? "",
  );
  const [note, setNote] = useState(session.placement.note ?? "");
  const [companions, setCompanions] = useState(
    session.placement.companions ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = () => {
    if (!actualSport.trim()) {
      setError("Skriv vilken sport det blev.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await completeSportSessionAction({
        templateId: session.id,
        weekStart,
        actualSport,
        note,
        companions,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onSaved();
    });
  };

  const uncomplete = () => {
    setError(null);
    startTransition(async () => {
      const res = await uncompleteSportSessionAction({
        templateId: session.id,
        weekStart,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ångra.");
        return;
      }
      onSaved();
    });
  };

  return (
    <>
      <Input
        label="Vilken sport blev det?"
        value={actualSport}
        onChange={(e) => setActualSport(e.target.value)}
        placeholder="t.ex. padel"
        maxLength={120}
        disabled={pending}
      />
      <Input
        label="Vilka var med? (valfritt)"
        value={companions}
        onChange={(e) => setCompanions(e.target.value)}
        placeholder="t.ex. Anna & Erik"
        maxLength={200}
        disabled={pending}
      />
      <Input
        label="Kommentar (valfritt)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="t.ex. 3 set, kul match"
        maxLength={280}
        disabled={pending}
      />
      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        loading={pending}
        disabled={pending}
        onClick={complete}
      >
        {done ? "Spara ändringar" : "Markera klart"}
      </Button>
      {done ? <UndoButton onClick={uncomplete} disabled={pending} /> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </>
  );
}

function BathingForm({
  session,
  weekStart,
  onSaved,
}: {
  session: BathingSessionForWeek;
  weekStart: string;
  onSaved: () => void;
}) {
  const done = Boolean(session.placement.doneAt);
  const needsTemp = bathingRequiresWaterTemp(session.key);
  const [waterTemp, setWaterTemp] = useState(
    session.placement.waterTempC != null
      ? String(session.placement.waterTempC)
      : "",
  );
  const [note, setNote] = useState(session.placement.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = () => {
    setError(null);
    const parsed = needsTemp ? Number(waterTemp.replace(",", ".")) : undefined;
    startTransition(async () => {
      const res = await completeBathingSessionAction({
        placementId: session.placement.id,
        weekStart,
        waterTempC: parsed,
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onSaved();
    });
  };

  const uncomplete = () => {
    setError(null);
    startTransition(async () => {
      const res = await uncompleteBathingSessionAction({
        placementId: session.placement.id,
        weekStart,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ångra.");
        return;
      }
      onSaved();
    });
  };

  return (
    <>
      {needsTemp ? (
        <Input
          label="Vattentemperatur (°C)"
          type="text"
          inputMode="decimal"
          value={waterTemp}
          onChange={(e) => setWaterTemp(e.target.value)}
          placeholder="t.ex. 4"
          disabled={pending}
        />
      ) : null}
      <Input
        label="Kommentar (valfritt)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="t.ex. kallbad + bastu på Ribban"
        maxLength={280}
        disabled={pending}
      />
      {done && session.placement.waterTempC != null ? (
        <p className={styles.hint}>
          Loggat: {formatWaterTemp(session.placement.waterTempC)}
        </p>
      ) : null}
      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        loading={pending}
        disabled={pending}
        onClick={complete}
      >
        {done ? "Spara ändringar" : "Markera klart"}
      </Button>
      {done ? <UndoButton onClick={uncomplete} disabled={pending} /> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </>
  );
}
