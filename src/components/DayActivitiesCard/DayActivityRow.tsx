"use client";

import type { DayPlanItem } from "@/lib/day-plan";
import { DAY_PLAN_HABIT_KINDS } from "@/lib/day-plan";
import { BathingSessionRow } from "@/components/BathingDayCard/BathingDayCard";
import { CardioSessionRow } from "@/components/CardioDayCard/CardioDayCard";
import { GymSessionRow } from "@/components/GymDayCard/GymDayCard";
import { SportSessionRow } from "@/components/SportDayCard/SportDayCard";
import { WeeklyTaskRow } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import { MonthlyTaskDayRow } from "@/components/MonthlyTasksDayCard/MonthlyTaskDayRow";
import type { MealBoxStockItem, MealRestaurant } from "@/lib/habits";
import type { TaskCategory } from "@/lib/tasks";
import type { RescheduleDay } from "@/lib/use-day-reschedule";
import { WeightActivityRow } from "./WeightActivityRow";
import { DayPlanDailyRow } from "./DayPlanDailyRow";
import { MediaPlanRow } from "./MediaPlanRow";
import { LiveEventPlanRow } from "./LiveEventPlanRow";
import type { PlanSortableProps } from "./usePlanSortable";

const DAILY_KINDS = new Set<DayPlanItem["kind"]>([
  "meal",
  "snack",
  "intake",
  "habit",
  "work_start",
  "work_end",
  "steps",
  "activity_hours",
  "media",
]);

interface Props extends PlanSortableProps {
  item: DayPlanItem;
  date: string;
  weekStart: string;
  categories: TaskCategory[];
  savedRestaurants?: MealRestaurant[];
  mealBoxStock?: MealBoxStockItem[];
  canReschedule: boolean;
  isOverdue: boolean;
  rescheduleDays: RescheduleDay[];
  expanded: boolean;
  busy: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onError: (msg: string | null) => void;
  onPendingId: (id: string | null) => void;
  onRefresh: () => void;
  onDone: () => void;
  planningMode?: boolean;
}

function sessionRowProps(
  props: Props,
): Pick<
  Props,
  | "expanded"
  | "busy"
  | "pending"
  | "onToggleExpand"
  | "onError"
  | "onPendingId"
  | "onDone"
  | "planningMode"
  | "dragHandle"
  | "sortableRef"
  | "sortableStyle"
> {
  const { planningMode } = props;
  return {
    expanded: planningMode ? false : props.expanded,
    busy: props.busy,
    pending: props.pending,
    onToggleExpand: planningMode ? () => {} : props.onToggleExpand,
    onError: props.onError,
    onPendingId: props.onPendingId,
    onDone: props.onDone,
    planningMode,
    dragHandle: props.dragHandle,
    sortableRef: props.sortableRef,
    sortableStyle: props.sortableStyle,
  };
}

export function DayActivityRow(props: Props) {
  const {
    item,
    date,
    weekStart,
    categories,
    canReschedule,
    isOverdue,
    rescheduleDays,
    onRefresh,
    planningMode = false,
    savedRestaurants = [],
    mealBoxStock = [],
  } = props;

  if (item.kind === "live_event") {
    return (
      <LiveEventPlanRow
        item={item}
        date={date}
        expanded={planningMode ? false : props.expanded}
        busy={props.busy}
        pending={props.pending}
        onToggleExpand={planningMode ? () => {} : props.onToggleExpand}
        onError={props.onError}
        onPendingKey={(active) =>
          props.onPendingId(active ? item.itemKey : null)
        }
        onDone={props.onDone}
        planningMode={planningMode}
        dragHandle={props.dragHandle}
        sortableRef={props.sortableRef}
        sortableStyle={props.sortableStyle}
      />
    );
  }

  if (item.kind === "media") {
    return (
      <MediaPlanRow
        item={item}
        date={date}
        expanded={planningMode ? false : props.expanded}
        busy={props.busy}
        pending={props.pending}
        onToggleExpand={planningMode ? () => {} : props.onToggleExpand}
        onError={props.onError}
        onPendingKey={(active) =>
          props.onPendingId(active ? item.itemKey : null)
        }
        onDone={props.onDone}
        planningMode={planningMode}
        dragHandle={props.dragHandle}
        sortableRef={props.sortableRef}
        sortableStyle={props.sortableStyle}
      />
    );
  }

  if (DAILY_KINDS.has(item.kind)) {
    return (
      <DayPlanDailyRow
        item={item}
        date={date}
        savedRestaurants={savedRestaurants}
        mealBoxStock={mealBoxStock}
        expanded={planningMode ? false : props.expanded}
        busy={props.busy}
        pending={props.pending}
        onToggleExpand={planningMode ? () => {} : props.onToggleExpand}
        onError={props.onError}
        onPendingKey={(active) =>
          props.onPendingId(active ? item.itemKey : null)
        }
        onDone={props.onDone}
        planningMode={planningMode}
        dragHandle={props.dragHandle}
        sortableRef={props.sortableRef}
        sortableStyle={props.sortableStyle}
      />
    );
  }

  const shared = sessionRowProps(props);

  switch (item.kind) {
    case "task":
      return (
        <WeeklyTaskRow
          task={item.task}
          weekStart={weekStart}
          categories={categories}
          canReschedule={canReschedule}
          isOverdue={isOverdue}
          rescheduleDays={rescheduleDays}
          expanded={planningMode ? false : props.expanded}
          busy={props.busy}
          pending={props.pending}
          onToggleExpand={planningMode ? () => {} : props.onToggleExpand}
          onError={props.onError}
          onPendingId={props.onPendingId}
          onRefresh={onRefresh}
          onDone={props.onDone}
          planningMode={planningMode}
          dragHandle={props.dragHandle}
          sortableRef={props.sortableRef}
          sortableStyle={props.sortableStyle}
        />
      );
    case "monthly_task":
      return (
        <MonthlyTaskDayRow
          task={item.task}
          monthStart={item.monthStart}
          categories={categories}
          expanded={planningMode ? false : props.expanded}
          busy={props.busy}
          pending={props.pending}
          onToggleExpand={planningMode ? () => {} : props.onToggleExpand}
          onError={props.onError}
          onPendingId={props.onPendingId}
          onDone={props.onDone}
          planningMode={planningMode}
          dragHandle={props.dragHandle}
          sortableRef={props.sortableRef}
          sortableStyle={props.sortableStyle}
        />
      );
    case "gym":
      return (
        <GymSessionRow
          session={item.session}
          weekStart={weekStart}
          canReschedule={canReschedule}
          isOverdue={isOverdue}
          rescheduleDays={rescheduleDays}
          {...shared}
        />
      );
    case "cardio":
      return (
        <CardioSessionRow
          session={item.session}
          weekStart={weekStart}
          canReschedule={canReschedule}
          isOverdue={isOverdue}
          rescheduleDays={rescheduleDays}
          {...shared}
        />
      );
    case "sport":
      return (
        <SportSessionRow
          session={item.session}
          weekStart={weekStart}
          canReschedule={canReschedule}
          isOverdue={isOverdue}
          rescheduleDays={rescheduleDays}
          {...shared}
        />
      );
    case "bathing":
      return (
        <BathingSessionRow
          session={item.session}
          weekStart={weekStart}
          canReschedule={canReschedule}
          isOverdue={isOverdue}
          rescheduleDays={rescheduleDays}
          {...shared}
        />
      );
    case "weight":
      return (
        <WeightActivityRow
          context={item.weight}
          canReschedule={canReschedule}
          isOverdue={isOverdue}
          rescheduleDays={rescheduleDays}
          {...shared}
        />
      );
    default:
      return null;
  }
}

export { DAY_PLAN_HABIT_KINDS };
