"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDayReschedule } from "@/lib/use-day-reschedule";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card } from "@/components/Card/Card";
import { BathingExtraBath } from "@/components/BathingDayCard/BathingDayCard";
import { DayQuickAdd } from "@/components/DayQuickAdd/DayQuickAdd";
import {
  toDayQuickAddTask,
  type DayQuickAddSources,
} from "@/lib/day-quick-add";
import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import { buildDayPlanItems, sortDayPlanItems, type DayPlanItem } from "@/lib/day-plan";
import { isoWeekdayFromLocalISO } from "@/lib/date";
import { formatTripDayTitle } from "@/lib/leave";
import type { DailyHabit, DailySnacks, MealBoxStockItem, MealEntry, MealKey, MealRestaurant } from "@/lib/habits";
import type { DailyActivityLog, DailyTrackerGoals } from "@/lib/habits.server";
import type { IntakeEntry, IntakeKind } from "@/lib/intake";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import type { MonthlyTaskForMonth, TaskCategory, Weekday, WeeklyTaskForWeek } from "@/lib/tasks";
import type { CodingProject } from "@/lib/coding";
import type { UserGame } from "@/lib/games";
import type { UserSport } from "@/lib/sports";
import type { WeightDayContext } from "@/lib/weight";
import type { DailyMediaContext } from "@/lib/media";
import type { DailyLiveEventsContext } from "@/lib/live-events";
import type { WorkDailyLog } from "@/lib/work";
import type { LeaveKind, TripDayContext } from "@/lib/leave";
import { reorderDayPlanAction } from "@/app/(app)/day-plan-actions";
import {
  useBackgroundSave,
  useSyncNavPending,
} from "@/components/NavProgress/NavProgress";
import { DayActivityRow } from "./DayActivityRow";
import { PlanSortableRow } from "./PlanSortableRow";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

/**
 * Keep local drag order across refresh, but let completed items sink below
 * pending ones (and restore pending order if something is unchecked).
 */
function mergeDayPlanItems(
  serverItems: DayPlanItem[],
  localItems: DayPlanItem[],
): DayPlanItem[] {
  if (localItems.length === 0) return serverItems;
  const serverByKey = new Map(serverItems.map((item) => [item.itemKey, item]));
  const orderedKeys = localItems
    .map((item) => item.itemKey)
    .filter((key) => serverByKey.has(key));
  if (orderedKeys.length === 0) return serverItems;
  const seen = new Set(orderedKeys);
  const extras = serverItems.filter((item) => !seen.has(item.itemKey));
  const merged = [
    ...orderedKeys.map((key) => serverByKey.get(key)!),
    ...extras,
  ].map((item, index) => ({ ...item, sortOrder: index }));
  return sortDayPlanItems(merged);
}

interface Props {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  monthlyTasks?: MonthlyTaskForMonth[];
  monthStart?: string;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  weight: WeightDayContext;
  habits: DailyHabit[];
  meals: Record<MealKey, MealEntry | null>;
  snacks: DailySnacks;
  savedRestaurants?: MealRestaurant[];
  mealBoxStock?: MealBoxStockItem[];
  intake: Record<IntakeKind, IntakeEntry | null>;
  work: WorkDailyLog;
  /** When true, Jobb start/slut are omitted from the day plan. */
  onLeave?: boolean;
  /** Semester, ledig or resa. Used to hide daily habits. */
  leaveKind?: LeaveKind | null;
  activityLog: DailyActivityLog;
  goals: DailyTrackerGoals;
  media?: DailyMediaContext;
  liveEvents?: DailyLiveEventsContext;
  tripDay?: TripDayContext | null;
  savedOrder: Map<string, number>;
  categories: TaskCategory[];
  /** Repeatable week-plan tasks the plus button can drop on this day. */
  addableTasks?: WeeklyTaskForWeek[];
  quickAddSources?: DayQuickAddSources;
  date?: string;
  today?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
  enableQuickAdd?: boolean;
  bathingWeekday?: Weekday | null;
  enableExtraBath?: boolean;
  /** Future day in the current week — reorder only, no logging. */
  planningMode?: boolean;
  codingProjects?: CodingProject[];
  games?: UserGame[];
  sports?: UserSport[];
}

export function DayActivitiesCard({
  weekStart,
  tasks,
  monthlyTasks = [],
  monthStart,
  gymSessions,
  cardioSessions,
  sportSessions,
  bathingSessions,
  weight,
  habits,
  meals,
  snacks,
  savedRestaurants = [],
  mealBoxStock = [],
  intake,
  work,
  onLeave = false,
  leaveKind = null,
  activityLog,
  goals,
  media,
  liveEvents,
  tripDay = null,
  savedOrder,
  categories,
  addableTasks = [],
  quickAddSources,
  date,
  today,
  hideWhenEmpty = false,
  showWeekLink = true,
  enableQuickAdd: _enableQuickAdd = false,
  bathingWeekday = null,
  enableExtraBath = false,
  planningMode = false,
  codingProjects = [],
  games = [],
  sports = [],
}: Props) {
  const router = useRouter();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [adding, setAdding] = useState(false);
  const reorderGen = useRef(0);
  const addingBaseline = useRef<string | null>(null);
  const { clearQueuedNavigation } = useBackgroundSave(savingOrder);

  const planDate = date ?? today ?? "";

  const builtItems = useMemo(
    () =>
      buildDayPlanItems({
        date: planDate,
        tasks,
        monthlyTasks,
        monthStart,
        gymSessions,
        cardioSessions,
        sportSessions,
        bathingSessions,
        weight,
        habits,
        meals,
        snacks,
        intake,
        work,
        onLeave,
        leaveKind,
        activityLog,
        goals,
        media,
        liveEvents,
        tripDay,
        savedOrder,
      }),
    [
      planDate,
      tasks,
      monthlyTasks,
      monthStart,
      gymSessions,
      cardioSessions,
      sportSessions,
      bathingSessions,
      weight,
      habits,
      meals,
      snacks,
      intake,
      work,
      onLeave,
      leaveKind,
      activityLog,
      goals,
      media,
      liveEvents,
      tripDay,
      savedOrder,
    ],
  );

  useSyncNavPending(pendingKey != null, builtItems);

  const [localItems, setLocalItems] = useState(builtItems);

  useEffect(() => {
    setLocalItems((prev) => mergeDayPlanItems(builtItems, prev));
  }, [builtItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const { isOverdue, canReschedule, rescheduleDays } = useDayReschedule({
    date,
    today,
    weekStart,
    planningMode,
  });

  const doneCount = localItems.filter((i) => i.doneAt).length;
  const itemKeys = localItems.map((i) => i.itemKey);

  const addWeekday =
    date != null ? (isoWeekdayFromLocalISO(date) as Weekday) : null;

  const showExtraBath = enableExtraBath && bathingWeekday != null;

  const quickAddSourcesOrEmpty: DayQuickAddSources = quickAddSources ?? {
    gym: [],
    cardioTemplateId: null,
    sportTemplateId: null,
    baths: [],
    shake: null,
  };

  const beginAdding = () => {
    if (addingBaseline.current == null) {
      addingBaseline.current = builtItems.map((item) => item.itemKey).join("\n");
    }
    setAdding(true);
  };

  const stopAdding = () => {
    addingBaseline.current = null;
    setAdding(false);
  };

  useEffect(() => {
    if (!adding || addingBaseline.current == null) return;
    const now = builtItems.map((item) => item.itemKey).join("\n");
    if (now !== addingBaseline.current) stopAdding();
  }, [adding, builtItems]);

  useEffect(() => {
    if (!adding) return;
    const timer = window.setTimeout(stopAdding, 12000);
    return () => window.clearTimeout(timer);
  }, [adding]);

  const quickAdd =
    addOpen && addWeekday != null ? (
      <DayQuickAdd
        weekStart={weekStart}
        weekday={addWeekday}
        categories={categories}
        tasks={addableTasks.map(toDayQuickAddTask)}
        sources={quickAddSourcesOrEmpty}
        games={games}
        sports={sports}
        onCancel={() => setAddOpen(false)}
        onListPending={(waiting) => {
          if (waiting) beginAdding();
          else stopAdding();
        }}
        onAdded={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />
    ) : null;

  const pendingRow = adding ? (
    <li className={styles.pendingRow} role="status" aria-live="polite">
      <span className={[styles.saveSpinner, styles.pendingSpinner].join(" ")} aria-hidden />
      Lägger till…
    </li>
  ) : null;

  const extraBath = showExtraBath ? (
    <BathingExtraBath
      weekStart={weekStart}
      weekday={bathingWeekday}
      onAdded={() => router.refresh()}
    />
  ) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !planDate) return;

    const oldIndex = localItems.findIndex((i) => i.itemKey === active.id);
    const newIndex = localItems.findIndex((i) => i.itemKey === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(localItems, oldIndex, newIndex).map((item, index) => ({
      ...item,
      sortOrder: index,
    }));
    const previous = localItems;
    setLocalItems(next);
    setError(null);
    setSavingOrder(true);

    const gen = ++reorderGen.current;
    void reorderDayPlanAction({
      localDate: planDate,
      orderedKeys: next.map((i) => i.itemKey),
    })
      .then((res) => {
        if (gen !== reorderGen.current) return;
        if (!res.ok) {
          clearQueuedNavigation();
          setError(res.error ?? "Kunde inte spara ordning.");
          setLocalItems(previous);
        }
        setSavingOrder(false);
      })
      .catch(() => {
        if (gen !== reorderGen.current) return;
        clearQueuedNavigation();
        setError("Kunde inte spara ordning.");
        setLocalItems(previous);
        setSavingOrder(false);
      });
  };

  if (localItems.length === 0 && hideWhenEmpty && !addWeekday && !extraBath && !onLeave) {
    return null;
  }

  const showControls =
    addWeekday != null || savingOrder || localItems.length > 0;

  const addControl = showControls ? (
    <div className={styles.planActions}>
      {addWeekday != null ? (
        <button
          type="button"
          className={styles.headerAdd}
          aria-label="Lägg till på dagen"
          title="Lägg till engångsuppgift eller en veckoaktivitet"
          aria-pressed={addOpen}
          aria-expanded={addOpen}
          onClick={() => setAddOpen((open) => !open)}
        >
          +
        </button>
      ) : null}
      {savingOrder ? (
        <span
          className={styles.saveSpinner}
          role="status"
          aria-live="polite"
          aria-label="Sparar ordning"
        />
      ) : null}
    </div>
  ) : null;

  const counter = localItems.length > 0 ? (
    <span
      className={[
        styles.counter,
        doneCount === localItems.length ? styles.counterDone : "",
        doneCount > 0 && doneCount < localItems.length
          ? styles.counterPartial
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.counterBig}>{doneCount}</span>
      <span className={styles.counterSlash}>/ {localItems.length}</span>
    </span>
  ) : null;

  const showHint = !tripDay && (localItems.length > 0 || onLeave);
  const showWeek = showWeekLink || planningMode;
  const showCardHeader = (!tripDay && showControls) || showHint || showWeek;

  return (
    <>
      {tripDay ? (
        <div className={styles.dayToolbar}>
          <h2 className={styles.tripTitle}>
            {formatTripDayTitle(tripDay.title, tripDay.dayIndex, tripDay.dayCount)}
          </h2>
          <div className={styles.dayToolbarEnd}>
            {addControl}
            {counter}
          </div>
        </div>
      ) : null}
      <Card className={[styles.card, styles.planCard].filter(Boolean).join(" ")}>
      {showCardHeader ? (
        <header className={[styles.header, styles.planHeader].filter(Boolean).join(" ")}>
          {!tripDay && showControls ? (
            <div className={styles.titleRow}>
              {addControl}
              {counter}
            </div>
          ) : null}
          {!tripDay && (localItems.length > 0 || onLeave) ? (
            <p className={styles.planHint}>
              {onLeave
                ? "Ledig idag — Jobb visas inte. Dagsuppgifter följer visningen under Inställningar."
                : planningMode
                  ? "Dra ⠿ för att planera ordningen inför dagen"
                  : "Dra ⠿ för att ändra ordning idag"}
            </p>
          ) : null}
          {showWeekLink || planningMode ? (
            <Link
              href={`/week?start=${weekStart}&view=plan`}
              className={styles.weekLink}
            >
              Veckoplan →
            </Link>
          ) : null}
        </header>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      {quickAdd}

      {localItems.length === 0 && !adding && !addOpen && !hideWhenEmpty ? (
        <p className={styles.empty}>Inget planerat idag.</p>
      ) : null}

      {localItems.length === 0 && adding ? (
        <ul className={styles.list}>{pendingRow}</ul>
      ) : null}

      {localItems.length > 0 ? (
        <DndContext
          id="day-activities-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemKeys} strategy={verticalListSortingStrategy}>
            <ul className={styles.list}>
              {pendingRow}
              {localItems.map((item) => (
                <PlanSortableRow key={item.itemKey} id={item.itemKey}>
                  {(sortable) => (
                    <DayActivityRow
                      item={item}
                      date={planDate}
                      weekStart={weekStart}
                      categories={categories}
                      codingProjects={codingProjects}
                      games={games}
                      sports={sports}
                      savedRestaurants={savedRestaurants}
                      mealBoxStock={mealBoxStock}
                      canReschedule={canReschedule}
                      isOverdue={isOverdue}
                      rescheduleDays={rescheduleDays}
                      expanded={expandedKey === item.itemKey}
                      busy={pendingKey === item.itemKey}
                      pending={pendingKey === item.itemKey}
                      onToggleExpand={() =>
                        setExpandedKey(
                          expandedKey === item.itemKey ? null : item.itemKey,
                        )
                      }
                      onError={setError}
                      onPendingId={(id) =>
                        setPendingKey(id ? item.itemKey : null)
                      }
                      onRefresh={() => router.refresh()}
                      onDone={() => {
                        setExpandedKey(null);
                        router.refresh();
                      }}
                      planningMode={planningMode}
                      {...sortable}
                    />
                  )}
                </PlanSortableRow>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}

      {extraBath}
    </Card>
    </>
  );
}
