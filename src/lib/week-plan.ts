// Unified weekly planning — all recurring activities in one board.
// Server aggregation lives in `./week-plan.server`.

import type { CardioSessionForWeek } from "@/lib/cardio";
import type { GymSessionForWeek, GymWarmup } from "@/lib/gym";
import type { TaskCategory, Weekday, WeeklyTaskForWeek } from "@/lib/tasks";
import type { WeightLog, WeightWeekPlan } from "@/lib/weight";
import { WEIGHT_ITEM_ID } from "@/lib/weight";

export type WeekPlanItemKind = "task" | "gym" | "cardio" | "weight";

export interface WeekPlanItemBase {
  dragId: string;
  kind: WeekPlanItemKind;
  label: string;
  subtitle: string | null;
  icon: string;
  accent: string;
  defaultWeekday: Weekday | null;
  /** null = sits in the left backlog for this week. */
  weekday: Weekday | null;
  done: boolean;
  sortOrder: number;
}

export interface WeekPlanTaskItem extends WeekPlanItemBase {
  kind: "task";
  taskId: string;
  categoryId: string | null;
}

export interface WeekPlanGymItem extends WeekPlanItemBase {
  kind: "gym";
  templateId: string;
  warmup: GymWarmup | null;
  session: GymSessionForWeek;
}

export interface WeekPlanCardioItem extends WeekPlanItemBase {
  kind: "cardio";
  templateId: string;
  session: CardioSessionForWeek;
}

export interface WeekPlanWeightItem extends WeekPlanItemBase {
  kind: "weight";
  enabled: boolean;
  log: WeightLog | null;
  plan: WeightWeekPlan;
}

export type WeekPlanItem =
  | WeekPlanTaskItem
  | WeekPlanGymItem
  | WeekPlanCardioItem
  | WeekPlanWeightItem;

export interface UnifiedWeekPlan {
  weekStart: string;
  items: WeekPlanItem[];
  categories: TaskCategory[];
}

export const WEEK_PLAN_BACKLOG_DROP_ID = "week-plan-backlog";

/** Drop zone for unplaced weekly tasks below the add button. */
export const WEEK_PLAN_TASK_STAGING_DROP_ID = "week-plan-task-staging";

export function weekPlanDayDropId(weekday: Weekday): string {
  return `week-plan-day-${weekday}`;
}

export function weekdayFromWeekPlanDropId(id: string): Weekday | null {
  const m = /^week-plan-day-(\d)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 7 ? (n as Weekday) : null;
}

export function weekPlanDragId(
  kind: WeekPlanItemKind,
  entityId: string,
): string {
  return `${kind}:${entityId}`;
}

export function parseWeekPlanDragId(
  dragId: string,
): { kind: WeekPlanItemKind; entityId: string } | null {
  const m = /^(task|gym|cardio|weight):(.+)$/.exec(dragId);
  if (!m) return null;
  return {
    kind: m[1] as WeekPlanItemKind,
    entityId: m[2],
  };
}

export const WEIGHT_DRAG_ID = weekPlanDragId("weight", WEIGHT_ITEM_ID);
