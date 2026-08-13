// Client-safe types + helpers for categories, weekly tasks and monthly tasks.
// Server-only queries live in `./tasks.server`.

import { transferTaskFinanceLabel } from "@/lib/monthly-finance";

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
  /**
   * Legacy category-level weekly target. Progress uses the sum of each task’s
   * weeklyGoal instead; this field is ignored by scoring.
   */
  weeklyGoal: number | null;
}

export type WeeklyTaskCompletionKind =
  | "simple"
  | "shop"
  | "expense"
  | "journal"
  | "laundry"
  | "music"
  | "note";

export const MUSIC_BANDS = ["Totes", "Bojeng"] as const;
export type MusicBand = (typeof MUSIC_BANDS)[number];

export const MUSIC_OTHER_BAND = "Annat";

export const MUSIC_ACTIVITIES = [
  "rep",
  "bas",
  "gitarr",
  "piano",
  "ovning",
  "inspelning",
  "live",
  "spelning",
] as const;

export type MusicActivity = (typeof MUSIC_ACTIVITIES)[number];

export const MUSIC_ACTIVITY_LABEL: Record<MusicActivity, string> = {
  rep: "Rep",
  bas: "Bas",
  gitarr: "Gitarr",
  piano: "Piano",
  ovning: "Övning",
  inspelning: "Inspelning",
  live: "Live",
  spelning: "Spelning",
};

export const MUSIC_ACTIVITY_ICON: Record<MusicActivity, string> = {
  rep: "🤘",
  bas: "🎸",
  gitarr: "🎸",
  piano: "🎹",
  ovning: "🎵",
  inspelning: "🎙️",
  live: "🎫",
  spelning: "🎤",
};

export const MUSIC_ACTIVITY_HINT: Record<MusicActivity, string> = {
  rep: "Repa med ett av banden eller i en annan konstellation",
  bas: "Basträning själv",
  gitarr: "Gitarrträning",
  piano: "Pianoträning",
  ovning: "Övning på annat instrument",
  inspelning: "Studio / inspelning",
  live: "Gå på ett live-gig",
  spelning: "Spela på en spelning, med ett band eller i annan konstellation",
};

const MUSIC_ACTIVITY_SET = new Set<string>(MUSIC_ACTIVITIES);

export function isMusicActivity(value: string | null | undefined): value is MusicActivity {
  return value != null && MUSIC_ACTIVITY_SET.has(value);
}

export function parseMusicActivity(
  value: string | null | undefined,
): MusicActivity | null {
  return isMusicActivity(value) ? value : null;
}

export function musicActivityNeedsBand(activity: MusicActivity | null): boolean {
  return activity === "rep" || activity === "spelning";
}

export function musicActivityCreatesGig(activity: MusicActivity | null): boolean {
  return activity === "spelning";
}

export function musicActivityCreatesLiveEvent(
  activity: MusicActivity | null,
): boolean {
  return activity === "live";
}

export function isKnownMusicBand(value: string | null | undefined): value is MusicBand {
  return value != null && (MUSIC_BANDS as readonly string[]).includes(value);
}

/** Canonical unified music weekly task (plus leftover legacy keys). */
export function isMusicWeeklyTaskKey(key: string | null | undefined): boolean {
  return key === "music" || (key?.startsWith("music_") ?? false);
}

export function musicActivityFromLegacyKey(
  key: string | null | undefined,
): MusicActivity | null {
  if (!key) return null;
  if (key === "music_bas" || key.startsWith("music_bas_")) return "bas";
  if (key === "music_guitar") return "gitarr";
  if (key === "music_inspelning") return "inspelning";
  if (key === "music_rep" || key.startsWith("music_rep_")) return "rep";
  if (key === "music_live") return "live";
  return null;
}

export function musicSessionTitle(
  task: { title: string; completionKind?: WeeklyTaskCompletionKind },
  placement: { musicActivity?: MusicActivity | null } | null | undefined,
): string {
  if (task.completionKind === "music" && placement?.musicActivity) {
    return MUSIC_ACTIVITY_LABEL[placement.musicActivity];
  }
  return task.title;
}

export function musicSessionIcon(
  task: { icon: string; completionKind?: WeeklyTaskCompletionKind },
  placement: { musicActivity?: MusicActivity | null } | null | undefined,
): string {
  if (task.completionKind === "music" && placement?.musicActivity) {
    return MUSIC_ACTIVITY_ICON[placement.musicActivity];
  }
  return task.icon;
}

/** How a music weekly task was logged when completed (gig/live year boards). */
export type MusicLogKind = "gig" | "live";

export const MUSIC_LOG_KIND_LABEL: Record<MusicLogKind, string> = {
  gig: "Spelning",
  live: "Live spelning",
};

export function musicLogKindFromActivity(
  activity: MusicActivity | null,
): MusicLogKind | null {
  if (activity === "spelning") return "gig";
  if (activity === "live") return "live";
  return null;
}

/** @deprecated Prefer musicActivityNeedsBand — kept for leftover music_rep_* rows. */
export function isMusicRepTask(key: string | null): boolean {
  return (
    key === "music_rep" ||
    key === "music_live" ||
    (key?.startsWith("music_rep_") ?? false)
  );
}

/** Weekly tasks that historically defaulted to multi-drag (before is_repeatable). */
export const REPEATABLE_WEEKLY_TASK_KEYS = [
  "dev_code",
  "home_handla",
  "life_ring_mamma",
  "music",
  "music_rep",
  "music_bas",
  "music_live",
] as const;

export type RepeatableWeeklyTaskKey =
  (typeof REPEATABLE_WEEKLY_TASK_KEYS)[number];

/** Default goal when a task is marked repeatable. */
export const REPEATABLE_WEEKLY_TASK_GOAL = 2;

const REPEATABLE_WEEKLY_TASK_KEY_SET = new Set<string>(
  REPEATABLE_WEEKLY_TASK_KEYS,
);

export function isRepeatableWeeklyTaskKey(
  key: string | null | undefined,
): key is RepeatableWeeklyTaskKey {
  return key != null && REPEATABLE_WEEKLY_TASK_KEY_SET.has(key);
}

/** Prefer the DB flag; fall back to legacy key list during migration. */
export function isWeeklyTaskRepeatable(task: {
  isRepeatable?: boolean;
  key?: string | null;
}): boolean {
  if (typeof task.isRepeatable === "boolean") return task.isRepeatable;
  return isRepeatableWeeklyTaskKey(task.key);
}

export function isCodingWeeklyTaskKey(key: string | null | undefined): boolean {
  return key === "dev_code";
}

/** Clamp a weekly goal to the allowed range. */
export function normalizeWeeklyGoal(goal: number | null | undefined): number {
  const n = Math.round(Number(goal));
  if (!Number.isFinite(n)) return REPEATABLE_WEEKLY_TASK_GOAL;
  return Math.max(1, Math.min(14, n));
}

/** Score a repeatable weekly goal: total is the goal; hit can exceed it. */
export function scoreRepeatableWeeklyGoal(
  doneCount: number,
  goal: number = REPEATABLE_WEEKLY_TASK_GOAL,
): {
  hit: number;
  total: number;
} {
  const done = Math.max(0, doneCount);
  return { hit: done, total: normalizeWeeklyGoal(goal) };
}

/** Count completed (placed, not on-hold) instances across weekly tasks. */
export function countCompletedWeeklyPlacements(
  tasks: Array<{
    placements?: Array<{
      weekday: Weekday | null;
      onHold?: boolean;
      doneAt: string | null;
    }>;
    placement?: {
      weekday: Weekday | null;
      onHold?: boolean;
      doneAt: string | null;
    } | null;
  }>,
): number {
  let done = 0;
  for (const task of tasks) {
    const list =
      task.placements && task.placements.length > 0
        ? task.placements
        : task.placement
          ? [task.placement]
          : [];
    for (const p of list) {
      if (p.weekday != null && !p.onHold && p.doneAt) done += 1;
    }
  }
  return done;
}

/**
 * Category week score = sum of task goals vs completed placements.
 * Category-level weeklyGoal is ignored (auto from tasks).
 */
export function scoreCategoryFromTaskGoals(
  tasks: Array<{
    weeklyGoal?: number;
    isRepeatable?: boolean;
    key?: string | null;
    placements?: Array<{
      weekday: Weekday | null;
      onHold?: boolean;
      doneAt: string | null;
    }>;
    placement?: {
      weekday: Weekday | null;
      onHold?: boolean;
      doneAt: string | null;
    } | null;
  }>,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    const goal = normalizeWeeklyGoal(task.weeklyGoal);
    total += goal;
    done += countCompletedWeeklyPlacements([task]);
  }
  return { done, total };
}

/** @deprecated Prefer scoreCategoryFromTaskGoals — category goals are derived from tasks. */
export function scoreCategoryWeeklyGoal(
  tasks: Parameters<typeof countCompletedWeeklyPlacements>[0],
  weeklyGoal: number | null | undefined,
  fallback: { done: number; total: number },
): { done: number; total: number } {
  if (weeklyGoal == null) return fallback;
  const completed = countCompletedWeeklyPlacements(tasks);
  return { done: completed, total: normalizeWeeklyGoal(weeklyGoal) };
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
  /** One-off task — only shown for this week (Monday YYYY-MM-DD). */
  singleWeekStart: string | null;
  /** When false, hidden from week planning until turned back on. */
  enabled: boolean;
  /** Can be dragged onto the plan multiple times in one week. */
  isRepeatable: boolean;
  /** How many completions count as “hit” for the week (when repeatable). */
  weeklyGoal: number;
}

export interface TaskCategoryGroup<T extends { categoryId: string | null }> {
  id: string;
  category: TaskCategory | null;
  items: T[];
}

/** Groups tasks under their category (category sort order, uncategorized last). */
export function groupTasksByCategory<T extends { categoryId: string | null }>(
  categories: TaskCategory[],
  items: T[],
): TaskCategoryGroup<T>[] {
  const byId = new Map<string, TaskCategoryGroup<T>>();
  for (const category of categories) {
    byId.set(category.id, { id: category.id, category, items: [] });
  }
  const uncategorized: TaskCategoryGroup<T> = {
    id: "uncategorized",
    category: null,
    items: [],
  };

  for (const item of items) {
    const group = item.categoryId ? byId.get(item.categoryId) : uncategorized;
    (group ?? uncategorized).items.push(item);
  }

  const groups: TaskCategoryGroup<T>[] = [];
  for (const category of categories) {
    const group = byId.get(category.id);
    if (group && group.items.length > 0) groups.push(group);
  }
  if (uncategorized.items.length > 0) groups.push(uncategorized);
  return groups;
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
  /** When false, hidden from month/week planning until turned back on. */
  enabled: boolean;
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
  /** Raw sum text as typed (e.g. "45+120+8,50"); null for legacy rows. */
  shopAmountExpr: string | null;
  laundryLoads: number | null;
  /** Planned music session type (rep, bas, live, …). */
  musicActivity: MusicActivity | null;
  /** Optional to-do for this music occasion. */
  planTodo: string | null;
  /** Band or constellation name (Totes, Bojeng, or free text). */
  band: string | null;
  /** When set, completion also registered a gig or attended live concert. */
  musicLogKind: MusicLogKind | null;
  /** Linked own-band gig created from this completion. */
  gigId: string | null;
  /** Linked live event created from this completion. */
  liveEventId: string | null;
  /** Paused for this week — hidden from backlog/days until placed again. */
  onHold: boolean;
  /** Coding session project (dev_code only). */
  codingProjectId: string | null;
  codingProjectTitle: string | null;
}

export interface WeeklyTaskChecklistCompletion {
  id: string;
  checklistItemId: string;
  localDate: string;
  note: string | null;
  doneAt: string;
}

export interface WeeklyTaskChecklistItem {
  id: string;
  taskId: string;
  text: string;
  sortOrder: number;
  /** Completion on the day being viewed, when loaded for a specific date. */
  completion: WeeklyTaskChecklistCompletion | null;
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
  /**
   * Primary placement for this row. For expanded placement instances this is
   * that placement; for the template summary it is the first placed (or any).
   */
  placement: WeeklyPlacement | null;
  /** All placements of this task in the week (repeatable tasks may have many). */
  placements: WeeklyPlacement[];
  checklist: WeeklyTaskChecklistItem[];
  /** All checklist completions in this week (for journal / day plan). */
  checklistCompletions: WeeklyTaskChecklistCompletion[];
}

/** One entry per day placement (repeatable tasks expand to multiple rows). */
export function expandWeeklyTaskPlacements(
  tasks: WeeklyTaskForWeek[],
): WeeklyTaskForWeek[] {
  const out: WeeklyTaskForWeek[] = [];
  for (const task of tasks) {
    const placed = task.placements.filter(
      (p) => p.weekday != null && !p.onHold,
    );
    if (placed.length === 0) {
      out.push(task);
      continue;
    }
    for (const placement of placed) {
      out.push({
        ...task,
        placement,
        placements: [placement],
      });
    }
  }
  return out;
}

/** Stable React list key for a weekly task row (placement instance when present). */
export function weeklyTaskInstanceKey(task: WeeklyTaskForWeek): string {
  return task.placement?.id ?? task.id;
}

function formatShopAmountLabel(placement: WeeklyPlacement): string {
  const amount = placement.shopAmount;
  if (amount == null) return "";
  const expr = placement.shopAmountExpr?.trim();
  if (expr && /[+\-]/.test(expr.replace(/\s/g, "").slice(1))) {
    return `${expr} = ${amount} kr`;
  }
  return `${amount} kr`;
}

export function formatWeeklyTaskDetail(placement: WeeklyPlacement): string | null {
  if (placement.codingProjectTitle?.trim() && placement.note?.trim()) {
    return `${placement.codingProjectTitle.trim()} · ${placement.note.trim()}`;
  }
  if (placement.codingProjectTitle?.trim()) {
    return placement.codingProjectTitle.trim();
  }
  if (placement.shopLocation && placement.shopAmount != null) {
    return `${placement.shopLocation} · ${formatShopAmountLabel(placement)}`;
  }
  if (placement.shopAmount != null && !placement.shopLocation) {
    return formatShopAmountLabel(placement);
  }
  if (placement.shopLocation?.trim()) {
    return placement.shopLocation.trim();
  }
  if (placement.laundryLoads != null) {
    const time = placement.planNote ? `${placement.planNote} · ` : "";
    return `${time}${placement.laundryLoads} tvättar`;
  }
  const musicParts: string[] = [];
  if (placement.band) musicParts.push(placement.band);
  if (placement.planTodo?.trim()) musicParts.push(placement.planTodo.trim());
  if (placement.musicLogKind && placement.note) {
    musicParts.push(placement.note);
  } else if (placement.note) {
    musicParts.push(placement.note);
  } else if (placement.planNote) {
    musicParts.push(placement.planNote);
  }
  if (musicParts.length > 0) return musicParts.join(" · ");
  return null;
}

/** A monthly task in the context of a specific month. */
export interface MonthlyTaskForMonth extends MonthlyTask {
  /** null = not yet touched this month. */
  completion: MonthlyCompletion | null;
}

export function formatMonthlyTaskDetail(
  task: Pick<MonthlyTask, "completionKind" | "key">,
  completion: MonthlyCompletion | null,
): string | null {
  if (!completion) return null;

  const hasAmount =
    completion.amount != null && Number.isFinite(completion.amount);
  const note = completion.note?.trim() || null;

  // Amount tasks, bills with a saved cost, and savings transfers.
  if (task.completionKind === "amount" || hasAmount) {
    if (!hasAmount && !note) return null;
    const parts: string[] = [];
    if (hasAmount) {
      const amountLabel = `${Math.round(completion.amount!).toLocaleString("sv-SE")} kr`;
      const transferTarget = transferTaskFinanceLabel(task.key);
      parts.push(
        transferTarget ? `${amountLabel} → ${transferTarget}` : amountLabel,
      );
    }
    if (note) parts.push(note);
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  return note;
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
  return [...fromMapValues(byTitle)].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** One row per seeded `key` (then title for keyless rows). */
export function dedupeMonthlyTasks<T extends MonthlyTask>(tasks: T[]): T[] {
  const byKey = new Map<string, T>();
  const keyless: T[] = [];
  for (const task of tasks) {
    if (task.key) {
      const existing = byKey.get(task.key);
      byKey.set(task.key, existing ? pickMonthlyTaskKeeper(existing, task) : task);
    } else {
      keyless.push(task);
    }
  }
  return dedupeMonthlyTasksByTitle([...fromMapValues(byKey), ...keyless]);
}

function fromMapValues<V>(map: Map<string, V>): V[] {
  return [...map.values()];
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
