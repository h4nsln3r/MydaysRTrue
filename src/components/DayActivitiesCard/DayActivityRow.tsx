"use client";

import type { DayActivityItem } from "@/lib/day-activities";
import { BathingSessionRow } from "@/components/BathingDayCard/BathingDayCard";
import { CardioSessionRow } from "@/components/CardioDayCard/CardioDayCard";
import { GymSessionRow } from "@/components/GymDayCard/GymDayCard";
import { SportSessionRow } from "@/components/SportDayCard/SportDayCard";
import { WeeklyTaskRow } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import type { TaskCategory } from "@/lib/tasks";
import type { RescheduleDay } from "./types";
import { WeightActivityRow } from "./WeightActivityRow";

interface Props {
  item: DayActivityItem;
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
}: Props) {
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
        />
      );
    default:
      return null;
  }
}
