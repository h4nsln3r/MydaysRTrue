"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  completeGymSessionAction,
  uncompleteGymSessionAction,
  updateGymSessionNoteAction,
} from "@/app/(app)/gym-actions";
import {
  GYM_WARMUP_ICON,
  GYM_WARMUP_LABEL,
  GYM_WARMUPS,
  type GymSessionForWeek,
  type GymWarmup,
} from "@/lib/gym";
import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import { trainingCategory } from "@/lib/activity-category";
import { sortIncompleteFirst } from "@/lib/tasks";
import styles from "./GymDayCard.module.scss";

interface Props {
  weekStart: string;
  sessions: GymSessionForWeek[];
  /** Card title — e.g. "Gym idag" vs "Gym". */
  title?: string;
  /** Omit the card when there are no sessions (parent shows combined empty state). */
  hideWhenEmpty?: boolean;
  /** Show link to week plan in card header. */
  showWeekLink?: boolean;
}

export function GymDayCard({
  weekStart,
  sessions,
  title = "Gym",
  hideWhenEmpty = false,
  showWeekLink = true,
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

  if (sessions.length === 0) {
    if (hideWhenEmpty) return null;

    return (
      <Card className={styles.card}>
        <p className={styles.empty}>Inget gympass planerat den här dagen.</p>
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
          <GymSessionRow
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
    </Card>
  );
}

import type { PlanSortableProps } from "@/components/DayActivitiesCard/usePlanSortable";

interface SessionRowProps extends PlanSortableProps {
  session: GymSessionForWeek;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
  planningMode?: boolean;
}

export function GymSessionRow({
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
}: SessionRowProps) {
  const done = Boolean(session.placement.doneAt);
  const category = trainingCategory("gym");
  const [warmup, setWarmup] = useState<GymWarmup | null>(
    session.placement.warmup,
  );
  const [note, setNote] = useState(session.placement.note ?? "");
  const [, startTransition] = useTransition();

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
        note,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
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
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setWarmup(null);
      setNote("");
      onPendingId(null);
      onDone();
    });
  };

  const saveNote = () => {
    onError(null);
    onPendingId(session.id);
    startTransition(async () => {
      const res = await updateGymSessionNoteAction({
        templateId: session.id,
        weekStart,
        note,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
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
          {done && session.placement.warmup ? (
            <span className={styles.warmupBadge}>
              {GYM_WARMUP_ICON[session.placement.warmup]}{" "}
              {GYM_WARMUP_LABEL[session.placement.warmup]}
            </span>
          ) : null}
          {done && session.placement.note ? (
            <span className={styles.sessionDesc}>{session.placement.note}</span>
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

      {expanded && !planningMode ? (
        <div className={styles.sessionActions}>
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
                loading={pending && busy}
                disabled={pending}
                onClick={complete}
              >
                Markera klart
              </Button>
            </>
          ) : (
            <>
              <Input
                label="Kommentar"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="t.ex. gym på Berga i Helsingborg"
                maxLength={280}
                disabled={pending}
              />
              {note !== (session.placement.note ?? "") ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  fullWidth
                  loading={pending && busy}
                  disabled={pending}
                  onClick={saveNote}
                >
                  Spara kommentar
                </Button>
              ) : null}
              <button
              type="button"
              className={styles.undoBtn}
              onClick={uncomplete}
              disabled={pending}
            >
              Ångra klarmarkering
            </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
