"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { WeeklyTaskQuickAdd } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import { buildDayPlanItems } from "@/lib/day-plan";
import { isoWeekdayFromLocalISO } from "@/lib/date";
import type { DailyHabit, DailySnacks, MealBoxStockItem, MealEntry, MealKey, MealRestaurant } from "@/lib/habits";
import type { DailyActivityLog, DailyTrackerGoals } from "@/lib/habits.server";
import type { IntakeEntry, IntakeKind } from "@/lib/intake";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import type { MonthlyTaskForMonth, TaskCategory, Weekday, WeeklyTaskForWeek } from "@/lib/tasks";
import type { WeightDayContext } from "@/lib/weight";
import type { DailyMediaContext } from "@/lib/media";
import type { DailyLiveEventsContext } from "@/lib/live-events";
import type { WorkDailyLog } from "@/lib/work";
import { reorderDayPlanAction } from "@/app/(app)/day-plan-actions";
import { DayActivityRow } from "./DayActivityRow";
import { PlanSortableRow } from "./PlanSortableRow";
import styles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

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
  activityLog: DailyActivityLog;
  goals: DailyTrackerGoals;
  media?: DailyMediaContext;
  liveEvents?: DailyLiveEventsContext;
  savedOrder: Map<string, number>;
  categories: TaskCategory[];
  date?: string;
  today?: string;
  title?: string;
  hideWhenEmpty?: boolean;
  showWeekLink?: boolean;
  enableQuickAdd?: boolean;
  bathingWeekday?: Weekday | null;
  enableExtraBath?: boolean;
  /** Future day in the current week — reorder only, no logging. */
  planningMode?: boolean;
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
  activityLog,
  goals,
  media,
  liveEvents,
  savedOrder,
  categories,
  date,
  today,
  title = "Dagens plan",
  hideWhenEmpty = false,
  showWeekLink = true,
  enableQuickAdd = false,
  bathingWeekday = null,
  enableExtraBath = false,
  planningMode = false,
}: Props) {
  const router = useRouter();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        activityLog,
        goals,
        media,
        liveEvents,
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
      activityLog,
      goals,
      media,
      liveEvents,
      savedOrder,
    ],
  );

  const [localItems, setLocalItems] = useState(builtItems);

  useEffect(() => {
    setLocalItems(builtItems);
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

  const quickAddWeekday =
    enableQuickAdd && date != null
      ? (isoWeekdayFromLocalISO(date) as Weekday)
      : null;

  const showExtraBath = enableExtraBath && bathingWeekday != null;

  const quickAdd =
    quickAddWeekday != null ? (
      <WeeklyTaskQuickAdd
        weekStart={weekStart}
        weekday={quickAddWeekday}
        categories={categories}
        onAdded={() => router.refresh()}
      />
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
    setLocalItems(next);
    setError(null);

    startTransition(async () => {
      const res = await reorderDayPlanAction({
        localDate: planDate,
        orderedKeys: next.map((i) => i.itemKey),
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara ordning.");
        setLocalItems(builtItems);
        return;
      }
      router.refresh();
    });
  };

  if (localItems.length === 0) {
    if (hideWhenEmpty) {
      if (!quickAdd && !extraBath) return null;
      return (
        <Card className={styles.card}>
          {quickAdd}
          {extraBath}
        </Card>
      );
    }

    return (
      <Card className={styles.card}>
        <p className={styles.empty}>Inget planerat idag.</p>
        {quickAdd}
        {extraBath}
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
        </div>
        <p className={styles.planHint}>
          {planningMode
            ? "Dra ⠿ för att planera ordningen inför dagen"
            : "Dra ⠿ för att ändra ordning idag"}
        </p>
        {showWeekLink || planningMode ? (
          <Link
            href={`/week?start=${weekStart}&view=plan`}
            className={styles.weekLink}
          >
            Veckoplan →
          </Link>
        ) : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemKeys} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {localItems.map((item) => (
              <PlanSortableRow key={item.itemKey} id={item.itemKey}>
                {(sortable) => (
                  <DayActivityRow
                    item={item}
                    date={planDate}
                    weekStart={weekStart}
                    categories={categories}
                    savedRestaurants={savedRestaurants}
                    mealBoxStock={mealBoxStock}
                    canReschedule={canReschedule}
                    isOverdue={isOverdue}
                    rescheduleDays={rescheduleDays}
                    expanded={expandedKey === item.itemKey}
                    busy={pendingKey === item.itemKey}
                    pending={pending}
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

      {quickAdd}
      {extraBath}
    </Card>
  );
}
