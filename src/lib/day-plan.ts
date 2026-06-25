import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import {
  MEAL_ICON,
  MEAL_LABEL,
  SNACK_ICON,
  SNACK_LABEL,
  type DailyHabit,
  type DailySnacks,
  type HabitKind,
  type MealEntry,
  type MealKey,
  type SnackSlot,
} from "@/lib/habits";
import type { DailyActivityLog, DailyTrackerGoals } from "@/lib/habits.server";
import {
  INTAKE_ICON,
  INTAKE_LABEL,
  applicableIntakeKinds,
  type IntakeEntry,
  type IntakeKind,
} from "@/lib/intake";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import type { MonthlyTaskForMonth, WeeklyTaskForWeek } from "@/lib/tasks";
import { isWorkday, type WorkDailyLog } from "@/lib/work";
import type { WeightDayContext } from "@/lib/weight";

export type DayPlanKind =
  | "task"
  | "monthly_task"
  | "gym"
  | "cardio"
  | "sport"
  | "bathing"
  | "weight"
  | "meal"
  | "snack"
  | "intake"
  | "work_start"
  | "work_end"
  | "steps"
  | "activity_hours";

/** Kinds shown in Dagens plan (excludes water, mood, media, etc. for now). */
export const DAY_PLAN_HABIT_KINDS = new Set<HabitKind>([
  "meal",
  "snack",
  "intake",
  "steps",
  "activity_hours",
]);

const MEAL_SUB_ORDER: Record<MealKey, number> = {
  breakfast: 0,
  lunch: 2,
  dinner: 4,
};

const SNACK_SUB_ORDER: Record<SnackSlot, number> = {
  1: 1,
  2: 5,
};

const INTAKE_SUB_ORDER: Record<IntakeKind, number> = {
  fruit: 0,
  creatine: 1,
  vitamin: 2,
  shake: 3,
};

/** Steps & activity default to the end of the day. */
const END_OF_DAY_BASE = 900_000;

export type DayPlanItem =
  | {
      kind: "task";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      task: WeeklyTaskForWeek;
    }
  | {
      kind: "monthly_task";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      monthStart: string;
      task: MonthlyTaskForMonth;
    }
  | {
      kind: "gym";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      session: GymSessionForWeek;
    }
  | {
      kind: "cardio";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      session: CardioSessionForWeek;
    }
  | {
      kind: "sport";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      session: SportSessionForWeek;
    }
  | {
      kind: "bathing";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      session: BathingSessionForWeek;
    }
  | {
      kind: "weight";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      weight: WeightDayContext;
    }
  | {
      kind: "meal";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      meal: MealKey;
      entry: MealEntry | null;
    }
  | {
      kind: "snack";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      slot: SnackSlot;
      entry: DailySnacks[SnackSlot];
    }
  | {
      kind: "intake";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      intakeKind: IntakeKind;
      entry: IntakeEntry | null;
    }
  | {
      kind: "work_start";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      work: WorkDailyLog;
    }
  | {
      kind: "work_end";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      work: WorkDailyLog;
    }
  | {
      kind: "steps";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      steps: number | null;
      stepsGoal: number;
    }
  | {
      kind: "activity_hours";
      id: string;
      itemKey: string;
      sortOrder: number;
      doneAt: string | null;
      activityHours: number | null;
      activityHoursGoal: number;
    };

export interface DayPlanInput {
  date: string;
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
  intake: Record<IntakeKind, IntakeEntry | null>;
  work: WorkDailyLog;
  activityLog: DailyActivityLog;
  goals: DailyTrackerGoals;
  savedOrder?: Map<string, number>;
}

interface HabitSortSlots {
  meal?: number;
  snack?: number;
  intake?: number;
  steps?: number;
  activity_hours?: number;
}

function habitSortSlots(habits: DailyHabit[]): HabitSortSlots {
  const slots: HabitSortSlots = {};
  for (const h of habits) {
    if (h.kind in slots || !DAY_PLAN_HABIT_KINDS.has(h.kind)) continue;
    slots[h.kind as keyof HabitSortSlots] = h.sortOrder;
  }
  return slots;
}

function weekDefaultRank(daySortOrder: number): number {
  return daySortOrder * 1000 + 500;
}

function mealDefaultRank(slots: HabitSortSlots, meal: MealKey): number {
  const base = (slots.meal ?? 50) * 1000;
  return base + MEAL_SUB_ORDER[meal];
}

function snackDefaultRank(slots: HabitSortSlots, slot: SnackSlot): number {
  const base = (slots.snack ?? slots.meal ?? 50) * 1000;
  return base + SNACK_SUB_ORDER[slot];
}

function intakeDefaultRank(slots: HabitSortSlots, kind: IntakeKind): number {
  const base = (slots.intake ?? 60) * 1000;
  return base + INTAKE_SUB_ORDER[kind];
}

function workStartDefaultRank(slots: HabitSortSlots): number {
  const base = (slots.meal ?? 10) * 1000;
  return base + 3;
}

function workEndDefaultRank(slots: HabitSortSlots): number {
  const base = (slots.meal ?? 10) * 1000;
  return base + 25;
}

function stepsDefaultRank(slots: HabitSortSlots): number {
  return END_OF_DAY_BASE + (slots.steps ?? 0) * 10;
}

function activityDefaultRank(slots: HabitSortSlots): number {
  return END_OF_DAY_BASE + (slots.activity_hours ?? 1) * 10 + 1;
}

export function dayPlanItemKey(item: Pick<DayPlanItem, "kind" | "id">): string {
  return `${item.kind}:${item.id}`;
}

function assignDefaultSortOrders(items: DayPlanItem[], slots: HabitSortSlots): void {
  for (const item of items) {
    switch (item.kind) {
      case "task":
        item.sortOrder = weekDefaultRank(
          item.task.placement?.daySortOrder ?? item.task.sortOrder,
        );
        break;
      case "monthly_task":
        item.sortOrder = weekDefaultRank(
          item.task.completion?.daySortOrder ?? item.task.sortOrder,
        );
        break;
      case "gym":
        item.sortOrder = weekDefaultRank(item.session.placement.daySortOrder);
        break;
      case "cardio":
        item.sortOrder = weekDefaultRank(item.session.placement.daySortOrder);
        break;
      case "sport":
        item.sortOrder = weekDefaultRank(item.session.placement.daySortOrder);
        break;
      case "bathing":
        item.sortOrder = weekDefaultRank(item.session.placement.daySortOrder);
        break;
      case "weight":
        item.sortOrder = weekDefaultRank(item.weight.daySortOrder);
        break;
      case "meal":
        item.sortOrder = mealDefaultRank(slots, item.meal);
        break;
      case "snack":
        item.sortOrder = snackDefaultRank(slots, item.slot);
        break;
      case "intake":
        item.sortOrder = intakeDefaultRank(slots, item.intakeKind);
        break;
      case "work_start":
        item.sortOrder = workStartDefaultRank(slots);
        break;
      case "work_end":
        item.sortOrder = workEndDefaultRank(slots);
        break;
      case "steps":
        item.sortOrder = stepsDefaultRank(slots);
        break;
      case "activity_hours":
        item.sortOrder = activityDefaultRank(slots);
        break;
    }
  }
}

function applySavedOrder(items: DayPlanItem[], savedOrder: Map<string, number>): void {
  const maxSaved = savedOrder.size
    ? Math.max(...savedOrder.values())
    : -1;
  let fallback = maxSaved + 1;

  for (const item of items) {
    const saved = savedOrder.get(item.itemKey);
    item.sortOrder = saved ?? fallback++;
  }
}

/** Build all Dagens plan rows for one day. */
export function buildDayPlanItems(input: DayPlanInput): DayPlanItem[] {
  const items: DayPlanItem[] = [];
  const enabledKinds = new Set(input.habits.map((h) => h.kind));
  const slots = habitSortSlots(input.habits);

  for (const task of input.tasks) {
    items.push({
      kind: "task",
      id: task.id,
      itemKey: `task:${task.id}`,
      sortOrder: 0,
      doneAt: task.placement?.doneAt ?? null,
      task,
    });
  }

  const monthStart = input.monthStart ?? `${input.date.slice(0, 7)}-01`;
  for (const task of input.monthlyTasks ?? []) {
    items.push({
      kind: "monthly_task",
      id: task.id,
      itemKey: `monthly_task:${task.id}`,
      sortOrder: 0,
      doneAt: task.completion?.doneAt ?? null,
      monthStart,
      task,
    });
  }

  for (const session of input.gymSessions) {
    items.push({
      kind: "gym",
      id: session.id,
      itemKey: `gym:${session.id}`,
      sortOrder: 0,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  for (const session of input.cardioSessions) {
    items.push({
      kind: "cardio",
      id: session.id,
      itemKey: `cardio:${session.id}`,
      sortOrder: 0,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  for (const session of input.sportSessions) {
    items.push({
      kind: "sport",
      id: session.id,
      itemKey: `sport:${session.id}`,
      sortOrder: 0,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  for (const session of input.bathingSessions) {
    items.push({
      kind: "bathing",
      id: session.placement.id,
      itemKey: `bathing:${session.placement.id}`,
      sortOrder: 0,
      doneAt: session.placement.doneAt,
      session,
    });
  }

  if (input.weight.scheduled) {
    items.push({
      kind: "weight",
      id: "weight",
      itemKey: "weight:weight",
      sortOrder: 0,
      doneAt: input.weight.log?.loggedAt ?? null,
      weight: input.weight,
    });
  }

  if (enabledKinds.has("meal")) {
    for (const meal of ["breakfast", "lunch", "dinner"] as MealKey[]) {
      const entry = input.meals[meal];
      items.push({
        kind: "meal",
        id: meal,
        itemKey: `meal:${meal}`,
        sortOrder: 0,
        doneAt: entry ? `${input.date}T12:00:00.000Z` : null,
        meal,
        entry,
      });
    }
  }

  if (enabledKinds.has("snack")) {
    for (const slot of [1, 2] as SnackSlot[]) {
      const entry = input.snacks[slot];
      items.push({
        kind: "snack",
        id: String(slot),
        itemKey: `snack:${slot}`,
        sortOrder: 0,
        doneAt: entry ? `${input.date}T12:00:00.000Z` : null,
        slot,
        entry,
      });
    }
  }

  if (enabledKinds.has("intake")) {
    for (const kind of applicableIntakeKinds(input.date)) {
      const entry = input.intake[kind];
      items.push({
        kind: "intake",
        id: kind,
        itemKey: `intake:${kind}`,
        sortOrder: 0,
        doneAt: entry ? `${input.date}T12:00:00.000Z` : null,
        intakeKind: kind,
        entry,
      });
    }
  }

  if (isWorkday(input.date)) {
    items.push({
      kind: "work_start",
      id: "start",
      itemKey: "work_start:start",
      sortOrder: 0,
      doneAt: input.work.startedAt,
      work: input.work,
    });
    items.push({
      kind: "work_end",
      id: "end",
      itemKey: "work_end:end",
      sortOrder: 0,
      doneAt: input.work.endedAt,
      work: input.work,
    });
  }

  if (enabledKinds.has("steps")) {
    items.push({
      kind: "steps",
      id: "steps",
      itemKey: "steps:steps",
      sortOrder: 0,
      doneAt:
        input.activityLog.steps != null ? `${input.date}T23:00:00.000Z` : null,
      steps: input.activityLog.steps,
      stepsGoal: input.goals.stepsGoal,
    });
  }

  if (enabledKinds.has("activity_hours")) {
    items.push({
      kind: "activity_hours",
      id: "activity_hours",
      itemKey: "activity_hours:activity_hours",
      sortOrder: 0,
      doneAt:
        input.activityLog.activityHours != null
          ? `${input.date}T23:30:00.000Z`
          : null,
      activityHours: input.activityLog.activityHours,
      activityHoursGoal: input.goals.activityHoursGoal,
    });
  }

  assignDefaultSortOrders(items, slots);

  if (input.savedOrder && input.savedOrder.size > 0) {
    applySavedOrder(items, input.savedOrder);
  } else {
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    items.forEach((item, i) => {
      item.sortOrder = i;
    });
  }

  return sortDayPlanItems(items);
}

/** Pending items keep plan order; completed sink to the bottom in check-off order. */
export function sortDayPlanItems(items: DayPlanItem[]): DayPlanItem[] {
  return [...items].sort((a, b) => {
    const aDone = Boolean(a.doneAt);
    const bDone = Boolean(b.doneAt);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (!aDone) return a.sortOrder - b.sortOrder;
    return (a.doneAt ?? "").localeCompare(b.doneAt ?? "");
  });
}

export function dayPlanItemLabel(item: DayPlanItem): string {
  switch (item.kind) {
    case "task":
      return item.task.title;
    case "monthly_task":
      return item.task.title;
    case "gym":
      return item.session.label;
    case "cardio":
      return item.session.label;
    case "sport":
      return item.session.label;
    case "bathing":
      return item.session.label;
    case "weight":
      return "Vikt";
    case "meal":
      return MEAL_LABEL[item.meal];
    case "snack":
      return SNACK_LABEL[item.slot];
    case "intake":
      return INTAKE_LABEL[item.intakeKind];
    case "work_start":
      return "Jobb start";
    case "work_end":
      return "Jobb slut";
    case "steps":
      return "Steg";
    case "activity_hours":
      return "Aktivitet";
  }
}

export function dayPlanItemIcon(item: DayPlanItem): string {
  switch (item.kind) {
    case "task":
      return item.task.icon;
    case "monthly_task":
      return item.task.icon;
    case "gym":
      return item.session.icon;
    case "cardio":
      return item.session.icon;
    case "sport":
      return item.session.icon;
    case "bathing":
      return item.session.icon;
    case "weight":
      return "⚖️";
    case "meal":
      return MEAL_ICON[item.meal];
    case "snack":
      return SNACK_ICON[item.slot];
    case "intake":
      return INTAKE_ICON[item.intakeKind];
    case "work_start":
    case "work_end":
      return "💼";
    case "steps":
      return "👟";
    case "activity_hours":
      return "⏱";
  }
}

export function dayPlanItemAccent(item: DayPlanItem): string {
  switch (item.kind) {
    case "task":
      return item.task.accent;
    case "monthly_task":
      return item.task.accent;
    case "gym":
      return item.session.accent;
    case "cardio":
      return item.session.accent;
    case "sport":
      return item.session.accent;
    case "bathing":
      return item.session.accent;
    case "weight":
      return "#c084fc";
    case "meal":
      return "#ff9a3c";
    case "snack":
      return "#ffcf3a";
    case "intake":
      return "#6ee7a3";
    case "work_start":
    case "work_end":
      return "#94a3b8";
    case "steps":
      return "#5fb6ff";
    case "activity_hours":
      return "#c084fc";
  }
}
