import "server-only";
import { getBathingWeekSummary } from "@/lib/bathing.server";
import { getCardioWeekSummary } from "@/lib/cardio.server";
import { getGymWeekSummary } from "@/lib/gym.server";
import { formatWeeklyTaskDetail } from "@/lib/tasks";
import { getWeekSummary } from "@/lib/tasks.server";
import { getWeightWeekPlan } from "@/lib/weight.server";
import {
  weekPlanBathingPlacementDragId,
  weekPlanBathingSourceDragId,
  weekPlanDragId,
  type UnifiedWeekPlan,
  type WeekPlanItem,
} from "@/lib/week-plan";
import { WEIGHT_ITEM_ID } from "@/lib/weight";

const KIND_SORT: Record<WeekPlanItem["kind"], number> = {
  gym: 0,
  cardio: 1,
  bathing: 2,
  task: 3,
  weight: 4,
};

function sortItems(items: WeekPlanItem[]): WeekPlanItem[] {
  return [...items].sort((a, b) => {
    const kd = KIND_SORT[a.kind] - KIND_SORT[b.kind];
    if (kd !== 0) return kd;
    return a.sortOrder - b.sortOrder;
  });
}

/** All weekly activities merged for the unified plan board. */
export async function getUnifiedWeekPlan(
  userId: string,
  weekStart: string,
): Promise<UnifiedWeekPlan> {
  const [gymWeek, cardioWeek, bathingWeek, taskWeek, weightPlan] =
    await Promise.all([
      getGymWeekSummary(userId, weekStart),
      getCardioWeekSummary(userId, weekStart),
      getBathingWeekSummary(userId, weekStart),
      getWeekSummary(userId, weekStart),
      getWeightWeekPlan(userId, weekStart),
    ]);

  const items: WeekPlanItem[] = [];

  for (const s of gymWeek.sessions) {
    items.push({
      dragId: weekPlanDragId("gym", s.id),
      kind: "gym",
      templateId: s.id,
      label: s.label,
      subtitle: s.description,
      icon: s.icon,
      accent: s.accent,
      defaultWeekday: s.defaultWeekday,
      weekday: s.placement.weekday,
      done: Boolean(s.placement.doneAt),
      sortOrder: s.sortOrder,
      warmup: s.placement.warmup,
      session: s,
    });
  }

  for (const s of cardioWeek.sessions) {
    items.push({
      dragId: weekPlanDragId("cardio", s.id),
      kind: "cardio",
      templateId: s.id,
      label: s.label,
      subtitle: s.description,
      icon: s.icon,
      accent: s.accent,
      defaultWeekday: s.defaultWeekday,
      weekday: s.placement.weekday,
      done: Boolean(s.placement.doneAt),
      sortOrder: s.sortOrder,
      session: s,
    });
  }

  for (const t of bathingWeek.templates) {
    items.push({
      dragId: weekPlanBathingSourceDragId(t.id),
      kind: "bathing",
      bathingRole: "source",
      templateId: t.id,
      placementId: null,
      label: t.label,
      subtitle: t.description,
      icon: t.icon,
      accent: t.accent,
      defaultWeekday: t.defaultWeekday,
      weekday: null,
      done: false,
      sortOrder: t.sortOrder,
      session: {
        ...t,
        placement: {
          id: "",
          templateId: t.id,
          weekStart,
          weekday: null,
          waterTempC: null,
          doneAt: null,
          note: null,
        },
      },
    });
  }

  for (const s of bathingWeek.placedSessions) {
    items.push({
      dragId: weekPlanBathingPlacementDragId(s.placement.id),
      kind: "bathing",
      bathingRole: "placement",
      templateId: s.id,
      placementId: s.placement.id,
      label: s.label,
      subtitle: s.description,
      icon: s.icon,
      accent: s.accent,
      defaultWeekday: s.defaultWeekday,
      weekday: s.placement.weekday,
      done: Boolean(s.placement.doneAt),
      sortOrder: s.sortOrder,
      session: s,
    });
  }

  for (const t of taskWeek.tasks) {
    const done = Boolean(t.placement?.doneAt);
    items.push({
      dragId: weekPlanDragId("task", t.id),
      kind: "task",
      taskId: t.id,
      categoryId: t.categoryId,
      completionKind: t.completionKind,
      placement: t.placement,
      label: t.title,
      subtitle:
        done && t.placement
          ? formatWeeklyTaskDetail(t.placement) ?? t.notes
          : t.notes,
      icon: t.icon,
      accent: t.accent,
      defaultWeekday: t.defaultWeekday,
      weekday: t.placement?.weekday ?? null,
      done,
      sortOrder: t.sortOrder,
    });
  }

  if (weightPlan.enabled) {
    items.push({
      dragId: weekPlanDragId("weight", WEIGHT_ITEM_ID),
      kind: "weight",
      label: "Vägning",
      subtitle: "En gång per vecka",
      icon: "⚖️",
      accent: "#c084fc",
      defaultWeekday: weightPlan.defaultWeekday,
      weekday: weightPlan.weekday,
      done: Boolean(weightPlan.log),
      sortOrder: 9999,
      enabled: weightPlan.enabled,
      log: weightPlan.log,
      plan: weightPlan,
    });
  }

  return {
    weekStart,
    items: sortItems(items),
    categories: taskWeek.categories,
  };
}
