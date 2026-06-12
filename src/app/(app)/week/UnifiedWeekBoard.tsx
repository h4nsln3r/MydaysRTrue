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
  completeBathingSessionAction,
  uncompleteBathingSessionAction,
} from "@/app/(app)/bathing-actions";
import {
  completeCardioSessionAction,
  uncompleteCardioSessionAction,
} from "@/app/(app)/cardio-actions";
import {
  completeGymSessionAction,
  uncompleteGymSessionAction,
} from "@/app/(app)/gym-actions";
import { updateWeeklyTaskPlanAction } from "@/app/(app)/tasks-actions";
import { setWeightWeekEnabledAction } from "@/app/(app)/weight-actions";
import {
  enableWeightWeekAction,
  placeWeekPlanItemAction,
  resetWeekPlanToDefaultsAction,
  unplaceWeekPlanItemAction,
} from "@/app/(app)/week-plan-actions";
import { AddTaskPanel } from "@/components/AddTaskPanel/AddTaskPanel";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { formatWeightKg } from "@/lib/format";
import {
  bathingRequiresWaterTemp,
  formatWaterTemp,
} from "@/lib/bathing";
import {
  GYM_WARMUP_ICON,
  GYM_WARMUP_LABEL,
  GYM_WARMUPS,
  type GymWarmup,
} from "@/lib/gym";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type TaskCategory,
  type Weekday,
} from "@/lib/tasks";
import { WEIGHT_TIME_LABEL } from "@/lib/weight";
import {
  groupWeekPlanBacklogItems,
  groupWeekPlanDayItems,
  type WeekPlanItemGroup,
} from "@/lib/week-plan-groups";
import {
  WEEK_PLAN_BACKLOG_DROP_ID,
  weekPlanDayDropId,
  weekdayFromWeekPlanDropId,
  type UnifiedWeekPlan,
  type WeekPlanItem,
} from "@/lib/week-plan";
import styles from "./weekly-tasks.module.scss";

interface Props {
  weekStart: string;
  plan: UnifiedWeekPlan;
  weightEnabled: boolean;
}

export function UnifiedWeekBoard({
  weekStart,
  plan,
  weightEnabled,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(plan.items);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalItems(plan.items);
  }, [plan.items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const catById = new Map(plan.categories.map((c) => [c.id, c]));
  const sidebarBacklog = localItems.filter(
    (i) =>
      i.weekday == null ||
      (i.kind === "bathing" && i.bathingRole === "source"),
  );
  const byDay = new Map<Weekday, WeekPlanItem[]>(
    WEEKDAYS.map((d) => [d, [] as WeekPlanItem[]]),
  );
  for (const item of localItems) {
    if (item.weekday != null) byDay.get(item.weekday)?.push(item);
  }

  const placedCount = localItems.filter(
    (i) =>
      i.weekday != null &&
      !(i.kind === "bathing" && i.bathingRole === "source"),
  ).length;
  const doneCount = localItems.filter((i) => i.done).length;
  const draggingItem = draggingId
    ? localItems.find((i) => i.dragId === draggingId)
    : null;

  const place = (dragId: string, weekday: Weekday) => {
    const item = localItems.find((i) => i.dragId === dragId);
    if (!item) return;

    const isBathingSource =
      item.kind === "bathing" && item.bathingRole === "source";
    if (!isBathingSource && item.weekday === weekday) return;

    setError(null);
    if (!isBathingSource) {
      setLocalItems((prev) =>
        prev.map((i) => (i.dragId === dragId ? { ...i, weekday } : i)),
      );
    }
    setPendingId(dragId);
    startTransition(async () => {
      const res = await placeWeekPlanItemAction({ dragId, weekStart, weekday });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte placera.");
        setLocalItems(plan.items);
      }
      setPendingId(null);
      router.refresh();
    });
  };

  const unplace = (dragId: string) => {
    const item = localItems.find((i) => i.dragId === dragId);
    if (!item || item.weekday == null) return;
    if (item.kind === "bathing" && item.bathingRole === "source") return;

    setError(null);
    setLocalItems((prev) =>
      item.kind === "bathing" && item.bathingRole === "placement"
        ? prev.filter((i) => i.dragId !== dragId)
        : prev.map((i) => (i.dragId === dragId ? { ...i, weekday: null } : i)),
    );
    setPendingId(dragId);
    startTransition(async () => {
      const res = await unplaceWeekPlanItemAction({ dragId, weekStart });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte flytta tillbaka.");
        setLocalItems(plan.items);
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

    const dragId = String(active.id);
    const overId = String(over.id);

    if (overId === WEEK_PLAN_BACKLOG_DROP_ID) {
      const item = localItems.find((i) => i.dragId === dragId);
      if (item?.kind === "bathing" && item.bathingRole === "source") return;
      unplace(dragId);
      return;
    }

    const weekday = weekdayFromWeekPlanDropId(overId);
    if (weekday) place(dragId, weekday);
  };

  const resetWeek = () => {
    setError(null);
    startTransition(async () => {
      const res = await resetWeekPlanToDefaultsAction(weekStart);
      if (!res.ok) setError(res.error ?? "Kunde inte återställa.");
      router.refresh();
    });
  };

  const enableWeight = () => {
    setError(null);
    startTransition(async () => {
      const res = await enableWeightWeekAction(weekStart);
      if (!res.ok) setError(res.error ?? "Kunde inte slå på vikt.");
      router.refresh();
    });
  };

  const renderGroupedLists = (
    groups: WeekPlanItemGroup[],
    showCheck: boolean,
  ) =>
    groups.map((group) => (
      <div key={group.id} className={styles.itemGroup}>
        <p className={styles.groupLabel}>{group.label}</p>
        <ul className={styles.taskList}>
          {group.items.map((item) => renderItemRow(item, showCheck))}
        </ul>
      </div>
    ));

  const renderItemRow = (
    item: WeekPlanItem,
    showCheck: boolean,
  ) => (
    <DraggableItemRow
      key={item.dragId}
      item={item}
      category={
        item.kind === "task" && item.categoryId
          ? catById.get(item.categoryId)
          : undefined
      }
      weekStart={weekStart}
      expanded={expandedId === item.dragId}
      busy={pendingId === item.dragId}
      dragging={draggingId === item.dragId}
      pending={pending}
      showCheck={showCheck}
      onToggleExpand={() =>
        setExpandedId(expandedId === item.dragId ? null : item.dragId)
      }
      onPlace={place}
      onError={setError}
      onPendingId={setPendingId}
      onDone={() => {
        setExpandedId(null);
        router.refresh();
      }}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.addSection}>
        <AddTaskPanel
          categories={plan.categories}
          defaultScope="weekly"
          weeklyOnly
          embedded
        />
      </div>

      {!weightEnabled ? (
        <div className={styles.weightEnableRow}>
          <span className={styles.weightEnableText}>
            Vikt är avstängd den här veckan.
          </span>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={enableWeight}
            disabled={pending}
          >
            Slå på vikt
          </Button>
        </div>
      ) : null}

      <div className={styles.layout}>
        <aside className={styles.backlogPanel}>
          <BacklogDropZone count={sidebarBacklog.length}>
            <p className={styles.dragHint}>
              Dra till en veckodag →
            </p>
            {sidebarBacklog.length === 0 ? (
              <p className={styles.dayEmpty}>Alla placerade den här veckan.</p>
            ) : (
              <div className={styles.dayGroups}>
                {renderGroupedLists(
                  groupWeekPlanBacklogItems(sidebarBacklog, plan.categories),
                  false,
                )}
              </div>
            )}
          </BacklogDropZone>
        </aside>

        <div className={styles.weekPanel}>
          {error ? <p className={styles.error}>{error}</p> : null}

          {WEEKDAYS.map((d) => {
            const dayItems = byDay.get(d) ?? [];
            const dayDone = dayItems.filter((i) => i.done).length;
            return (
              <DayDropZone key={d} weekday={d}>
                <header className={styles.dayHeader}>
                  <div>
                    <h3 className={styles.dayTitle}>{WEEKDAY_LONG[d]}</h3>
                    <p className={styles.daySub}>{WEEKDAY_SHORT[d]}</p>
                  </div>
                  <span className={styles.dayCount}>
                    {dayItems.length > 0
                      ? `${dayDone}/${dayItems.length}`
                      : "—"}
                  </span>
                </header>

                {dayItems.length === 0 ? (
                  <p className={styles.dayEmpty}>Släpp en aktivitet här.</p>
                ) : (
                  <div className={styles.dayGroups}>
                    {renderGroupedLists(
                      groupWeekPlanDayItems(dayItems, plan.categories),
                      true,
                    )}
                  </div>
                )}
              </DayDropZone>
            );
          })}
        </div>
      </div>

      <div className={styles.summaryRow}>
        <span className={styles.summaryStat}>
          <span className={styles.summaryBig}>{doneCount}</span>
          <span className={styles.summarySlash}>
            / {placedCount} placerade klara
          </span>
        </span>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={resetWeek}
          disabled={pending}
        >
          ↺ Standarddagar
        </button>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingItem ? (
          <ItemCardPreview
            item={draggingItem}
            category={
              draggingItem.kind === "task" && draggingItem.categoryId
                ? catById.get(draggingItem.categoryId)
                : undefined
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BacklogDropZone({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: WEEK_PLAN_BACKLOG_DROP_ID });

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
          <p className={styles.daySub}>veckoaktiviteter</p>
        </div>
        <span className={styles.dayCount}>{count}</span>
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
  const { isOver, setNodeRef } = useDroppable({ id: weekPlanDayDropId(weekday) });

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

interface DraggableItemRowProps {
  item: WeekPlanItem;
  category?: TaskCategory;
  weekStart: string;
  expanded: boolean;
  busy: boolean;
  dragging: boolean;
  pending: boolean;
  showCheck: boolean;
  onToggleExpand: () => void;
  onPlace: (dragId: string, weekday: Weekday) => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

function DraggableItemRow({
  item,
  category,
  weekStart,
  expanded,
  busy,
  dragging,
  pending,
  showCheck,
  onToggleExpand,
  onPlace,
  onError,
  onPendingId,
  onDone,
}: DraggableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.dragId,
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
        styles.task,
        item.done ? styles.taskDone : "",
        busy ? styles.taskBusy : "",
        dragging ? styles.taskDragging : "",
        expanded ? styles.taskExpanded : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ItemRowContent
        item={item}
        category={category}
        weekStart={weekStart}
        expanded={expanded}
        pending={pending}
        busy={busy}
        showCheck={showCheck}
        dragHandleProps={{ ...attributes, ...listeners }}
        onToggleExpand={onToggleExpand}
        onPlace={onPlace}
        onError={onError}
        onPendingId={onPendingId}
        onDone={onDone}
      />
    </li>
  );
}

function ItemCardPreview({
  item,
  category,
}: {
  item: WeekPlanItem;
  category?: TaskCategory;
}) {
  return (
    <div
      className={[
        styles.task,
        styles.taskPreview,
        item.done ? styles.taskDone : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ItemRowContent
        item={item}
        category={category}
        weekStart=""
        expanded={false}
        pending={false}
        busy={false}
        showCheck={false}
        preview
        onToggleExpand={() => {}}
        onPlace={() => {}}
        onError={() => {}}
        onPendingId={() => {}}
        onDone={() => {}}
      />
    </div>
  );
}

interface ItemRowContentProps {
  item: WeekPlanItem;
  category?: TaskCategory;
  weekStart: string;
  expanded: boolean;
  pending: boolean;
  busy: boolean;
  showCheck: boolean;
  preview?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onToggleExpand: () => void;
  onPlace: (dragId: string, weekday: Weekday) => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

function ItemRowContent({
  item,
  category,
  weekStart,
  expanded,
  pending,
  busy,
  showCheck,
  preview = false,
  dragHandleProps,
  onToggleExpand,
  onPlace,
  onError,
  onPendingId,
  onDone,
}: ItemRowContentProps) {
  const [, startTransition] = useTransition();
  const [warmup, setWarmup] = useState<GymWarmup | null>(
    item.kind === "gym" ? item.warmup : null,
  );
  const [cardioNote, setCardioNote] = useState(
    item.kind === "cardio" ? (item.session.placement.note ?? "") : "",
  );
  const [bathingWaterTemp, setBathingWaterTemp] = useState(
    item.kind === "bathing" && item.session.placement.waterTempC != null
      ? String(item.session.placement.waterTempC)
      : "",
  );
  const [taskPlanNote, setTaskPlanNote] = useState(
    item.kind === "task" ? (item.placement?.planNote ?? "") : "",
  );
  const taskPlanningExpand =
    item.kind === "task" &&
    (item.completionKind === "journal" || item.completionKind === "laundry");

  const kindLabel =
    item.kind === "gym"
      ? "Gym"
      : item.kind === "cardio"
        ? "Cardio"
        : item.kind === "bathing"
          ? "Bad & bastu"
          : item.kind === "weight"
            ? "Vikt"
            : null;

  const saveTaskPlan = () => {
    if (item.kind !== "task") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await updateWeeklyTaskPlanAction({
        taskId: item.taskId,
        weekStart,
        planNote: taskPlanNote,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const completeGym = () => {
    if (item.kind !== "gym") return;
    if (!warmup) {
      onError("Välj uppvärmning innan du markerar klart.");
      return;
    }
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await completeGymSessionAction({
        templateId: item.templateId,
        weekStart,
        warmup,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const uncompleteGym = () => {
    if (item.kind !== "gym") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await uncompleteGymSessionAction({
        templateId: item.templateId,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setWarmup(null);
      onPendingId(null);
      onDone();
    });
  };

  const completeCardio = () => {
    if (item.kind !== "cardio") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await completeCardioSessionAction({
        templateId: item.templateId,
        weekStart,
        note: cardioNote,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const uncompleteCardio = () => {
    if (item.kind !== "cardio") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await uncompleteCardioSessionAction({
        templateId: item.templateId,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setCardioNote("");
      onPendingId(null);
      onDone();
    });
  };

  const completeBathing = () => {
    if (item.kind !== "bathing" || item.bathingRole !== "placement" || !item.placementId) {
      return;
    }
    const placementId = item.placementId;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const needsTemp = bathingRequiresWaterTemp(item.session.key);
      const parsed = needsTemp
        ? Number(bathingWaterTemp.replace(",", "."))
        : undefined;
      const res = await completeBathingSessionAction({
        placementId,
        weekStart,
        waterTempC: parsed,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const uncompleteBathing = () => {
    if (item.kind !== "bathing" || item.bathingRole !== "placement" || !item.placementId) {
      return;
    }
    const placementId = item.placementId;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await uncompleteBathingSessionAction({
        placementId,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setBathingWaterTemp("");
      onPendingId(null);
      onDone();
    });
  };

  const disableWeight = () => {
    if (item.kind !== "weight") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await setWeightWeekEnabledAction({
        weekStart,
        enabled: false,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte stänga av.");
      onPendingId(null);
      onDone();
    });
  };

  const detail =
    item.kind === "weight" && item.log
      ? `${formatWeightKg(item.log.weightKg)} · ${WEIGHT_TIME_LABEL[item.log.timeOfDay]}`
      : item.kind === "bathing" &&
          item.done &&
          item.session.placement.waterTempC != null
        ? formatWaterTemp(item.session.placement.waterTempC)
        : item.subtitle;

  return (
    <>
      {showCheck &&
        (item.kind === "gym" ||
          item.kind === "cardio" ||
          (item.kind === "bathing" && item.bathingRole === "placement") ||
          item.kind === "weight") ? (
        <button
          type="button"
          className={[styles.checkBtn, item.done ? styles.checkBtnDone : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={item.done ? "Klart" : "Logga"}
          onClick={onToggleExpand}
          disabled={pending}
        >
          {item.done ? (
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
        <span className={styles.checkPlaceholder} aria-hidden />
      )}

      {!preview ? (
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Dra ${item.label}`}
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
        className={styles.taskBody}
        onClick={preview ? undefined : onToggleExpand}
        aria-expanded={expanded}
        disabled={pending || preview}
      >
        <span
          className={styles.taskIcon}
          aria-hidden
          style={{ borderColor: item.accent }}
        >
          {item.icon}
        </span>
        <span className={styles.taskMeta}>
          <span className={styles.taskTitle}>{item.label}</span>
          {kindLabel ? (
            <span className={styles.taskKind}>{kindLabel}</span>
          ) : category ? (
            <span className={styles.taskCategory} style={{ color: category.accent }}>
              {category.icon} {category.name}
            </span>
          ) : null}
          {detail ? <span className={styles.taskNotes}>{detail}</span> : null}
        </span>
        {!preview &&
        (taskPlanningExpand ||
          item.kind === "gym" ||
          item.kind === "cardio" ||
          (item.kind === "bathing" && item.bathingRole === "placement") ||
          item.kind === "weight") ? (
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
        <div className={styles.taskActions}>
          <p className={styles.actionsLabel}>Flytta till annan dag</p>
          <div className={styles.weekdayRow} role="radiogroup">
            {WEEKDAYS.map((d) => {
              const active = item.weekday === d;
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
                  onClick={() => onPlace(item.dragId, d)}
                  disabled={pending}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              );
            })}
          </div>

          {item.kind === "gym" && !item.done ? (
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
                onClick={completeGym}
              >
                Markera klart
              </Button>
            </>
          ) : null}

          {item.kind === "gym" && item.done ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={uncompleteGym}
              disabled={pending}
            >
              Ångra klarmarkering
            </button>
          ) : null}

          {item.kind === "cardio" && !item.done ? (
            <>
              <Input
                label="Kommentar"
                value={cardioNote}
                onChange={(e) => setCardioNote(e.target.value)}
                placeholder="T.ex. 5 km löpning"
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
                onClick={completeCardio}
              >
                Markera klart
              </Button>
            </>
          ) : null}

          {item.kind === "cardio" && item.done ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={uncompleteCardio}
              disabled={pending}
            >
              Ångra klarmarkering
            </button>
          ) : null}

          {item.kind === "bathing" &&
          item.bathingRole === "placement" &&
          !item.done ? (
            <>
              {bathingRequiresWaterTemp(item.session.key) ? (
                <Input
                  label="Vattentemperatur (°C)"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={bathingWaterTemp}
                  onChange={(e) => setBathingWaterTemp(e.target.value)}
                  placeholder="t.ex. 4"
                  disabled={pending}
                />
              ) : null}
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={completeBathing}
              >
                Markera klart
              </Button>
            </>
          ) : null}

          {item.kind === "bathing" &&
          item.bathingRole === "placement" &&
          item.done ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={uncompleteBathing}
              disabled={pending}
            >
              Ångra klarmarkering
            </button>
          ) : null}

          {item.kind === "weight" ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={disableWeight}
              disabled={pending}
            >
              Stäng av vikt den här veckan
            </button>
          ) : null}

          {item.kind === "task" && taskPlanningExpand ? (
            <>
              {item.completionKind === "journal" ? (
                <Input
                  label="Vad ska du jobba med?"
                  value={taskPlanNote}
                  onChange={(e) => setTaskPlanNote(e.target.value)}
                  placeholder="Beskriv uppgiften"
                  maxLength={280}
                  disabled={pending}
                />
              ) : null}
              {item.completionKind === "laundry" ? (
                <Input
                  label="Bokad tid"
                  value={taskPlanNote}
                  onChange={(e) => setTaskPlanNote(e.target.value)}
                  placeholder="t.ex. 14:00"
                  maxLength={80}
                  disabled={pending}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={saveTaskPlan}
              >
                Spara plan
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
