"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  completeSportSessionAction,
  uncompleteSportSessionAction,
  updateSportPlanAction,
} from "@/app/(app)/sport-actions";
import { formatSportDetail, type SportSessionForWeek } from "@/lib/sport";
import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import { trainingCategory } from "@/lib/activity-category";
import { sortIncompleteFirst } from "@/lib/tasks";
import styles from "./SportDayCard.module.scss";

interface Props {
  weekStart: string;
  sessions: SportSessionForWeek[];
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
}

export function SportDayCard({
  weekStart,
  sessions,
  title = "Sport",
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
        <p className={styles.empty}>Inget sportpass planerat den här dagen.</p>
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
          <SportSessionRow
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
  session: SportSessionForWeek;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

export function SportSessionRow({
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
  const category = trainingCategory("sport");
  const detail = formatSportDetail(session.placement);
  const [planSport, setPlanSport] = useState(session.placement.planSport ?? "");
  const [actualSport, setActualSport] = useState(
    session.placement.actualSport ?? session.placement.planSport ?? "",
  );
  const [note, setNote] = useState(session.placement.note ?? "");
  const [companions, setCompanions] = useState(
    session.placement.companions ?? "",
  );
  const [, startTransition] = useTransition();

  const savePlan = () => {
    onError(null);
    onPendingId(session.id);
    startTransition(async () => {
      const res = await updateSportPlanAction({
        templateId: session.id,
        weekStart,
        planSport,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara plan.");
      onPendingId(null);
      onDone();
    });
  };

  const complete = () => {
    onError(null);
    onPendingId(session.id);
    startTransition(async () => {
      const res = await completeSportSessionAction({
        templateId: session.id,
        weekStart,
        actualSport,
        note,
        companions,
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
      const res = await uncompleteSportSessionAction({
        templateId: session.id,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setActualSport(session.placement.planSport ?? "");
      setNote("");
      setCompanions("");
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
          {!done && session.placement.planSport ? (
            <span className={styles.planHint}>
              Planerat: {session.placement.planSport}
            </span>
          ) : null}
          {done && detail ? (
            <span className={styles.noteBadge}>{detail}</span>
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
                label="Planerad sport"
                value={planSport}
                onChange={(e) => setPlanSport(e.target.value)}
                placeholder="t.ex. frisbee golf, badminton"
                maxLength={80}
              />
              <button
                type="button"
                className={styles.savePlanBtn}
                onClick={savePlan}
                disabled={pending && busy}
              >
                Spara plan
              </button>
              <Input
                label="Vad blev det?"
                value={actualSport}
                onChange={(e) => setActualSport(e.target.value)}
                placeholder="t.ex. frisbee golf på Berga"
                maxLength={80}
                required
              />
              <label className={styles.noteField}>
                <span className={styles.fieldLabel}>Hur gick det?</span>
                <textarea
                  className={styles.noteInput}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Bra rundor, trött ben, nytt rekord…"
                  rows={2}
                  maxLength={280}
                />
              </label>
              <Input
                label="Vem var med?"
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
                placeholder="t.ex. Johan, Lisa"
                maxLength={120}
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
