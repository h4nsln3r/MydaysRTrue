"use client";

import type { DayPlanItem } from "@/lib/day-plan";
import { DAY_PLAN_HABIT_KINDS } from "@/lib/day-plan";
import { BathingSessionRow } from "@/components/BathingDayCard/BathingDayCard";
import { CardioSessionRow } from "@/components/CardioDayCard/CardioDayCard";
import { GymSessionRow } from "@/components/GymDayCard/GymDayCard";
import { SportSessionRow } from "@/components/SportDayCard/SportDayCard";
import { WeeklyTaskRow } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import type { TaskCategory } from "@/lib/tasks";
import type { RescheduleDay } from "./types";
import { WeightActivityRow } from "./WeightActivityRow";
import { DayPlanDailyRow } from "./DayPlanDailyRow";
import type { PlanSortableProps } from "./usePlanSortable";

const DAILY_KINDS = new Set<DayPlanItem["kind"]>([
  "meal",
  "snack",
  "intake",
  "work_start",
  "work_end",
  "steps",
  "activity_hours",
]);

interface Props extends PlanSortableProps {
  item: DayPlanItem;
  date: string;
  weekStart: string;
  categories: TaskCategory[];
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
}

export function DayActivityRow({
  item,
  date,
  weekStart,
  categories,
  canReschedule,
  isOverdue,
  rescheduleDays,
  expanded,
  busy,
  pending,
  onToggleExpand,
  onError,
  onPendingId,
  onRefresh,
  onDone,
  dragHandle,
  sortableRef,
  sortableStyle,
}: Props) {
  if (DAILY_KINDS.has(item.kind)) {
    return (
      <DayPlanDailyRow
        item={item}
        date={date}
        expanded={expanded}
        busy={busy}
        pending={pending}
        onToggleExpand={onToggleExpand}
        onError={onError}
        onPendingKey={(active) => onPendingId(active ? item.itemKey : null)}
        onDone={onDone}
        dragHandle={dragHandle}
        sortableRef={sortableRef}
        sortableStyle={sortableStyle}
      />
    );
  }

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
          expanded={expanded}
          busy={busy}
          pending={pending}
          onToggleExpand={onToggleExpand}
          onError={onError}
          onPendingId={onPendingId}
          onRefresh={onRefresh}
          onDone={onDone}
          dragHandle={dragHandle}
          sortableRef={sortableRef}
          sortableStyle={sortableStyle}
        />
      );
    case "gym":
      return (
        <GymSessionRow
          session={item.session}
          weekStart={weekStart}
          expanded={expanded}
          busy={busy}
          pending={pending}
          onToggleExpand={onToggleExpand}
          onError={onError}
          onPendingId={onPendingId}
          onDone={onDone}
          dragHandle={dragHandle}
          sortableRef={sortableRef}
          sortableStyle={sortableStyle}
        />
      );
    case "cardio":
      return (
        <CardioSessionRow
          session={item.session}
          weekStart={weekStart}
          expanded={expanded}
          busy={busy}
          pending={pending}
          onToggleExpand={onToggleExpand}
          onError={onError}
          onPendingId={onPendingId}
          onDone={onDone}
          dragHandle={dragHandle}
          sortableRef={sortableRef}
          sortableStyle={sortableStyle}
        />
      );
    case "sport":
      return (
        <SportSessionRow
          session={item.session}
          weekStart={weekStart}
          expanded={expanded}
          busy={busy}
          pending={pending}
          onToggleExpand={onToggleExpand}
          onError={onError}
          onPendingId={onPendingId}
          onDone={onDone}
          dragHandle={dragHandle}
          sortableRef={sortableRef}
          sortableStyle={sortableStyle}
        />
      );
    case "bathing":
      return (
        <BathingSessionRow
          session={item.session}
          weekStart={weekStart}
          expanded={expanded}
          busy={busy}
          pending={pending}
          onToggleExpand={onToggleExpand}
          onError={onError}
          onPendingId={onPendingId}
          onDone={onDone}
          dragHandle={dragHandle}
          sortableRef={sortableRef}
          sortableStyle={sortableStyle}
        />
      );
    case "weight":
      return (
        <WeightActivityRow
          context={item.weight}
          expanded={expanded}
          busy={busy}
          pending={pending}
          onToggleExpand={onToggleExpand}
          onError={onError}
          onPendingId={onPendingId}
          onDone={onDone}
          dragHandle={dragHandle}
          sortableRef={sortableRef}
          sortableStyle={sortableStyle}
        />
      );
    default:
      return null;
  }
}

export { DAY_PLAN_HABIT_KINDS };
