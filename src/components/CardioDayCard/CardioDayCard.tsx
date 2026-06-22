"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  completeCardioSessionAction,
  uncompleteCardioSessionAction,
} from "@/app/(app)/cardio-actions";
import type { CardioSessionForWeek } from "@/lib/cardio";
import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import { trainingCategory } from "@/lib/activity-category";
import { sortIncompleteFirst } from "@/lib/tasks";
import styles from "./CardioDayCard.module.scss";

interface Props {
  weekStart: string;
  sessions: CardioSessionForWeek[];
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
}

export function CardioDayCard({
  weekStart,
  sessions,
  title = "Cardio",
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
        <p className={styles.empty}>Inget cardiopass planerat den här dagen.</p>
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
          <CardioSessionRow
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
  session: CardioSessionForWeek;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

export function CardioSessionRow({
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
}: SessionRowProps) {
  const done = Boolean(session.placement.doneAt);
  const category = trainingCategory("cardio");
  const [note, setNote] = useState(session.placement.note ?? "");
  const [, startTransition] = useTransition();

  const complete = () => {
    onError(null);
    onPendingId(session.id);
    startTransition(async () => {
      const res = await completeCardioSessionAction({
        templateId: session.id,
        weekStart,
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
      const res = await uncompleteCardioSessionAction({
        templateId: session.id,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setNote("");
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
          {done && session.placement.note ? (
            <span className={styles.noteBadge}>{session.placement.note}</span>
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
          {!done ? (
            <>
              <Input
                label="Kommentar om passet"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="t.ex. 5 km lätt tempo, 30 min cykel"
                maxLength={280}
                required
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
