// Backward-compatible re-exports for week-plan activity merging.
export {
  buildDayPlanItems,
  sortDayPlanItems,
  type DayPlanItem,
  type DayPlanKind,
} from "@/lib/day-plan";

import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import type { WeeklyTaskForWeek } from "@/lib/tasks";
import type { WeightDayContext } from "@/lib/weight";
import { buildDayPlanItems, type DayPlanItem } from "@/lib/day-plan";

export type DayActivityKind =
  | "task"
  | "gym"
  | "cardio"
  | "sport"
  | "bathing"
  | "weight";

export type DayActivityItem = Extract<DayPlanItem, { kind: DayActivityKind }>;

export function dayActivityKey(item: Pick<DayActivityItem, "kind" | "id">): string {
  return `${item.kind}:${item.id}`;
}

export interface DayActivitiesInput {
  tasks: WeeklyTaskForWeek[];
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  weight: WeightDayContext;
}

/** @deprecated Use buildDayPlanItems with full DayPlanInput. */
export function buildDayActivities(input: DayActivitiesInput): DayActivityItem[] {
  return buildDayPlanItems({
    date: "",
    habits: [],
    meals: { breakfast: null, lunch: null, dinner: null },
    snacks: { 1: null, 2: null },
    intake: { fruit: null, creatine: null, vitamin: null, shake: null },
    work: {
      localDate: "",
      startedAt: null,
      startNote: null,
      endedAt: null,
      endNote: null,
    },
    activityLog: { localDate: "", steps: null, activityHours: null },
    goals: { waterGoalMl: 2500, stepsGoal: 8000, activityHoursGoal: 12 },
    ...input,
  }).filter((item): item is DayActivityItem =>
    item.kind === "task" ||
    item.kind === "gym" ||
    item.kind === "cardio" ||
    item.kind === "sport" ||
    item.kind === "bathing" ||
    item.kind === "weight",
  );
}

export function sortDayActivities(items: DayActivityItem[]): DayActivityItem[] {
  return [...items].sort((a, b) => {
    const aDone = Boolean(a.doneAt);
    const bDone = Boolean(b.doneAt);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (!aDone) return a.sortOrder - b.sortOrder;
    return (a.doneAt ?? "").localeCompare(b.doneAt ?? "");
  });
}
