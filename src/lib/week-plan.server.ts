import "server-only";
import { getCardioWeekSummary } from "@/lib/cardio.server";
import { getGymWeekSummary } from "@/lib/gym.server";
import { getWeekSummary } from "@/lib/tasks.server";
import { getWeightWeekPlan } from "@/lib/weight.server";
import {
  weekPlanDragId,
  type UnifiedWeekPlan,
  type WeekPlanItem,
} from "@/lib/week-plan";
import { WEIGHT_ITEM_ID } from "@/lib/weight";

const KIND_SORT: Record<WeekPlanItem["kind"], number> = {
  gym: 0,
  cardio: 1,
  task: 2,
  weight: 3,
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
  const [gymWeek, cardioWeek, taskWeek, weightPlan] = await Promise.all([
    getGymWeekSummary(userId, weekStart),
    getCardioWeekSummary(userId, weekStart),
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

  for (const t of taskWeek.tasks) {
    items.push({
      dragId: weekPlanDragId("task", t.id),
      kind: "task",
      taskId: t.id,
      categoryId: t.categoryId,
      label: t.title,
      subtitle: t.notes,
      icon: t.icon,
      accent: t.accent,
      defaultWeekday: t.defaultWeekday,
      weekday: t.placement?.weekday ?? null,
      done: Boolean(t.placement?.doneAt),
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
