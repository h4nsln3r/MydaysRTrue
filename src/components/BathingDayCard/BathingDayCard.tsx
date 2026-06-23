"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import {
  completeBathingSessionAction,
  deleteBathingPlacementAction,
  logExtraBathAction,
  moveBathingPlacementAction,
  uncompleteBathingSessionAction,
} from "@/app/(app)/bathing-actions";
import {
  bathingRequiresWaterTemp,
  formatWaterTemp,
  type BathingSessionForWeek,
} from "@/lib/bathing";
import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import { trainingCategory } from "@/lib/activity-category";
import { sortIncompleteFirst, type Weekday } from "@/lib/tasks";
import type { RescheduleDay } from "@/lib/use-day-reschedule";
import { TrainingRescheduleSelect } from "@/components/DayActivitiesCard/TrainingRescheduleSelect";
import styles from "./BathingDayCard.module.scss";

interface Props {
  weekStart: string;
  sessions: BathingSessionForWeek[];
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
  /** The weekday this card represents — required for "extra bath" logging. */
  weekday?: Weekday | null;
  /** Show a one-tap "extra bath" button that logs a completed bath. */
  enableExtraBath?: boolean;
}

export function BathingDayCard({
  weekStart,
  sessions,
  title = "Bad & bastu",
  hideWhenEmpty = false,
  showWeekLink = true,
  weekday = null,
  enableExtraBath = false,
}: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const doneCount = sessions.filter((s) => s.placement.doneAt).length;
  const orderedSessions = sortIncompleteFirst(
    sessions,
    (s) => Boolean(s.placement.doneAt),
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const extraBath =
    enableExtraBath && weekday != null ? (
      <BathingExtraBath
        weekStart={weekStart}
        weekday={weekday}
        onAdded={() => router.refresh()}
      />
    ) : null;

  if (sessions.length === 0) {
    if (hideWhenEmpty) {
      if (!extraBath) return null;
      return <Card className={styles.card}>{extraBath}</Card>;
    }

    return (
      <Card className={styles.card}>
        <p className={styles.empty}>Inget bad eller bastu planerat den här dagen.</p>
        {extraBath}
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Se veckoplan →
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          <span
            className={[
              styles.counter,
              doneCount === sessions.length ? styles.counterDone : "",
              doneCount > 0 && doneCount < sessions.length
                ? styles.counterPartial
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.counterBig}>{doneCount}</span>
            <span className={styles.counterSlash}>/ {sessions.length}</span>
          </span>
        </div>
        {showWeekLink ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Veckoplan →
          </Link>
        ) : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <ul className={styles.list}>
        {orderedSessions.map((s) => (
          <BathingSessionRow
            key={s.placement.id}
            session={s}
            weekStart={weekStart}
            expanded={expandedId === s.placement.id}
            busy={pendingId === s.placement.id}
            pending={pending}
            onToggleExpand={() =>
              setExpandedId(
                expandedId === s.placement.id ? null : s.placement.id,
              )
            }
            onError={setError}
            onPendingId={setPendingId}
            onDone={() => {
              setExpandedId(null);
              router.refresh();
            }}
          />
        ))}
      </ul>
      {extraBath}
    </Card>
  );
}

interface ExtraBathProps {
  weekStart: string;
  weekday: Weekday;
  onAdded: () => void;
}

export function BathingExtraBath({ weekStart, weekday, onAdded }: ExtraBathProps) {
  const [open, setOpen] = useState(false);
  const [waterTemp, setWaterTemp] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    const parsed = Number(waterTemp.replace(",", "."));
    startTransition(async () => {
      const res = await logExtraBathAction({
        weekStart,
        weekday,
        waterTempC: Number.isFinite(parsed) ? parsed : undefined,
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte logga badet.");
        return;
      }
      setWaterTemp("");
      setNote("");
      setOpen(false);
      onAdded();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.extraToggle}
        onClick={() => setOpen(true)}
      >
        + Extra bad
      </button>
    );
  }

  return (
    <div className={styles.extra}>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.tempRow}>
        <span className={styles.fieldLabel}>Temp</span>
        <div className={styles.tempField}>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            className={styles.tempInput}
            value={waterTemp}
            onChange={(e) => setWaterTemp(e.target.value)}
            placeholder="4"
            aria-label="Vattentemperatur i grader Celsius"
            autoFocus
          />
          <span className={styles.tempUnit}>°C</span>
        </div>
      </div>
      <label className={styles.noteField}>
        <span className={styles.fieldLabel}>Kommentar</span>
        <textarea
          className={styles.noteInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Var badade du? Hur kändes det?"
          rows={2}
          maxLength={280}
        />
      </label>
      <div className={styles.extraActions}>
        <button
          type="button"
          className={styles.undoBtn}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
        >
          Avbryt
        </button>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={pending}
          disabled={pending}
          onClick={submit}
        >
          Logga bad
        </Button>
      </div>
    </div>
  );
}

import type { PlanSortableProps } from "@/components/DayActivitiesCard/usePlanSortable";

interface SessionRowProps extends PlanSortableProps {
  session: BathingSessionForWeek;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
  planningMode?: boolean;
  canReschedule?: boolean;
  isOverdue?: boolean;
  rescheduleDays?: RescheduleDay[];
}

export function BathingSessionRow({
  session,
  weekStart,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingId,
  onDone,
  dragHandle,
  sortableRef,
  sortableStyle,
  planningMode = false,
  canReschedule = false,
  isOverdue = false,
  rescheduleDays = [],
}: SessionRowProps) {
  const done = Boolean(session.placement.doneAt);
  const showReschedule = canReschedule && !done && !planningMode;
  const category = trainingCategory("bathing");
  const needsTemp = bathingRequiresWaterTemp(session.key);
  const [waterTemp, setWaterTemp] = useState(
    session.placement.waterTempC != null
      ? String(session.placement.waterTempC)
      : "",
  );
  const [note, setNote] = useState(session.placement.note ?? "");
  const [, startTransition] = useTransition();

  const complete = () => {
    onError(null);
    onPendingId(session.placement.id);
    startTransition(async () => {
      const parsed = needsTemp
        ? Number(waterTemp.replace(",", "."))
        : undefined;
      const res = await completeBathingSessionAction({
        placementId: session.placement.id,
        weekStart,
        waterTempC: parsed,
        note,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const uncomplete = () => {
    onError(null);
    onPendingId(session.placement.id);
    startTransition(async () => {
      const res = await uncompleteBathingSessionAction({
        placementId: session.placement.id,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setWaterTemp("");
      setNote("");
      onPendingId(null);
      onDone();
    });
  };

  const reschedule = (value: string) => {
    if (!value) return;
    onError(null);
    onPendingId(session.placement.id);
    startTransition(async () => {
      const res =
        value === "remove"
          ? await deleteBathingPlacementAction({
              placementId: session.placement.id,
              weekStart,
            })
          : await moveBathingPlacementAction({
              placementId: session.placement.id,
              weekStart,
              weekday: Number(value) as Weekday,
            });
      if (!res.ok) onError(res.error ?? "Kunde inte planera om.");
      onPendingId(null);
      onDone();
    });
  };

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={[
        styles.session,
        dragHandle ? styles.sessionDraggable : "",
        done ? styles.sessionDone : "",
        busy ? styles.sessionBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dragHandle}
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={done ? "Pass klart" : "Logga pass"}
        onClick={planningMode ? undefined : onToggleExpand}
        disabled={pending || planningMode}
      >
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5 10 17.5 19 7.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span aria-hidden />
        )}
      </button>

      <button
        type="button"
        className={styles.sessionBody}
        onClick={planningMode ? undefined : onToggleExpand}
        aria-expanded={planningMode ? undefined : expanded}
        disabled={pending || planningMode}
      >
        <span
          className={styles.sessionIcon}
          aria-hidden
          style={{ borderColor: session.accent }}
        >
          {session.icon}
        </span>
        <span className={styles.sessionMeta}>
          <ActivityCategoryBadge
            icon={category.icon}
            label={category.label}
            accent={category.accent}
            done={done}
          />
          <span className={styles.sessionTitle}>{session.label}</span>
          {session.description ? (
            <span className={styles.sessionDesc}>{session.description}</span>
          ) : null}
          {done && session.placement.waterTempC != null ? (
            <span className={styles.noteBadge}>
              {formatWaterTemp(session.placement.waterTempC)}
            </span>
          ) : null}
          {done && session.placement.note ? (
            <span className={styles.noteBadge}>{session.placement.note}</span>
          ) : null}
        </span>
        {planningMode ? null : (
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        )}
      </button>

      {showReschedule ? (
        <TrainingRescheduleSelect
          isOverdue={isOverdue}
          days={rescheduleDays}
          pending={pending}
          onSelect={reschedule}
        />
      ) : null}

      {expanded && !planningMode ? (
        <div className={styles.sessionActions}>
          {!done ? (
            <>
              {needsTemp ? (
                <div className={styles.tempRow}>
                  <span className={styles.fieldLabel}>Temp</span>
                  <div className={styles.tempField}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      className={styles.tempInput}
                      value={waterTemp}
                      onChange={(e) => setWaterTemp(e.target.value)}
                      placeholder="4"
                      aria-label="Vattentemperatur i grader Celsius"
                    />
                    <span className={styles.tempUnit}>°C</span>
                  </div>
                </div>
              ) : null}
              <label className={styles.noteField}>
                <span className={styles.fieldLabel}>Kommentar</span>
                <textarea
                  className={styles.noteInput}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Var badade du? Hur kändes det?"
                  rows={2}
                  maxLength={280}
                />
              </label>
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={complete}
              >
                Markera klart
              </Button>
            </>
          ) : (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={uncomplete}
              disabled={pending}
            >
              Ångra klarmarkering
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}
