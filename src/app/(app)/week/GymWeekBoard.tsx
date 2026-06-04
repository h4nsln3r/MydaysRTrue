"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button/Button";
import {
  completeGymSessionAction,
  moveGymSessionAction,
  resetGymWeekToDefaultsAction,
  uncompleteGymSessionAction,
} from "@/app/(app)/gym-actions";
import {
  GYM_WARMUP_ICON,
  GYM_WARMUP_LABEL,
  GYM_WARMUPS,
  type GymSessionForWeek,
  type GymWarmup,
} from "@/lib/gym";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type Weekday,
} from "@/lib/tasks";
import styles from "./gym-week.module.scss";

interface Props {
  weekStart: string;
  sessions: GymSessionForWeek[];
}

export function GymWeekBoard({ weekStart, sessions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byDay = new Map<Weekday, GymSessionForWeek[]>(
    WEEKDAYS.map((d) => [d, [] as GymSessionForWeek[]]),
  );
  for (const s of sessions) {
    byDay.get(s.placement.weekday)?.push(s);
  }
  // Keep pass order within each day (sort_order).
  for (const list of byDay.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const doneCount = sessions.filter((s) => s.placement.doneAt).length;

  const resetWeek = () => {
    setError(null);
    startTransition(async () => {
      const res = await resetGymWeekToDefaultsAction(weekStart);
      if (!res.ok) setError(res.error ?? "Could not reset.");
      router.refresh();
    });
  };

  if (sessions.length === 0) {
    return (
      <p className={styles.empty}>
        Inga gympass ännu. Kör migrationen{" "}
        <code className={styles.code}>0007_gym.sql</code> mot Supabase.
      </p>
    );
  }

  return (
    <div className={styles.board}>
      <div className={styles.summaryRow}>
        <span className={styles.summaryStat}>
          <span className={styles.summaryBig}>{doneCount}</span>
          <span className={styles.summarySlash}>/ {sessions.length} klara</span>
        </span>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={resetWeek}
          disabled={pending}
        >
          ↺ Standard vecka
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {WEEKDAYS.map((d) => {
        const daySessions = byDay.get(d) ?? [];
        const dayDone = daySessions.filter((s) => s.placement.doneAt).length;
        return (
          <section key={d} className={styles.daySection}>
            <header className={styles.dayHeader}>
              <div>
                <h3 className={styles.dayTitle}>{WEEKDAY_LONG[d]}</h3>
                <p className={styles.daySub}>{WEEKDAY_SHORT[d]}</p>
              </div>
              <span className={styles.dayCount}>
                {daySessions.length > 0
                  ? `${dayDone}/${daySessions.length}`
                  : "—"}
              </span>
            </header>

            {daySessions.length === 0 ? (
              <p className={styles.dayEmpty}>Inget pass här.</p>
            ) : (
              <ul className={styles.sessionList}>
                {daySessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    weekStart={weekStart}
                    expanded={expandedId === s.id}
                    busy={pendingId === s.id}
                    pending={pending}
                    onToggleExpand={() =>
                      setExpandedId(expandedId === s.id ? null : s.id)
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
            )}
          </section>
        );
      })}
    </div>
  );
}

interface SessionRowProps {
  session: GymSessionForWeek;
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
  const [warmup, setWarmup] = useState<GymWarmup | null>(
    session.placement.warmup,
  );
  const [, startTransition] = useTransition();

  const move = (weekday: Weekday) => {
    onError(null);
    onPendingId(session.id);
    startTransition(async () => {
      const res = await moveGymSessionAction({
        templateId: session.id,
        weekStart,
        weekday,
      });
      if (!res.ok) onError(res.error ?? "Could not move pass.");
      onPendingId(null);
      onDone();
    });
  };

  const complete = () => {
    if (!warmup) {
      onError("Välj uppvärmning innan du markerar klart.");
      return;
    }
    onError(null);
    onPendingId(session.id);
    startTransition(async () => {
      const res = await completeGymSessionAction({
        templateId: session.id,
        weekStart,
        warmup,
      });
      if (!res.ok) onError(res.error ?? "Could not save.");
      onPendingId(null);
      onDone();
    });
  };

  const uncomplete = () => {
    onError(null);
    onPendingId(session.id);
    startTransition(async () => {
      const res = await uncompleteGymSessionAction({
        templateId: session.id,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Could not undo.");
      setWarmup(null);
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
        aria-label={done ? "Pass klart" : "Öppna pass"}
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
          {done && session.placement.warmup ? (
            <span className={styles.warmupBadge}>
              {GYM_WARMUP_ICON[session.placement.warmup]}{" "}
              {GYM_WARMUP_LABEL[session.placement.warmup]}
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
              <p className={styles.actionsLabel}>Uppvärmning</p>
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
