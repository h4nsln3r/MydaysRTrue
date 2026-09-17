import { CARDIO_WEEKLY_GOAL } from "@/lib/cardio";
import { placementLocalDate } from "@/lib/date";
import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import {
  expandWeeklyTaskPlacements,
  groupByCategory,
  scoreCategoryFromTaskGoals,
  type MonthlyTaskForMonth,
  type TaskCategory,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import {
  isMonthlyTaskComplete,
  monthlyTasksOnLocalDate,
} from "@/lib/monthly-bills";

export interface MonthWeekBundle {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  gym: GymSessionForWeek[];
  cardio: CardioSessionForWeek[];
  sport: SportSessionForWeek[];
  bathing: BathingSessionForWeek[];
}

export interface MonthActivityProgress {
  monthStart: string;
  monthEnd: string;
  categories: TaskCategory[];
  weeks: MonthWeekBundle[];
}

export function inInclusiveRange(
  date: string,
  start: string,
  end: string,
): boolean {
  return date >= start && date <= end;
}

export function filterPlacedToRange<
  T extends { placement: { weekStart: string; weekday: number | null } },
>(items: T[], start: string, end: string): T[] {
  return items.filter((item) => {
    const date = placementLocalDate(item.placement);
    return date != null && inInclusiveRange(date, start, end);
  });
}

export function itemsOnDate<
  T extends { placement: { weekStart: string; weekday: number | null } },
>(items: T[], date: string): T[] {
  return items.filter((item) => placementLocalDate(item.placement) === date);
}

export function filterWeeklyTasksToDateRange(
  tasks: WeeklyTaskForWeek[],
  start: string,
  end: string,
): WeeklyTaskForWeek[] {
  return tasks.map((task) => {
    const placements = (task.placements ?? []).filter((p) => {
      const date = placementLocalDate(p);
      return date != null && !p.onHold && inInclusiveRange(date, start, end);
    });
    return {
      ...task,
      placements,
      placement: placements[0] ?? null,
    };
  });
}

export function scoreWeeklyTasksForMonth(
  weeks: Array<{ weekStart: string; tasks: WeeklyTaskForWeek[] }>,
  monthStart: string,
  monthEnd: string,
): { done: number; total: number; extra: number } {
  let done = 0;
  let total = 0;
  for (const week of weeks) {
    const inMonth = filterWeeklyTasksToDateRange(
      week.tasks,
      monthStart,
      monthEnd,
    );
    done += scoreCategoryFromTaskGoals(inMonth).done;
    if (inInclusiveRange(week.weekStart, monthStart, monthEnd)) {
      total += scoreCategoryFromTaskGoals(week.tasks).total;
    }
  }
  return { done, total, extra: Math.max(0, done - total) };
}

export function scoreWeeklyTaskGroupsForMonth(
  weeks: Array<{ weekStart: string; tasks: WeeklyTaskForWeek[] }>,
  categories: TaskCategory[],
  monthStart: string,
  monthEnd: string,
): Map<string, { done: number; total: number; extra: number }> {
  const acc = new Map<string, { done: number; total: number }>();
  const add = (id: string, done: number, total: number) => {
    const prev = acc.get(id) ?? { done: 0, total: 0 };
    acc.set(id, { done: prev.done + done, total: prev.total + total });
  };

  for (const week of weeks) {
    const mondayInMonth = inInclusiveRange(
      week.weekStart,
      monthStart,
      monthEnd,
    );
    const inMonth = filterWeeklyTasksToDateRange(
      week.tasks,
      monthStart,
      monthEnd,
    );
    for (const group of groupByCategory(inMonth, categories)) {
      const id = group.category?.id ?? "uncategorized";
      add(id, scoreCategoryFromTaskGoals(group.items).done, 0);
    }
    if (mondayInMonth) {
      for (const group of groupByCategory(week.tasks, categories)) {
        const id = group.category?.id ?? "uncategorized";
        add(id, 0, scoreCategoryFromTaskGoals(group.items).total);
      }
    }
  }

  const out = new Map<string, { done: number; total: number; extra: number }>();
  for (const [id, value] of acc) {
    out.set(id, {
      ...value,
      extra: Math.max(0, value.done - value.total),
    });
  }
  return out;
}

export function weeklyTasksInMonthByDate(
  weeks: Array<{ tasks: WeeklyTaskForWeek[] }>,
  monthStart: string,
  monthEnd: string,
): WeeklyTaskForWeek[] {
  return weeks.flatMap((week) =>
    expandWeeklyTaskPlacements(week.tasks).filter((task) => {
      const date = task.placement
        ? placementLocalDate(task.placement)
        : null;
      return date != null && inInclusiveRange(date, monthStart, monthEnd);
    }),
  );
}

export function cardioMonthGoal(mondayCount: number): number {
  return CARDIO_WEEKLY_GOAL * mondayCount;
}

export interface PeriodTaskGroup<T> {
  category: TaskCategory | null;
  byDate: Map<string, T[]>;
  done: number;
  total: number;
}

export function groupMonthlyTasksForDates(
  tasks: MonthlyTaskForMonth[],
  dates: string[],
  categories: TaskCategory[],
): PeriodTaskGroup<MonthlyTaskForMonth>[] {
  const byDate = new Map<string, MonthlyTaskForMonth[]>();
  for (const date of dates) {
    byDate.set(
      date,
      monthlyTasksOnLocalDate(tasks, date, undefined, { includeWhenDone: true }),
    );
  }

  const all = dates.flatMap((d) => byDate.get(d) ?? []);
  const groups = groupByCategory(all, categories);
  const seen = new Set(groups.map((g) => g.category?.id ?? "uncategorized"));

  return groups.map(({ category }) => {
    const catId = category?.id ?? null;
    const catByDate = new Map<string, MonthlyTaskForMonth[]>();
    let done = 0;
    let total = 0;
    for (const date of dates) {
      const dayItems = (byDate.get(date) ?? []).filter((t) =>
        catId ? t.categoryId === catId : !t.categoryId,
      );
      catByDate.set(date, dayItems);
      total += dayItems.length;
      done += dayItems.filter((t) =>
        isMonthlyTaskComplete(t, t.completion),
      ).length;
    }
    return { category, byDate: catByDate, done, total };
  }).filter((g) => seen.has(g.category?.id ?? "uncategorized"));
}

export function groupWeeklyTasksByDate(
  tasks: WeeklyTaskForWeek[],
): Map<string, WeeklyTaskForWeek[]> {
  const map = new Map<string, WeeklyTaskForWeek[]>();
  for (const task of tasks) {
    const date = task.placement
      ? placementLocalDate(task.placement)
      : null;
    if (!date) continue;
    const list = map.get(date) ?? [];
    list.push(task);
    map.set(date, list);
  }
  return map;
}

export function weeklyCategoryRowsForMonth(
  weeks: MonthWeekBundle[],
  categories: TaskCategory[],
  monthStart: string,
  monthEnd: string,
): Array<{
  category: TaskCategory | null;
  byDate: Map<string, WeeklyTaskForWeek[]>;
  done: number;
  total: number;
  extra: number;
}> {
  const expanded = weeklyTasksInMonthByDate(weeks, monthStart, monthEnd);
  const scores = scoreWeeklyTaskGroupsForMonth(
    weeks,
    categories,
    monthStart,
    monthEnd,
  );
  const placedById = new Map<string, WeeklyTaskForWeek[]>();
  for (const group of groupByCategory(expanded, categories)) {
    placedById.set(group.category?.id ?? "uncategorized", group.items);
  }

  const rows: Array<{
    category: TaskCategory | null;
    byDate: Map<string, WeeklyTaskForWeek[]>;
    done: number;
    total: number;
    extra: number;
  }> = [];

  for (const category of categories) {
    const scored = scores.get(category.id);
    const items = placedById.get(category.id) ?? [];
    if (!scored && items.length === 0) continue;
    if ((scored?.total ?? 0) === 0 && items.length === 0) continue;
    rows.push({
      category,
      byDate: groupWeeklyTasksByDate(items),
      done: scored?.done ?? 0,
      total: scored?.total ?? 0,
      extra: scored?.extra ?? 0,
    });
  }

  const uncatScore = scores.get("uncategorized");
  const uncatItems = placedById.get("uncategorized") ?? [];
  if (uncatScore || uncatItems.length > 0) {
    rows.push({
      category: null,
      byDate: groupWeeklyTasksByDate(uncatItems),
      done: uncatScore?.done ?? 0,
      total: uncatScore?.total ?? 0,
      extra: uncatScore?.extra ?? 0,
    });
  }

  return rows;
}
