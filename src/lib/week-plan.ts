// Unified weekly planning — all recurring activities in one board.
// Server aggregation lives in `./week-plan.server`.

import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { SportSessionForWeek } from "@/lib/sport";
import type { GymSessionForWeek, GymWarmup } from "@/lib/gym";
import type {
  TaskCategory,
  Weekday,
  WeeklyPlacement,
  WeeklyTaskChecklistItem,
  WeeklyTaskCompletionKind,
  MonthlyTaskCompletionKind,
} from "@/lib/tasks";
import type { WeightLog, WeightWeekPlan } from "@/lib/weight";
import { WEIGHT_ITEM_ID } from "@/lib/weight";

export type WeekPlanItemKind =
  | "task"
  | "gym"
  | "cardio"
  | "sport"
  | "bathing"
  | "weight"
  | "monthly_bill";

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
  taskKey: string | null;
  categoryId: string | null;
  completionKind: WeeklyTaskCompletionKind;
  placement: WeeklyPlacement | null;
  checklist: WeeklyTaskChecklistItem[];
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

export interface WeekPlanSportItem extends WeekPlanItemBase {
  kind: "sport";
  templateId: string;
  session: SportSessionForWeek;
}

export interface WeekPlanBathingItem extends WeekPlanItemBase {
  kind: "bathing";
  bathingRole: BathingDragRole;
  templateId: string;
  placementId: string | null;
  session: BathingSessionForWeek;
}

export interface WeekPlanWeightItem extends WeekPlanItemBase {
  kind: "weight";
  enabled: boolean;
  log: WeightLog | null;
  plan: WeightWeekPlan;
}

export interface WeekPlanMonthlyBillItem extends WeekPlanItemBase {
  kind: "monthly_bill";
  taskId: string;
  taskKey: string | null;
  categoryId: string | null;
  monthStart: string;
  scheduledDayOfMonth: number | null;
  completionKind: MonthlyTaskCompletionKind;
  completion: import("@/lib/tasks").MonthlyCompletion | null;
}

export type WeekPlanItem =
  | WeekPlanTaskItem
  | WeekPlanGymItem
  | WeekPlanCardioItem
  | WeekPlanSportItem
  | WeekPlanBathingItem
  | WeekPlanWeightItem
  | WeekPlanMonthlyBillItem;

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

export type BathingDragRole = "source" | "placement";

export interface ParsedWeekPlanDragId {
  kind: WeekPlanItemKind;
  entityId: string;
  bathingRole?: BathingDragRole;
  monthStart?: string;
}

export function weekPlanDragId(
  kind: WeekPlanItemKind,
  entityId: string,
): string {
  return `${kind}:${entityId}`;
}

/** Draggable bathing template in the left backlog (one per template per week). */
export function weekPlanBathingSourceDragId(templateId: string): string {
  return `bathing-source:${templateId}`;
}

/** A bathing instance placed on a weekday. */
export function weekPlanBathingPlacementDragId(placementId: string): string {
  return `bathing:${placementId}`;
}

export function weekPlanMonthlyBillDragId(taskId: string, monthStart: string): string {
  return `monthly_bill:${taskId}:${monthStart}`;
}

export function parseWeekPlanDragId(dragId: string): ParsedWeekPlanDragId | null {
  const source = /^bathing-source:(.+)$/.exec(dragId);
  if (source) {
    return { kind: "bathing", entityId: source[1], bathingRole: "source" };
  }

  const bathing = /^bathing:(.+)$/.exec(dragId);
  if (bathing) {
    return { kind: "bathing", entityId: bathing[1], bathingRole: "placement" };
  }

  const monthlyBill = /^monthly_bill:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(dragId);
  if (monthlyBill) {
    return {
      kind: "monthly_bill",
      entityId: monthlyBill[1],
      monthStart: monthlyBill[2],
    };
  }

  const m = /^(task|gym|cardio|sport|weight):(.+)$/.exec(dragId);
  if (!m) return null;
  return {
    kind: m[1] as WeekPlanItemKind,
    entityId: m[2],
  };
}

export const WEIGHT_DRAG_ID = weekPlanDragId("weight", WEIGHT_ITEM_ID);
