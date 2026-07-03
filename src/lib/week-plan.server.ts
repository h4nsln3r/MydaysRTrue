import "server-only";
import { getBathingWeekSummary } from "@/lib/bathing.server";
import { getCardioWeekSummary } from "@/lib/cardio.server";
import { getSportWeekSummary } from "@/lib/sport.server";
import { formatSportDetail } from "@/lib/sport";
import { getGymWeekSummary } from "@/lib/gym.server";
import { formatWeeklyTaskDetail, type Weekday } from "@/lib/tasks";
import { getWeekSummary, getMonthlyBillsForWeek } from "@/lib/tasks.server";
import { getWeightWeekPlan } from "@/lib/weight.server";
import { formatBillAmountKr, resolveMonthlyBillsForWeek, isMonthlyTaskComplete } from "@/lib/monthly-bills";
import { monthlyTaskDisplayTitle } from "@/lib/monthly-finance";
import { formatMonthlyTaskDetail } from "@/lib/tasks";
import {
  weekPlanBathingPlacementDragId,
  weekPlanBathingSourceDragId,
  weekPlanDragId,
  weekPlanMonthlyBillDragId,
  type UnifiedWeekPlan,
  type WeekPlanItem,
} from "@/lib/week-plan";
import { WEIGHT_ITEM_ID } from "@/lib/weight";

const KIND_SORT: Record<WeekPlanItem["kind"], number> = {
  gym: 0,
  cardio: 1,
  sport: 2,
  bathing: 3,
  task: 4,
  monthly_bill: 5,
  weight: 6,
};

function dayPlanSortOrder(
  weekday: Weekday | null,
  daySortOrder: number,
  backlogOrder: number,
): number {
  return weekday != null ? daySortOrder : backlogOrder;
}

function sortItems(items: WeekPlanItem[]): WeekPlanItem[] {
  return [...items].sort((a, b) => {
    const kd = KIND_SORT[a.kind] - KIND_SORT[b.kind];
    if (kd !== 0) return kd;
    return a.sortOrder - b.sortOrder;
  });
}

/** Prefer a placed monthly row over the same dragId sitting in backlog. */
function dedupeMonthlyWeekPlanItems(items: WeekPlanItem[]): WeekPlanItem[] {
  const monthlyByDragId = new Map<string, WeekPlanItem>();
  const rest: WeekPlanItem[] = [];

  for (const item of items) {
    if (item.kind !== "monthly_bill") {
      rest.push(item);
      continue;
    }
    const existing = monthlyByDragId.get(item.dragId);
    if (!existing) {
      monthlyByDragId.set(item.dragId, item);
      continue;
    }
    if (existing.weekday == null && item.weekday != null) {
      monthlyByDragId.set(item.dragId, item);
    }
  }

  return [...rest, ...monthlyByDragId.values()];
}

/** All weekly activities merged for the unified plan board. */
export async function getUnifiedWeekPlan(
  userId: string,
  weekStart: string,
): Promise<UnifiedWeekPlan> {
  const [gymWeek, cardioWeek, sportWeek, bathingWeek, taskWeek, weightPlan, billsWeek] =
    await Promise.all([
      getGymWeekSummary(userId, weekStart),
      getCardioWeekSummary(userId, weekStart),
      getSportWeekSummary(userId, weekStart),
      getBathingWeekSummary(userId, weekStart),
      getWeekSummary(userId, weekStart),
      getWeightWeekPlan(userId, weekStart),
      getMonthlyBillsForWeek(userId, weekStart),
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
      sortOrder: dayPlanSortOrder(
        s.placement.weekday,
        s.placement.daySortOrder,
        s.sortOrder,
      ),
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
      sortOrder: dayPlanSortOrder(
        s.placement.weekday,
        s.placement.daySortOrder,
        s.sortOrder,
      ),
      session: s,
    });
  }

  for (const s of sportWeek.sessions) {
    const detail = formatSportDetail(s.placement);
    items.push({
      dragId: weekPlanDragId("sport", s.id),
      kind: "sport",
      templateId: s.id,
      label: s.label,
      subtitle: s.placement.doneAt
        ? detail
        : s.placement.planSport
          ? `Plan: ${s.placement.planSport}`
          : s.description,
      icon: s.icon,
      accent: s.accent,
      defaultWeekday: s.defaultWeekday,
      weekday: s.placement.weekday,
      done: Boolean(s.placement.doneAt),
      sortOrder: dayPlanSortOrder(
        s.placement.weekday,
        s.placement.daySortOrder,
        s.sortOrder,
      ),
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
          daySortOrder: 0,
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
      sortOrder: dayPlanSortOrder(
        s.placement.weekday,
        s.placement.daySortOrder,
        s.sortOrder,
      ),
      session: s,
    });
  }

  for (const t of taskWeek.tasks) {
    const done = Boolean(t.placement?.doneAt);
    items.push({
      dragId: weekPlanDragId("task", t.id),
      kind: "task",
      taskId: t.id,
      taskKey: t.key,
      categoryId: t.categoryId,
      completionKind: t.completionKind,
      placement: t.placement,
      checklist: t.checklist,
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
      sortOrder: dayPlanSortOrder(
        t.placement?.weekday ?? null,
        t.placement?.daySortOrder ?? 0,
        t.sortOrder,
      ),
      singleWeekStart: t.singleWeekStart,
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
      sortOrder: dayPlanSortOrder(
        weightPlan.weekday,
        weightPlan.daySortOrder,
        9999,
      ),
      enabled: weightPlan.enabled,
      log: weightPlan.log,
      plan: weightPlan,
    });
  }

  const { placed, backlog } = resolveMonthlyBillsForWeek(
    billsWeek.tasks,
    weekStart,
    billsWeek.completionsByTaskMonth,
    billsWeek.categories,
  );

  for (const slot of placed) {
    const completion = billsWeek.completionsByTaskMonth.get(
      `${slot.task.id}|${slot.monthStart}`,
    ) ?? null;
    items.push({
      dragId: weekPlanMonthlyBillDragId(slot.task.id, slot.monthStart),
      kind: "monthly_bill",
      taskId: slot.task.id,
      taskKey: slot.task.key,
      categoryId: slot.task.categoryId,
      monthStart: slot.monthStart,
      scheduledDayOfMonth:
        completion?.scheduledDayOfMonth ?? slot.task.dayOfMonth,
      completionKind: slot.task.completionKind,
      completion,
      notes: slot.task.notes,
      defaultAmountKr: slot.task.defaultAmountKr,
      label: monthlyTaskDisplayTitle(slot.task),
      subtitle:
        slot.task.completionKind === "finance"
          ? formatMonthlyTaskDetail(slot.task, completion) ??
            slot.task.notes ??
            "Fyll i ekonomitabellen"
          : slot.task.completionKind === "amount"
            ? formatMonthlyTaskDetail(slot.task, completion) ??
              formatBillAmountKr({ ...slot.task, completion })
            : formatBillAmountKr({ ...slot.task, completion }) ?? slot.task.notes,
      icon: slot.task.icon,
      accent: slot.task.accent,
      defaultWeekday: null,
      weekday: slot.weekday as Weekday,
      done: isMonthlyTaskComplete(slot.task, completion),
      sortOrder: dayPlanSortOrder(
        slot.weekday as Weekday,
        completion?.daySortOrder ?? 0,
        8000 + slot.task.sortOrder,
      ),
      singleMonthStart: slot.task.singleMonthStart,
    });
  }

  for (const entry of backlog) {
    const completion =
      billsWeek.completionsByTaskMonth.get(
        `${entry.task.id}|${entry.monthStart}`,
      ) ?? null;
    items.push({
      dragId: weekPlanMonthlyBillDragId(entry.task.id, entry.monthStart),
      kind: "monthly_bill",
      taskId: entry.task.id,
      taskKey: entry.task.key,
      categoryId: entry.task.categoryId,
      monthStart: entry.monthStart,
      scheduledDayOfMonth: null,
      completionKind: entry.task.completionKind,
      completion,
      notes: entry.task.notes,
      defaultAmountKr: entry.task.defaultAmountKr,
      label: monthlyTaskDisplayTitle(entry.task),
      subtitle:
        entry.task.completionKind === "finance"
          ? formatMonthlyTaskDetail(entry.task, completion) ??
            entry.task.notes ??
            "Placera på en dag — fyll i ekonomitabellen"
          : entry.task.completionKind === "amount"
            ? formatMonthlyTaskDetail(entry.task, completion) ??
              formatBillAmountKr({ ...entry.task, completion })
            : formatBillAmountKr({ ...entry.task, completion }) ??
              entry.task.notes ??
              "Placera på en dag den här månaden",
      icon: entry.task.icon,
      accent: entry.task.accent,
      defaultWeekday: null,
      weekday: null,
      done: isMonthlyTaskComplete(entry.task, completion),
      sortOrder: 8000 + entry.task.sortOrder,
      singleMonthStart: entry.task.singleMonthStart,
    });
  }

  const allCategories = [
    ...taskWeek.categories,
    ...billsWeek.categories.filter(
      (c) => !taskWeek.categories.some((w) => w.id === c.id),
    ),
  ];

  return {
    weekStart,
    items: sortItems(dedupeMonthlyWeekPlanItems(items)),
    categories: allCategories,
  };
}
