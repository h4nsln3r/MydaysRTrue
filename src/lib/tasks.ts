// Client-safe types + helpers for categories, weekly tasks and monthly tasks.
// Server-only queries live in `./tasks.server`.

export type TaskScope = "daily" | "weekly" | "monthly";

/** ISO weekday: 1 = Mon … 7 = Sun. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: "Mån",
  2: "Tis",
  3: "Ons",
  4: "Tors",
  5: "Fre",
  6: "Lör",
  7: "Sön",
};

export const WEEKDAY_LONG: Record<Weekday, string> = {
  1: "Måndag",
  2: "Tisdag",
  3: "Onsdag",
  4: "Torsdag",
  5: "Fredag",
  6: "Lördag",
  7: "Söndag",
};

export interface TaskCategory {
  id: string;
  scope: TaskScope;
  name: string;
  icon: string;
  accent: string;
  sortOrder: number;
}

export type WeeklyTaskCompletionKind = "simple" | "shop" | "journal" | "laundry";

export interface WeeklyTask {
  id: string;
  categoryId: string | null;
  key: string | null;
  title: string;
  notes: string | null;
  icon: string;
  accent: string;
  sortOrder: number;
  completionKind: WeeklyTaskCompletionKind;
  /** Suggested ISO weekday when a new week is opened (1 = Mon … 7 = Sun). */
  defaultWeekday: Weekday | null;
}

export interface MonthlyTask {
  id: string;
  categoryId: string | null;
  key: string | null;
  title: string;
  notes: string | null;
  /** Suggested day in the month (1–31). Null = anytime. */
  dayOfMonth: number | null;
  icon: string;
  accent: string;
  sortOrder: number;
}

export interface WeeklyPlacement {
  id: string;
  taskId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  /** null = in the week backlog until placed on a day. */
  weekday: Weekday | null;
  doneAt: string | null;
  /** Plan / booked time before completing (journal, laundry). */
  planNote: string | null;
  /** Completion summary (journal) or legacy note. */
  note: string | null;
  shopLocation: string | null;
  shopAmount: number | null;
  laundryLoads: number | null;
}

export interface MonthlyCompletion {
  id: string;
  taskId: string;
  monthStart: string; // YYYY-MM-01
  doneAt: string | null;
  note: string | null;
  /** Per-month placement override (1–31). */
  scheduledDayOfMonth: number | null;
  /** User moved this bill back to backlog for the month. */
  isUnscheduled: boolean;
}

/** A weekly task in the context of a specific week. */
export interface WeeklyTaskForWeek extends WeeklyTask {
  /** null = no row yet for this week. */
  placement: WeeklyPlacement | null;
}

export function formatWeeklyTaskDetail(placement: WeeklyPlacement): string | null {
  if (placement.shopLocation && placement.shopAmount != null) {
    return `${placement.shopLocation} · ${placement.shopAmount} kr`;
  }
  if (placement.laundryLoads != null) {
    const time = placement.planNote ? `${placement.planNote} · ` : "";
    return `${time}${placement.laundryLoads} tvättar`;
  }
  if (placement.note) return placement.note;
  if (placement.planNote) return placement.planNote;
  return null;
}

/** A monthly task in the context of a specific month. */
export interface MonthlyTaskForMonth extends MonthlyTask {
  /** null = not yet touched this month. */
  completion: MonthlyCompletion | null;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Returns the first day of the month for a YYYY-MM-DD or 'YYYY-MM' string. */
export function monthStartFor(localDate: string): string {
  return `${localDate.slice(0, 7)}-01`;
}

/** Group items by category id, preserving the order of `categories` then `none`. */
export function groupByCategory<T extends { categoryId: string | null }>(
  items: T[],
  categories: TaskCategory[],
): { category: TaskCategory | null; items: T[] }[] {
  const byCat = new Map<string, T[]>();
  const uncat: T[] = [];
  for (const it of items) {
    if (it.categoryId) {
      const list = byCat.get(it.categoryId) ?? [];
      list.push(it);
      byCat.set(it.categoryId, list);
    } else {
      uncat.push(it);
    }
  }
  const out: { category: TaskCategory | null; items: T[] }[] = [];
  for (const c of categories) {
    const list = byCat.get(c.id);
    if (list && list.length > 0) out.push({ category: c, items: list });
  }
  if (uncat.length > 0) out.push({ category: null, items: uncat });
  return out;
}

/** Validate a hex color like #aabbcc. Used by forms. */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
