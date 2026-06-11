"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  placeWeightWeekAction,
  setWeightWeekEnabledAction,
  unplaceWeightWeekAction,
} from "@/app/(app)/weight-actions";
import { formatWeightKg } from "@/lib/format";
import {
  WEIGHT_ITEM_ID,
  WEIGHT_TIME_LABEL,
  type WeightWeekPlan,
} from "@/lib/weight";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type Weekday,
} from "@/lib/tasks";
import styles from "./weight-week.module.scss";

interface Props {
  weekStart: string;
  plan: WeightWeekPlan;
}

const BACKLOG_DROP_ID = "weight-backlog";

function dayDropId(weekday: Weekday): string {
  return `weight-day-${weekday}`;
}

function weekdayFromDropId(id: string): Weekday | null {
  const m = /^weight-day-(\d)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 7 ? (n as Weekday) : null;
}

export function WeightWeekBoard({ weekStart, plan }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localPlan, setLocalPlan] = useState(plan);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalPlan(plan);
  }, [plan]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const inBacklog = localPlan.enabled && localPlan.weekday == null;
  const placedWeekday = localPlan.weekday;
  const logged = Boolean(localPlan.log);

  const toggleEnabled = () => {
    const next = !localPlan.enabled;
    setError(null);
    setLocalPlan((prev) => ({ ...prev, enabled: next }));
    startTransition(async () => {
      const res = await setWeightWeekEnabledAction({
        weekStart,
        enabled: next,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte uppdatera.");
        setLocalPlan(plan);
      }
      router.refresh();
    });
  };

  const place = (weekday: Weekday) => {
    if (placedWeekday === weekday) return;

    setError(null);
    setLocalPlan((prev) => ({ ...prev, weekday, log: null }));
    startTransition(async () => {
      const res = await placeWeightWeekAction({ weekStart, weekday });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte placera.");
        setLocalPlan(plan);
      }
      router.refresh();
    });
  };

  const unplace = () => {
    if (localPlan.weekday == null) return;

    setError(null);
    setLocalPlan((prev) => ({ ...prev, weekday: null, log: null }));
    startTransition(async () => {
      const res = await unplaceWeightWeekAction(weekStart);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte flytta tillbaka.");
        setLocalPlan(plan);
      }
      router.refresh();
    });
  };

  const handleDragStart = (_event: DragStartEvent) => {
    setDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(false);
    const { over } = event;
    if (!over) return;

    const overId = String(over.id);
    if (overId === BACKLOG_DROP_ID) {
      unplace();
      return;
    }

    const weekday = weekdayFromDropId(overId);
    if (weekday) place(weekday);
  };

  const itemDetail = localPlan.log
    ? `${formatWeightKg(localPlan.log.weightKg)} · ${WEIGHT_TIME_LABEL[localPlan.log.timeOfDay]}`
    : "Väg dig på vald dag";

  return (
    <div className={styles.board}>
      <div className={styles.headerRow}>
        <div className={styles.headerMeta}>
          <span className={styles.headerIcon} aria-hidden>
            ⚖️
          </span>
          <div>
            <div className={styles.headerTitle}>Vikt</div>
            <p className={styles.headerSub}>en gång per vecka</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={localPlan.enabled}
          aria-label={`${localPlan.enabled ? "Stäng av" : "Slå på"} vikt den här veckan`}
          className={[
            styles.toggle,
            localPlan.enabled ? styles.toggleOn : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={toggleEnabled}
          disabled={pending}
        >
          <span className={styles.toggleKnob} aria-hidden />
        </button>
      </div>

      {!localPlan.enabled ? (
        <p className={styles.disabledNote}>
          Vikt är avstängd den här veckan. Slå på för att planera en vägning.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.layout}>
            <aside className={styles.backlogPanel}>
              <BacklogDropZone hasItem={inBacklog}>
                <p className={styles.dragHint}>
                  Dra till en dag · släpp här igen för att flytta tillbaka
                </p>
                {inBacklog ? (
                  <ul className={styles.itemList}>
                    <WeightItemRow
                      detail={itemDetail}
                      done={logged}
                      dragging={dragging}
                      pending={pending}
                    />
                  </ul>
                ) : (
                  <p className={styles.dayEmpty}>Placerad på en dag.</p>
                )}
              </BacklogDropZone>
            </aside>

            <div className={styles.weekPanel}>
              {error ? <p className={styles.error}>{error}</p> : null}

              {WEEKDAYS.map((d) => {
                const placed = placedWeekday === d;
                return (
                  <DayDropZone key={d} weekday={d}>
                    <header className={styles.dayHeader}>
                      <div>
                        <h3 className={styles.dayTitle}>{WEEKDAY_LONG[d]}</h3>
                        <p className={styles.daySub}>{WEEKDAY_SHORT[d]}</p>
                      </div>
                      <span className={styles.dayCount}>{placed ? "1" : "—"}</span>
                    </header>

                    {!placed ? (
                      <p className={styles.dayEmpty}>Släpp vägningen här.</p>
                    ) : (
                      <ul className={styles.itemList}>
                        <WeightItemRow
                          detail={itemDetail}
                          done={logged}
                          dragging={dragging}
                          pending={pending}
                        />
                      </ul>
                    )}
                  </DayDropZone>
                );
              })}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragging ? (
              <WeightItemPreview detail={itemDetail} done={logged} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function BacklogDropZone({
  hasItem,
  children,
}: {
  hasItem: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: BACKLOG_DROP_ID });

  return (
    <section
      ref={setNodeRef}
      className={[
        styles.backlogSection,
        isOver ? styles.dropZoneOver : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className={styles.dayHeader}>
        <div>
          <h3 className={styles.dayTitle}>Att placera</h3>
          <p className={styles.daySub}>vikt</p>
        </div>
        <span className={styles.dayCount}>{hasItem ? "1" : "0"}</span>
      </header>
      {children}
    </section>
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
        isOver ? styles.dropZoneOver : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

function WeightItemRow({
  detail,
  done,
  dragging,
  pending,
}: {
  detail: string;
  done: boolean;
  dragging: boolean;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: WEIGHT_ITEM_ID,
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
        styles.item,
        done ? styles.itemDone : "",
        dragging ? styles.itemDragging : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Dra vägning till en annan dag"
        disabled={pending}
        {...attributes}
        {...listeners}
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

      <div className={styles.itemBody}>
        <span className={styles.itemIcon} aria-hidden>
          ⚖️
        </span>
        <span className={styles.itemMeta}>
          <span className={styles.itemTitle}>Vägning</span>
          <span className={styles.itemDetail}>{detail}</span>
        </span>
        {done ? <span className={styles.checkBadge} aria-hidden>✓</span> : null}
      </div>
    </li>
  );
}

function WeightItemPreview({
  detail,
  done,
}: {
  detail: string;
  done: boolean;
}) {
  return (
    <div
      className={[
        styles.item,
        styles.itemPreview,
        done ? styles.itemDone : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.itemBody}>
        <span className={styles.itemIcon} aria-hidden>
          ⚖️
        </span>
        <span className={styles.itemMeta}>
          <span className={styles.itemTitle}>Vägning</span>
          <span className={styles.itemDetail}>{detail}</span>
        </span>
      </div>
    </div>
  );
}
