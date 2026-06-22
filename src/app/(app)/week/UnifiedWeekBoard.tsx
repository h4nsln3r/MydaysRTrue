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
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
  completeSportSessionAction,
  uncompleteSportSessionAction,
  updateSportPlanAction,
} from "@/app/(app)/sport-actions";
import {
  completeGymSessionAction,
  uncompleteGymSessionAction,
} from "@/app/(app)/gym-actions";
import {
  updateWeeklyTaskPlanAction,
  toggleMonthlyTaskDoneAction,
  toggleWeeklyTaskDoneAction,
} from "@/app/(app)/tasks-actions";
import { setWeightWeekEnabledAction } from "@/app/(app)/weight-actions";
import {
  enableWeightWeekAction,
  placeWeekPlanItemAction,
  reorderWeekPlanDayAction,
  resetWeekPlanToDefaultsAction,
  unplaceWeekPlanItemAction,
} from "@/app/(app)/week-plan-actions";
import { AddTaskPanel } from "@/components/AddTaskPanel/AddTaskPanel";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MusicTaskChecklist } from "@/components/MusicTaskChecklist/MusicTaskChecklist";
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
  type WeekPlanItemGroup,
} from "@/lib/week-plan-groups";
import {
  WEEK_PLAN_BACKLOG_DROP_ID,
  weekPlanBathingSourceDragId,
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
    if (isBathingSource) {
      setLocalItems((prev) => {
        const source = prev.find((i) => i.dragId === dragId);
        if (
          !source ||
          source.kind !== "bathing" ||
          source.bathingRole !== "source"
        ) {
          return prev.filter((i) => i.dragId !== dragId);
        }
        // "bad" is repeatable: keep the source so it can be dragged again.
        const repeatable = source.session.key === "bad";
        const rest = repeatable
          ? prev
          : prev.filter((i) => i.dragId !== dragId);
        const uid = `${source.templateId}-${Date.now()}`;
        const optimisticPlacement: WeekPlanItem = {
          ...source,
          dragId: `bathing:optimistic-${uid}`,
          bathingRole: "placement",
          placementId: `optimistic-${uid}`,
          weekday,
        };
        return [...rest, optimisticPlacement];
      });
    } else {
      setLocalItems((prev) => {
        const moving = prev.find((i) => i.dragId === dragId);
        if (!moving) return prev;
        const dayItems = prev.filter(
          (i) =>
            i.weekday === weekday &&
            !(i.kind === "bathing" && i.bathingRole === "source"),
        );
        const nextOrder =
          moving.weekday === weekday
            ? moving.sortOrder
            : dayItems.length > 0
              ? Math.max(...dayItems.map((t) => t.sortOrder)) + 1
              : 0;
        return prev.map((i) => {
          if (i.dragId !== dragId) return i;
          const next = { ...i, weekday, sortOrder: nextOrder };
          if (i.kind === "task" && i.placement) {
            return {
              ...next,
              placement: {
                ...i.placement,
                weekday,
                daySortOrder: nextOrder,
              },
            };
          }
          return next;
        });
      });
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
    setLocalItems((prev) => {
      if (item.kind === "bathing" && item.bathingRole === "placement") {
        const without = prev.filter((i) => i.dragId !== dragId);
        const sourceItem: WeekPlanItem = {
          dragId: weekPlanBathingSourceDragId(item.templateId),
          kind: "bathing",
          bathingRole: "source",
          templateId: item.templateId,
          placementId: null,
          label: item.label,
          subtitle: item.subtitle,
          icon: item.icon,
          accent: item.accent,
          defaultWeekday: item.defaultWeekday,
          weekday: null,
          done: false,
          sortOrder: item.sortOrder,
          session: {
            ...item.session,
            placement: {
              id: "",
              templateId: item.templateId,
              weekStart,
              weekday: null,
              daySortOrder: 0,
              waterTempC: null,
              doneAt: null,
              note: null,
            },
          },
        };
        return [...without, sourceItem];
      }
      return prev.map((i) =>
        i.dragId === dragId ? { ...i, weekday: null } : i,
      );
    });
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

    const activeItem = localItems.find((i) => i.dragId === dragId);
    const overItem = localItems.find((i) => i.dragId === overId);
    const canReorder = (item: WeekPlanItem | undefined) =>
      item != null &&
      item.weekday != null &&
      !(item.kind === "bathing" && item.bathingRole === "source");

    if (
      canReorder(activeItem) &&
      canReorder(overItem) &&
      activeItem!.weekday === overItem!.weekday
    ) {
      const weekday = activeItem!.weekday!;
      const dayItems = sortDayItems(
        localItems.filter(
          (i) =>
            i.weekday === weekday &&
            !(i.kind === "bathing" && i.bathingRole === "source"),
        ),
      );
      const oldIndex = dayItems.findIndex((t) => t.dragId === dragId);
      const newIndex = dayItems.findIndex((t) => t.dragId === overId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        const reordered = arrayMove(dayItems, oldIndex, newIndex);
        const orderById = new Map(
          reordered.map((t, i) => [t.dragId, i] as const),
        );
        setLocalItems((prev) =>
          prev.map((i) => {
            const order = orderById.get(i.dragId);
            if (order == null) return i;
            const next = { ...i, sortOrder: order };
            if (i.kind === "task" && i.placement) {
              return {
                ...next,
                placement: { ...i.placement, daySortOrder: order },
              };
            }
            return next;
          }),
        );
        setPendingId(dragId);
        startTransition(async () => {
          const res = await reorderWeekPlanDayAction({
            weekStart,
            weekday,
            dragIds: reordered.map((t) => t.dragId),
          });
          if (!res.ok) {
            setError(res.error ?? "Kunde inte spara ordning.");
            setLocalItems(plan.items);
          }
          setPendingId(null);
          router.refresh();
        });
      }
      return;
    }

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

  const renderSortableDayItems = (items: WeekPlanItem[]) => (
    <SortableContext
      items={items.map((t) => t.dragId)}
      strategy={verticalListSortingStrategy}
    >
      <ul className={styles.taskList}>
        {items.map((item) => renderItemRow(item, true, true))}
      </ul>
    </SortableContext>
  );

  const renderItemRow = (
    item: WeekPlanItem,
    showCheck: boolean,
    sortable = false,
  ) => (
    sortable ? (
      <SortableItemRow
        key={item.dragId}
        item={item}
        weekStart={weekStart}
        expanded={expandedId === item.dragId}
        busy={pendingId === item.dragId}
        dragging={draggingId === item.dragId}
        pending={pending}
        showCheck={showCheck}
        showCategory={false}
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
    ) : (
      <DraggableItemRow
        key={item.dragId}
        item={item}
        category={
          (item.kind === "task" || item.kind === "monthly_bill") && item.categoryId
            ? catById.get(item.categoryId)
            : undefined
        }
        weekStart={weekStart}
        expanded={expandedId === item.dragId}
        busy={pendingId === item.dragId}
        dragging={draggingId === item.dragId}
        pending={pending}
        showCheck={showCheck}
        showCategory
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
    )
  );

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
          weekStart={weekStart}
          allowOneOff
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
            const dayItems = sortDayItems(
              (byDay.get(d) ?? []).filter(
                (i) => !(i.kind === "bathing" && i.bathingRole === "source"),
              ),
            );
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
                    {renderSortableDayItems(dayItems)}
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
              draggingItem.weekday == null &&
              (draggingItem.kind === "task" ||
                draggingItem.kind === "monthly_bill") &&
              draggingItem.categoryId
                ? catById.get(draggingItem.categoryId)
                : undefined
            }
            showCategory={draggingItem.weekday == null}
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
  showCategory?: boolean;
  onToggleExpand: () => void;
  onPlace: (dragId: string, weekday: Weekday) => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onDone: () => void;
}

function SortableItemRow(props: DraggableItemRowProps) {
  const { item, pending } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.dragId,
    disabled: pending,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        styles.task,
        item.done ? styles.taskDone : "",
        props.busy ? styles.taskBusy : "",
        isDragging || props.dragging ? styles.taskDragging : "",
        props.expanded ? styles.taskExpanded : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ItemRowContent
        item={item}
        category={props.category}
        weekStart={props.weekStart}
        expanded={props.expanded}
        pending={props.pending}
        busy={props.busy}
        showCheck={props.showCheck}
        showCategory={props.showCategory}
        dragHandleProps={{ ...attributes, ...listeners }}
        onToggleExpand={props.onToggleExpand}
        onPlace={props.onPlace}
        onError={props.onError}
        onPendingId={props.onPendingId}
        onDone={props.onDone}
      />
    </li>
  );
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
  showCategory = true,
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
        showCategory={showCategory}
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
  showCategory = true,
}: {
  item: WeekPlanItem;
  category?: TaskCategory;
  showCategory?: boolean;
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
        showCategory={showCategory}
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
  showCategory?: boolean;
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
  showCategory = true,
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
  const [gymNote, setGymNote] = useState(
    item.kind === "gym" ? (item.session.placement.note ?? "") : "",
  );
  const [cardioNote, setCardioNote] = useState(
    item.kind === "cardio" ? (item.session.placement.note ?? "") : "",
  );
  const [sportPlan, setSportPlan] = useState(
    item.kind === "sport" ? (item.session.placement.planSport ?? "") : "",
  );
  const [sportActual, setSportActual] = useState(
    item.kind === "sport"
      ? (item.session.placement.actualSport ?? item.session.placement.planSport ?? "")
      : "",
  );
  const [sportNote, setSportNote] = useState(
    item.kind === "sport" ? (item.session.placement.note ?? "") : "",
  );
  const [sportCompanions, setSportCompanions] = useState(
    item.kind === "sport" ? (item.session.placement.companions ?? "") : "",
  );
  const [bathingWaterTemp, setBathingWaterTemp] = useState(
    item.kind === "bathing" && item.session.placement.waterTempC != null
      ? String(item.session.placement.waterTempC)
      : "",
  );
  const [bathingNote, setBathingNote] = useState(
    item.kind === "bathing" ? (item.session.placement.note ?? "") : "",
  );
  const [taskPlanNote, setTaskPlanNote] = useState(
    item.kind === "task" ? (item.placement?.planNote ?? "") : "",
  );
  const taskPlanningExpand =
    item.kind === "task" &&
    (item.completionKind === "journal" ||
      item.completionKind === "laundry" ||
      item.completionKind === "music");

  const kindLabel =
    showCategory &&
    (item.kind === "gym"
      ? "Gym"
      : item.kind === "cardio"
        ? "Cardio"
        : item.kind === "sport"
          ? "Sport"
          : item.kind === "bathing"
          ? "Bad & bastu"
          : item.kind === "weight"
            ? "Vikt"
            : item.kind === "monthly_bill"
              ? "Räkning"
              : null);

  const toggleMonthlyBill = () => {
    if (item.kind !== "monthly_bill") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await toggleMonthlyTaskDoneAction({
        taskId: item.taskId,
        monthStart: item.monthStart,
        done: !item.done,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
      onPendingId(null);
      onDone();
    });
  };

  const toggleTaskDone = () => {
    if (item.kind !== "task") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await toggleWeeklyTaskDoneAction({
        taskId: item.taskId,
        weekStart,
        done: !item.done,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte uppdatera.");
      onPendingId(null);
      onDone();
    });
  };

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
        note: gymNote,
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
      setGymNote("");
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

  const saveSportPlan = () => {
    if (item.kind !== "sport") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await updateSportPlanAction({
        templateId: item.templateId,
        weekStart,
        planSport: sportPlan,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara plan.");
      onPendingId(null);
      onDone();
    });
  };

  const completeSport = () => {
    if (item.kind !== "sport") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await completeSportSessionAction({
        templateId: item.templateId,
        weekStart,
        actualSport: sportActual,
        note: sportNote,
        companions: sportCompanions,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte spara.");
      onPendingId(null);
      onDone();
    });
  };

  const uncompleteSport = () => {
    if (item.kind !== "sport") return;
    onError(null);
    onPendingId(item.dragId);
    startTransition(async () => {
      const res = await uncompleteSportSessionAction({
        templateId: item.templateId,
        weekStart,
      });
      if (!res.ok) onError(res.error ?? "Kunde inte ångra.");
      setSportActual(item.session.placement.planSport ?? "");
      setSportNote("");
      setSportCompanions("");
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
        note: bathingNote,
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
      setBathingNote("");
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

  const bathingDetail =
    item.kind === "bathing" && item.done
      ? [
          item.session.placement.waterTempC != null
            ? formatWaterTemp(item.session.placement.waterTempC)
            : null,
          item.session.placement.note?.trim() || null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined
      : undefined;

  const detail =
    item.kind === "weight" && item.log
      ? `${formatWeightKg(item.log.weightKg)} · ${WEIGHT_TIME_LABEL[item.log.timeOfDay]}`
      : bathingDetail ?? item.subtitle;

  return (
    <>
      {showCheck &&
        (item.kind === "task" ||
          item.kind === "gym" ||
          item.kind === "cardio" ||
          item.kind === "sport" ||
          (item.kind === "bathing" && item.bathingRole === "placement") ||
          item.kind === "weight" ||
          item.kind === "monthly_bill") ? (
        <button
          type="button"
          className={[styles.checkBtn, item.done ? styles.checkBtnDone : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={item.done ? "Markera ej klar" : "Markera klar"}
          aria-pressed={item.done}
          onClick={
            item.kind === "task"
              ? toggleTaskDone
              : item.kind === "monthly_bill"
                ? toggleMonthlyBill
                : onToggleExpand
          }
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
          ) : showCategory && category ? (
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
          item.kind === "sport" ||
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
          {item.kind !== "bathing" ? (
            <>
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
            </>
          ) : null}

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
              <Input
                label="Kommentar"
                value={gymNote}
                onChange={(e) => setGymNote(e.target.value)}
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

          {item.kind === "sport" && !item.done ? (
            <>
              <Input
                label="Planerad sport"
                value={sportPlan}
                onChange={(e) => setSportPlan(e.target.value)}
                placeholder="t.ex. frisbee golf, badminton"
                maxLength={80}
                disabled={pending}
              />
              <button
                type="button"
                className={styles.undoBtn}
                onClick={saveSportPlan}
                disabled={pending}
              >
                Spara plan
              </button>
              <Input
                label="Vad blev det?"
                value={sportActual}
                onChange={(e) => setSportActual(e.target.value)}
                placeholder="t.ex. frisbee golf på Berga"
                maxLength={80}
                disabled={pending}
              />
              <Input
                label="Hur gick det?"
                value={sportNote}
                onChange={(e) => setSportNote(e.target.value)}
                placeholder="Bra rundor, trött ben…"
                maxLength={280}
                disabled={pending}
              />
              <Input
                label="Vem var med?"
                value={sportCompanions}
                onChange={(e) => setSportCompanions(e.target.value)}
                placeholder="t.ex. Johan, Lisa"
                maxLength={120}
                disabled={pending}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending && busy}
                disabled={pending}
                onClick={completeSport}
              >
                Markera klart
              </Button>
            </>
          ) : null}

          {item.kind === "sport" && item.done ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={uncompleteSport}
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
                <div className={styles.bathingTempRow}>
                  <span className={styles.bathingFieldLabel}>Temp</span>
                  <div className={styles.bathingTempField}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      className={styles.bathingTempInput}
                      value={bathingWaterTemp}
                      onChange={(e) => setBathingWaterTemp(e.target.value)}
                      placeholder="4"
                      aria-label="Vattentemperatur i grader Celsius"
                      disabled={pending}
                    />
                    <span className={styles.bathingTempUnit}>°C</span>
                  </div>
                </div>
              ) : null}
              <label className={styles.bathingNoteField}>
                <span className={styles.bathingFieldLabel}>Kommentar</span>
                <textarea
                  className={styles.bathingNoteInput}
                  value={bathingNote}
                  onChange={(e) => setBathingNote(e.target.value)}
                  placeholder="Var badade du? Hur kändes det?"
                  rows={2}
                  maxLength={280}
                  disabled={pending}
                />
              </label>
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
              {item.completionKind === "music" ? (
                <>
                  <MusicTaskChecklist
                    taskId={item.taskId}
                    items={item.checklist}
                    disabled={pending}
                  />
                  <Input
                    label="Kommentar denna vecka"
                    value={taskPlanNote}
                    onChange={(e) => setTaskPlanNote(e.target.value)}
                    placeholder="Valfri anteckning"
                    maxLength={280}
                    disabled={pending}
                  />
                </>
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

function sortDayItems(items: WeekPlanItem[]): WeekPlanItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}
