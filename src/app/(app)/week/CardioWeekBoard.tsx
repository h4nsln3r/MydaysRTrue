"use client";

import { useEffect, useState, useTransition, type HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  completeCardioSessionAction,
  moveCardioSessionAction,
  resetCardioWeekToDefaultsAction,
  uncompleteCardioSessionAction,
} from "@/app/(app)/cardio-actions";
import type { CardioSessionForWeek } from "@/lib/cardio";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type Weekday,
} from "@/lib/tasks";
import styles from "./gym-week.module.scss";

interface Props {
  weekStart: string;
  sessions: CardioSessionForWeek[];
}

function dayDropId(weekday: Weekday): string {
  return `cardio-day-${weekday}`;
}

function weekdayFromDropId(id: string): Weekday | null {
  const m = /^cardio-day-(\d)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 7 ? (n as Weekday) : null;
}

export function CardioWeekBoard({ weekStart, sessions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localSessions, setLocalSessions] = useState(sessions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalSessions(sessions);
  }, [sessions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const byDay = new Map<Weekday, CardioSessionForWeek[]>(
    WEEKDAYS.map((d) => [d, [] as CardioSessionForWeek[]]),
  );
  for (const s of localSessions) {
    byDay.get(s.placement.weekday)?.push(s);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const doneCount = localSessions.filter((s) => s.placement.doneAt).length;
  const draggingSession = draggingId
    ? localSessions.find((s) => s.id === draggingId)
    : null;

  const moveSession = (templateId: string, weekday: Weekday) => {
    const session = localSessions.find((s) => s.id === templateId);
    if (!session || session.placement.weekday === weekday) return;

    setError(null);
    setLocalSessions((prev) =>
      prev.map((s) =>
        s.id === templateId
          ? { ...s, placement: { ...s.placement, weekday } }
          : s,
      ),
    );
    setPendingId(templateId);
    startTransition(async () => {
      const res = await moveCardioSessionAction({
        templateId,
        weekStart,
        weekday,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte flytta passet.");
        setLocalSessions(sessions);
      }
      setPendingId(null);
      router.refresh();
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
    setExpandedId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const weekday = weekdayFromDropId(String(over.id));
    if (!weekday) return;
    moveSession(String(active.id), weekday);
  };

  const resetWeek = () => {
    setError(null);
    startTransition(async () => {
      const res = await resetCardioWeekToDefaultsAction(weekStart);
      if (!res.ok) setError(res.error ?? "Kunde inte återställa.");
      router.refresh();
    });
  };

  if (sessions.length === 0) {
    return (
      <p className={styles.empty}>
        Inga cardiopass ännu. Kör migrationen{" "}
        <code className={styles.code}>0011_cardio.sql</code> mot Supabase.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.board}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryStat}>
            <span className={styles.summaryBig}>{doneCount}</span>
            <span className={styles.summarySlash}>
              / {localSessions.length} klara
            </span>
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

        <p className={styles.dragHint}>Dra passen till en annan dag</p>

        {error ? <p className={styles.error}>{error}</p> : null}

        {WEEKDAYS.map((d) => {
          const daySessions = byDay.get(d) ?? [];
          const dayDone = daySessions.filter((s) => s.placement.doneAt).length;
          return (
            <DayDropZone key={d} weekday={d}>
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
                <p className={styles.dayEmpty}>Släpp ett pass här.</p>
              ) : (
                <ul className={styles.sessionList}>
                  {daySessions.map((s) => (
                    <DraggableSessionRow
                      key={s.id}
                      session={s}
                      weekStart={weekStart}
                      expanded={expandedId === s.id}
                      busy={pendingId === s.id}
                      dragging={draggingId === s.id}
                      pending={pending}
                      onToggleExpand={() =>
                        setExpandedId(expandedId === s.id ? null : s.id)
                      }
                      onMove={moveSession}
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
            </DayDropZone>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingSession ? (
          <SessionCardPreview session={draggingSession} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayDropZone({
  weekday,
  children,
}: {
  weekday: Weekday;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dayDropId(weekday) });

  return (
    <section
      ref={setNodeRef}
      className={[
        styles.daySection,
        isOver ? styles.daySectionOver : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

function DraggableSessionRow({
  session,
  weekStart,
  expanded,
  busy,
  dragging,
  pending,
  onToggleExpand,
  onMove,
  onError,
  onPendingId,
  onDone,
}: {
  session: CardioSessionForWeek;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  dragging: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onMove: (templateId: string, weekday: Weekday) => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: session.id,
    disabled: pending,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        styles.session,
        session.placement.doneAt ? styles.sessionDone : "",
        busy ? styles.sessionBusy : "",
        dragging ? styles.sessionDragging : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SessionRowContent
        session={session}
        weekStart={weekStart}
        expanded={expanded}
        pending={pending}
        busy={busy}
        dragHandleProps={{ ...attributes, ...listeners }}
        onToggleExpand={onToggleExpand}
        onMove={onMove}
        onError={onError}
        onPendingId={onPendingId}
        onDone={onDone}
      />
    </li>
  );
}

function SessionCardPreview({ session }: { session: CardioSessionForWeek }) {
  return (
    <div
      className={[
        styles.session,
        styles.sessionPreview,
        session.placement.doneAt ? styles.sessionDone : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SessionRowContent
        session={session}
        weekStart=""
        expanded={false}
        pending={false}
        busy={false}
        preview
        onToggleExpand={() => {}}
        onMove={() => {}}
        onError={() => {}}
        onPendingId={() => {}}
        onDone={() => {}}
      />
    </div>
  );
}

function SessionRowContent({
  session,
  weekStart,
  expanded,
  pending,
  busy,
  preview = false,
  dragHandleProps,
  onToggleExpand,
  onMove,
  onError,
  onPendingId,
  onDone,
}: {
  session: CardioSessionForWeek;
  weekStart: string;
  expanded: boolean;
  pending: boolean;
  busy: boolean;
  preview?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  onToggleExpand: () => void;
  onMove: (templateId: string, weekday: Weekday) => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}) {
  const done = Boolean(session.placement.doneAt);
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
    <>
      {!preview ? (
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
      ) : (
        <span className={styles.checkBtnPlaceholder} aria-hidden />
      )}

      {!preview ? (
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Dra ${session.label} till en annan dag`}
          disabled={pending}
          {...dragHandleProps}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="9" cy="7" r="1.5" fill="currentColor" />
            <circle cx="15" cy="7" r="1.5" fill="currentColor" />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
            <circle cx="9" cy="17" r="1.5" fill="currentColor" />
            <circle cx="15" cy="17" r="1.5" fill="currentColor" />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        className={styles.sessionBody}
        onClick={preview ? undefined : onToggleExpand}
        aria-expanded={expanded}
        disabled={pending || preview}
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
          {done && session.placement.note ? (
            <span className={styles.noteBadge}>{session.placement.note}</span>
          ) : null}
        </span>
        {!preview ? (
          <span
            className={[styles.chevron, expanded ? styles.chevronUp : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            ▾
          </span>
        ) : null}
      </button>

      {expanded && !preview ? (
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
                  onClick={() => onMove(session.id, d)}
                  disabled={pending}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              );
            })}
          </div>

          {!done ? (
            <>
              <Input
                label="Kommentar om passet"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="t.ex. 5 km lätt tempo, 40 min cykel"
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
    </>
  );
}
