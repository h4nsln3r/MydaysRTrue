"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  completeBathingSessionAction,
  moveBathingPlacementAction,
  uncompleteBathingSessionAction,
} from "@/app/(app)/bathing-actions";
import {
  bathingRequiresWaterTemp,
  formatWaterTemp,
  type BathingSessionForWeek,
} from "@/lib/bathing";
import {
  WEEKDAY_SHORT,
  WEEKDAYS,
  type Weekday,
} from "@/lib/tasks";
import styles from "./BathingDayCard.module.scss";

interface Props {
  weekStart: string;
  sessions: BathingSessionForWeek[];
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
}

export function BathingDayCard({
  weekStart,
  sessions,
  title = "Bad & bastu",
  hideWhenEmpty = false,
  showWeekLink = true,
}: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const doneCount = sessions.filter((s) => s.placement.doneAt).length;

  if (sessions.length === 0) {
    if (hideWhenEmpty) return null;

    return (
      <Card className={styles.card}>
        <p className={styles.empty}>Inget bad eller bastu planerat den här dagen.</p>
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
        {sessions.map((s) => (
          <SessionRow
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
    </Card>
  );
}

interface SessionRowProps {
  session: BathingSessionForWeek;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

function SessionRow({
  session,
  weekStart,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingId,
  onDone,
}: SessionRowProps) {
  const done = Boolean(session.placement.doneAt);
  const needsTemp = bathingRequiresWaterTemp(session.key);
  const [waterTemp, setWaterTemp] = useState(
    session.placement.waterTempC != null
      ? String(session.placement.waterTempC)
      : "",
  );
  const [, startTransition] = useTransition();

  const move = (weekday: Weekday) => {
    onError(null);
    onPendingId(session.placement.id);
    startTransition(async () => {
      const res = await moveBathingPlacementAction({
        placementId: session.placement.id,
        weekStart,
        weekday,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte flytta passet.");
      onPendingId(null);
      onDone();
    });
  };

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
      onPendingId(null);
      onDone();
    });
  };

  return (
    <li
      className={[
        styles.session,
        done ? styles.sessionDone : "",
        busy ? styles.sessionBusy : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={[styles.checkBtn, done ? styles.checkBtnDone : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={done ? "Pass klart" : "Logga pass"}
        onClick={onToggleExpand}
        disabled={pending}
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
        onClick={onToggleExpand}
        aria-expanded={expanded}
        disabled={pending}
      >
        <span
          className={styles.sessionIcon}
          aria-hidden
          style={{ borderColor: session.accent }}
        >
          {session.icon}
        </span>
        <span className={styles.sessionMeta}>
          <span className={styles.sessionTitle}>{session.label}</span>
          {session.description ? (
            <span className={styles.sessionDesc}>{session.description}</span>
          ) : null}
          {done && session.placement.waterTempC != null ? (
            <span className={styles.noteBadge}>
              {formatWaterTemp(session.placement.waterTempC)}
            </span>
          ) : null}
        </span>
        <span
          className={[styles.chevron, expanded ? styles.chevronUp : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className={styles.sessionActions}>
          <p className={styles.actionsLabel}>Flytta till annan dag</p>
          <div className={styles.weekdayRow} role="radiogroup">
            {WEEKDAYS.map((d) => {
              const active = session.placement.weekday === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={[
                    styles.weekdayBtn,
                    active ? styles.weekdayBtnActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => move(d)}
                  disabled={pending}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              );
            })}
          </div>

          {!done ? (
            <>
              {needsTemp ? (
                <Input
                  label="Vattentemperatur (°C)"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={waterTemp}
                  onChange={(e) => setWaterTemp(e.target.value)}
                  placeholder="t.ex. 4"
                  required
                />
              ) : null}
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
