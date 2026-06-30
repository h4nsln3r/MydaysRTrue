// Client-safe types + helpers for categories, weekly tasks and monthly tasks.
// Server-only queries live in `./tasks.server`.

// 'daily' = habit categories. 'task' = shared categories used by BOTH weekly
// and monthly tasks. 'weekly'/'monthly' are legacy values kept for type-compat
// with old rows (migrated to 'task' in 0028).
export type TaskScope = "daily" | "weekly" | "monthly" | "task";

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

export type WeeklyTaskCompletionKind =
  | "simple"
  | "shop"
  | "journal"
  | "laundry"
  | "music"
  | "note";

export const MUSIC_BANDS = ["Totes", "Bojeng"] as const;
export type MusicBand = (typeof MUSIC_BANDS)[number];

export function isMusicRepTask(key: string | null): boolean {
  return key?.startsWith("music_rep_") ?? false;
}

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

export type MonthlyTaskCompletionKind = "simple" | "amount" | "finance";

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
  completionKind: MonthlyTaskCompletionKind;
  /** One-off task — only shown for this month (YYYY-MM-01). */
  singleMonthStart: string | null;
  /** Typical monthly cost (kr) — used for Räkningar. */
  defaultAmountKr: number | null;
}

export interface WeeklyPlacement {
  id: string;
  taskId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  /** null = in the week backlog until placed on a day. */
  weekday: Weekday | null;
  /** Order among tasks on this weekday in the week plan (0 = first). */
  daySortOrder: number;
  doneAt: string | null;
  /** Plan / booked time before completing (journal, laundry). */
  planNote: string | null;
  /** Completion summary (journal) or legacy note. */
  note: string | null;
  shopLocation: string | null;
  shopAmount: number | null;
  laundryLoads: number | null;
  /** Band name for music rep tasks (Totes / Bojeng). */
  band: MusicBand | null;
}

export interface WeeklyTaskChecklistItem {
  id: string;
  taskId: string;
  text: string;
  doneAt: string | null;
  sortOrder: number;
}

export interface MonthlyCompletion {
  id: string;
  taskId: string;
  monthStart: string; // YYYY-MM-01
  doneAt: string | null;
  note: string | null;
  /** Transfer amount (kr) for `amount` completion kind. */
  amount: number | null;
  /** Per-month placement override (1–31). */
  scheduledDayOfMonth: number | null;
  /** ISO week (Monday) for week-only or day placement this month. */
  scheduledWeekStart: string | null;
  /** User cleared planning for this month (overrides default day). */
  isUnscheduled: boolean;
  /** Order on the weekday when shown in the week plan. */
  daySortOrder: number;
}

/** A weekly task in the context of a specific week. */
export interface WeeklyTaskForWeek extends WeeklyTask {
  /** null = no row yet for this week. */
  placement: WeeklyPlacement | null;
  checklist: WeeklyTaskChecklistItem[];
}

export function formatWeeklyTaskDetail(placement: WeeklyPlacement): string | null {
  if (placement.shopLocation && placement.shopAmount != null) {
    return `${placement.shopLocation} · ${placement.shopAmount} kr`;
  }
  if (placement.laundryLoads != null) {
    const time = placement.planNote ? `${placement.planNote} · ` : "";
    return `${time}${placement.laundryLoads} tvättar`;
  }
  if (placement.band && placement.note) {
    return `${placement.band} · ${placement.note}`;
  }
  if (placement.band) return placement.band;
  if (placement.note) return placement.note;
  if (placement.planNote) return placement.planNote;
  return null;
}

/** A monthly task in the context of a specific month. */
export interface MonthlyTaskForMonth extends MonthlyTask {
  /** null = not yet touched this month. */
  completion: MonthlyCompletion | null;
}

export function formatMonthlyTaskDetail(
  task: Pick<MonthlyTask, "completionKind">,
  completion: MonthlyCompletion | null,
): string | null {
  if (!completion) return null;
  if (task.completionKind === "amount" && completion.amount != null) {
    const base = `${Math.round(completion.amount).toLocaleString("sv-SE")} kr`;
    const note = completion.note?.trim();
    return note ? `${base} · ${note}` : base;
  }
  return completion.note?.trim() || null;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Returns the first day of the month for a YYYY-MM-DD or 'YYYY-MM' string. */
export function monthStartFor(localDate: string): string {
  return `${localDate.slice(0, 7)}-01`;
}

/** Incomplete items first; optional tie-breaker preserves plan order within each group. */
export function sortIncompleteFirst<T>(
  items: T[],
  isComplete: (item: T) => boolean,
  tieBreak: (a: T, b: T) => number = () => 0,
): T[] {
  return [...items].sort((a, b) => {
    const aDone = isComplete(a);
    const bDone = isComplete(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return tieBreak(a, b);
  });
}

/** Day view: week-plan order while pending; completed sink to the bottom in check-off order. */
export function sortWeeklyDayTasks(tasks: WeeklyTaskForWeek[]): WeeklyTaskForWeek[] {
  return [...tasks].sort((a, b) => {
    const aDone = Boolean(a.placement?.doneAt);
    const bDone = Boolean(b.placement?.doneAt);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (!aDone) {
      return (
        (a.placement?.daySortOrder ?? a.sortOrder) -
        (b.placement?.daySortOrder ?? b.sortOrder)
      );
    }
    const at = a.placement?.doneAt ?? "";
    const bt = b.placement?.doneAt ?? "";
    return at.localeCompare(bt);
  });
}

/** Prefer seeded / categorized / permanent templates when titles collide. */
export function monthlyTaskKeeperScore(
  task: Pick<MonthlyTask, "key" | "categoryId" | "singleMonthStart" | "sortOrder">,
): number {
  let score = 0;
  if (task.key) score += 1000;
  if (task.key === "bill_hyra") score += 500;
  if (task.categoryId) score += 100;
  if (!task.singleMonthStart) score += 50;
  return score * 1000 - task.sortOrder;
}

export function pickMonthlyTaskKeeper<
  T extends Pick<MonthlyTask, "key" | "categoryId" | "singleMonthStart" | "sortOrder">,
>(a: T, b: T): T {
  return monthlyTaskKeeperScore(a) >= monthlyTaskKeeperScore(b) ? a : b;
}

/** One visible row per title (case-insensitive). */
export function dedupeMonthlyTasksByTitle<T extends MonthlyTask>(tasks: T[]): T[] {
  const byTitle = new Map<string, T>();
  for (const task of tasks) {
    const norm = task.title.trim().toLowerCase();
    const existing = byTitle.get(norm);
    byTitle.set(norm, existing ? pickMonthlyTaskKeeper(existing, task) : task);
  }
  return [...byTitle.values()].sort((a, b) => a.sortOrder - b.sortOrder);
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
