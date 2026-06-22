import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import type { WeeklyTaskForWeek } from "@/lib/tasks";
import type { WeightDayContext } from "@/lib/weight";

export type DayActivityKind =
  | "task"
  | "gym"
  | "cardio"
  | "sport"
  | "bathing"
  | "weight";

export type DayActivityItem =
  | {
      kind: "task";
      id: string;
      daySortOrder: number;
      doneAt: string | null;
      task: WeeklyTaskForWeek;
    }
  | {
      kind: "gym";
      id: string;
      daySortOrder: number;
      doneAt: string | null;
      session: GymSessionForWeek;
    }
  | {
      kind: "cardio";
      id: string;
      daySortOrder: number;
      doneAt: string | null;
      session: CardioSessionForWeek;
    }
  | {
      kind: "sport";
      id: string;
      daySortOrder: number;
      doneAt: string | null;
      session: SportSessionForWeek;
    }
  | {
      kind: "bathing";
      id: string;
      daySortOrder: number;
      doneAt: string | null;
      session: BathingSessionForWeek;
    }
  | {
      kind: "weight";
      id: string;
      daySortOrder: number;
      doneAt: string | null;
      weight: WeightDayContext;
    };

export interface DayActivitiesInput {
  tasks: WeeklyTaskForWeek[];
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  weight: WeightDayContext;
}

/** Merge weekly tasks + training for one day, sorted like the week plan. */
export function buildDayActivities(input: DayActivitiesInput): DayActivityItem[] {
  const items: DayActivityItem[] = [];

  for (const task of input.tasks) {
    items.push({
      kind: "task",
      id: task.id,
      daySortOrder: task.placement?.daySortOrder ?? task.sortOrder,
      doneAt: task.placement?.doneAt ?? null,
      task,
    });
  }

  for (const session of input.gymSessions) {
    items.push({
      kind: "gym",
      id: session.id,
      daySortOrder: session.placement.daySortOrder,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  for (const session of input.cardioSessions) {
    items.push({
      kind: "cardio",
      id: session.id,
      daySortOrder: session.placement.daySortOrder,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  for (const session of input.sportSessions) {
    items.push({
      kind: "sport",
      id: session.id,
      daySortOrder: session.placement.daySortOrder,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  for (const session of input.bathingSessions) {
    items.push({
      kind: "bathing",
      id: session.placement.id,
      daySortOrder: session.placement.daySortOrder,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  if (input.weight.scheduled) {
    items.push({
      kind: "weight",
      id: "weight",
      daySortOrder: input.weight.daySortOrder,
      doneAt: input.weight.log?.loggedAt ?? null,
      weight: input.weight,
    });
  }

  return sortDayActivities(items);
}

/** Week-plan order while pending; completed sink to bottom in check-off order. */
export function sortDayActivities(items: DayActivityItem[]): DayActivityItem[] {
  return [...items].sort((a, b) => {
    const aDone = Boolean(a.doneAt);
    const bDone = Boolean(b.doneAt);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (!aDone) return a.daySortOrder - b.daySortOrder;
    return (a.doneAt ?? "").localeCompare(b.doneAt ?? "");
  });
}

export function dayActivityKey(item: DayActivityItem): string {
  return `${item.kind}:${item.id}`;
}
