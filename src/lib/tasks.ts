// Client-safe types + helpers for categories, weekly tasks and monthly tasks.
// Server-only queries live in `./tasks.server`.

import {
  addDaysISO,
  formatMonthDayLong,
  localISOFromTimestamp,
  parseLocalISO,
} from "@/lib/date";
import { GAME_KIND_ICON, GAME_KIND_LABEL, type GameKind } from "@/lib/games";
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

/** How a shop/expense amount is split: groceries, personal, or shared. */
export const SPEND_KINDS = ["food", "private", "shared"] as const;
export type SpendKind = (typeof SPEND_KINDS)[number];

export const SHOP_SPEND_KINDS = SPEND_KINDS;
export const EXPENSE_SPEND_KINDS = ["private", "shared"] as const;

export const SPEND_KIND_LABEL: Record<SpendKind, string> = {
  food: "Mat",
  private: "Privat",
  shared: "Delat",
};

export const SPEND_KIND_ICON: Record<SpendKind, string> = {
  food: "🥗",
  private: "🙋",
  shared: "🤝",
};

export const SPEND_KIND_HINT: Record<SpendKind, string> = {
  food: "Matinköp till hushållet",
  private: "Bara du som betalar",
  shared: "Delas mellan dig och Julia",
};

const SPEND_KIND_SET = new Set<string>(SPEND_KINDS);

export function isSpendKind(value: string | null | undefined): value is SpendKind {
  return value != null && SPEND_KIND_SET.has(value);
}

export function parseSpendKind(
  value: string | null | undefined,
): SpendKind | null {
  return isSpendKind(value) ? value : null;
}

export function allowedSpendKinds(
  completionKind: WeeklyTaskCompletionKind,
): readonly SpendKind[] {
  if (completionKind === "shop") return SHOP_SPEND_KINDS;
  if (completionKind === "expense") return EXPENSE_SPEND_KINDS;
  return [];
}

export function parseSpendKindFor(
  completionKind: WeeklyTaskCompletionKind,
  value: string | null | undefined,
): SpendKind | null {
  const parsed = parseSpendKind(value);
  if (!parsed) return null;
  return allowedSpendKinds(completionKind).includes(parsed) ? parsed : null;
}

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
  task: { title: string; completionKind?: WeeklyTaskCompletionKind; key?: string | null },
  placement: {
    musicActivity?: MusicActivity | null;
    gameTitle?: string | null;
  } | null | undefined,
): string {
  if (placement?.gameTitle?.trim()) {
    return placement.gameTitle.trim();
  }
  if (task.completionKind === "music" && placement?.musicActivity) {
    return MUSIC_ACTIVITY_LABEL[placement.musicActivity];
  }
  return task.title;
}

export function musicSessionIcon(
  task: { icon: string; completionKind?: WeeklyTaskCompletionKind },
  placement: {
    musicActivity?: MusicActivity | null;
    gameKind?: GameKind | null;
    gameIcon?: string | null;
  } | null | undefined,
): string {
  if (placement?.gameIcon?.trim()) return placement.gameIcon.trim();
  if (placement?.gameKind) {
    return GAME_KIND_ICON[placement.gameKind];
  }
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
  "home_projekt",
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

/** HH:MM from a time input (optional seconds). */
export function parseLaundryBookTime(value: string): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

/** e.g. "Torsdag 10 sep · 14:00" */
export function formatLaundryBookingNote(date: string, time: string): string {
  const weekday = parseLocalISO(date).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${label} · ${time}`;
}

export function isLaundryFollowUpPlacement(placement: {
  laundryBookedFromId?: string | null;
}): boolean {
  return Boolean(placement.laundryBookedFromId);
}

/** Weekly laundry marked done because a slot was booked (no loads yet). */
export function isLaundryBookingCompletion(placement: {
  laundryBookedFromId?: string | null;
  laundryLoads: number | null;
  doneAt: string | null;
}): boolean {
  return (
    Boolean(placement.doneAt) &&
    placement.laundryLoads == null &&
    !placement.laundryBookedFromId
  );
}

export function isCodingWeeklyTaskKey(key: string | null | undefined): boolean {
  return key === "dev_code";
}

export function isGameWeeklyTaskKey(key: string | null | undefined): boolean {
  return key === "game" || key === "game_dnd";
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

type WeeklyTaskScoreInput = {
  id?: string;
  title?: string;
  icon?: string;
  sortOrder?: number;
  weeklyGoal?: number;
  isRepeatable?: boolean;
  key?: string | null;
  singleWeekStart?: string | null;
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
};

/** Recurring templates count toward the category goal; one-offs are extra. */
export function isRecurringWeeklyTask(task: {
  singleWeekStart?: string | null;
}): boolean {
  return task.singleWeekStart == null;
}

function weeklyTaskCountedCompletions(task: WeeklyTaskScoreInput): number {
  const goal = normalizeWeeklyGoal(task.weeklyGoal);
  const completed = countCompletedWeeklyPlacements([task]);
  // Non-repeatable laundry can have a booking row + a wash follow-up;
  // the weekly goal stays 1 even if both rows are done.
  if (isWeeklyTaskRepeatable(task) || !isRecurringWeeklyTask(task)) {
    return completed;
  }
  return Math.min(completed, goal);
}

/**
 * Category week score = sum of recurring task goals vs all completions.
 * One-offs and extra repeats can push `done` above `total` (bonus points).
 * Category-level weeklyGoal is ignored (auto from tasks).
 */
export function scoreCategoryFromTaskGoals(
  tasks: WeeklyTaskScoreInput[],
): { done: number; total: number; extra: number } {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    if (isRecurringWeeklyTask(task)) {
      total += normalizeWeeklyGoal(task.weeklyGoal);
    }
    done += weeklyTaskCountedCompletions(task);
  }
  return { done, total, extra: Math.max(0, done - total) };
}

export interface CategoryTaskGoalRow {
  id: string;
  title: string;
  icon: string;
  goal: number;
  completed: number;
  towardGoal: number;
  extra: number;
  missing: number;
}

/** Recurring tasks that make up a category’s weekly target. */
export function categoryTaskGoalRows(
  tasks: WeeklyTaskScoreInput[],
): CategoryTaskGoalRow[] {
  return tasks
    .filter((task) => isRecurringWeeklyTask(task) && task.id)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((task) => {
      const goal = normalizeWeeklyGoal(task.weeklyGoal);
      const completed = weeklyTaskCountedCompletions(task);
      const towardGoal = Math.min(completed, goal);
      return {
        id: task.id as string,
        title: task.title ?? "",
        icon: task.icon ?? "•",
        goal,
        completed,
        towardGoal,
        extra: Math.max(0, completed - goal),
        missing: Math.max(0, goal - towardGoal),
      };
    });
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
  /** Can be placed on several days in the same month (Fest). */
  isRepeatable: boolean;
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
  /** Grocery vs private vs shared — set when planning or completing shop/expense. */
  spendKind: SpendKind | null;
  laundryLoads: number | null;
  /** Wash follow-up created when the week's laundry was completed as a booking. */
  laundryBookedFromId: string | null;
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
  /** Chosen game from the user catalog (SPEL / game task). */
  gameId: string | null;
  gameTitle: string | null;
  gameKind: GameKind | null;
  gameIcon: string | null;
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
  /** Extra placement of a repeatable monthly task (Fest). */
  isInstance: boolean;
  /** Kind of party / occasion, e.g. kräftskiva. */
  occasion: string | null;
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

/**
 * Day-view / journal: incomplete tasks stay on the planned weekday.
 * Completed one-offs land on the Stockholm calendar day they were finished.
 */
export function weeklyTaskVisibleOnLocalDate(
  task: {
    singleWeekStart: string | null;
    placement?: {
      weekday: number | null;
      weekStart: string;
      doneAt: string | null;
      onHold?: boolean;
    } | null;
  },
  localDate: string,
): boolean {
  const placement = task.placement;
  if (!placement || placement.weekday == null || placement.onHold) return false;
  if (task.singleWeekStart && placement.doneAt) {
    return localISOFromTimestamp(placement.doneAt) === localDate;
  }
  return addDaysISO(placement.weekStart, placement.weekday - 1) === localDate;
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

export function formatWeeklyTaskDetail(
  placement: WeeklyPlacement,
  completionKind?: WeeklyTaskCompletionKind,
): string | null {
  if (placement.codingProjectTitle?.trim() && placement.note?.trim()) {
    return `${placement.codingProjectTitle.trim()} · ${placement.note.trim()}`;
  }
  if (placement.codingProjectTitle?.trim()) {
    return placement.codingProjectTitle.trim();
  }
  const gameKindLabel = placement.gameKind
    ? GAME_KIND_LABEL[placement.gameKind]
    : null;
  if (gameKindLabel || placement.gameTitle?.trim()) {
    const bits: string[] = [];
    if (gameKindLabel) bits.push(gameKindLabel);
    if (placement.planNote?.trim()) bits.push(placement.planNote.trim());
    if (placement.note?.trim()) bits.push(placement.note.trim());
    if (bits.length > 0) return bits.join(" · ");
    if (placement.gameTitle?.trim()) return placement.gameTitle.trim();
  }
  const spendLabel = placement.spendKind
    ? SPEND_KIND_LABEL[placement.spendKind]
    : null;
  if (placement.shopLocation && placement.shopAmount != null) {
    const core = `${placement.shopLocation} · ${formatShopAmountLabel(placement)}`;
    return spendLabel ? `${spendLabel} · ${core}` : core;
  }
  if (placement.shopAmount != null && !placement.shopLocation) {
    const core = formatShopAmountLabel(placement);
    return spendLabel ? `${spendLabel} · ${core}` : core;
  }
  if (placement.shopLocation?.trim()) {
    const loc = placement.shopLocation.trim();
    return spendLabel ? `${spendLabel} · ${loc}` : loc;
  }
  if (spendLabel) return spendLabel;
  if (placement.laundryLoads != null) {
    const time = placement.planNote ? `${placement.planNote} · ` : "";
    return `${time}${placement.laundryLoads} tvättar`;
  }
  if (completionKind === "laundry" && placement.planNote?.trim()) {
    return placement.planNote.trim();
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
  /** Primary / first completion for this month (bills: the only row). */
  completion: MonthlyCompletion | null;
  /** All completions this month (repeatable tasks may have many). */
  completions: MonthlyCompletion[];
}

export const FEST_TASK_KEY = "life_fest";

export function isMonthlyTaskRepeatable(task: {
  isRepeatable?: boolean;
  key?: string | null;
}): boolean {
  if (typeof task.isRepeatable === "boolean") return task.isRepeatable;
  return task.key === FEST_TASK_KEY;
}

export function monthlyTaskCompletions(
  task: Pick<MonthlyTaskForMonth, "completion" | "completions">,
): MonthlyCompletion[] {
  if (task.completions && task.completions.length > 0) return task.completions;
  return task.completion ? [task.completion] : [];
}

/** One row per day placement for repeatable monthly tasks. */
export function expandMonthlyTaskOccurrences(
  tasks: MonthlyTaskForMonth[],
): MonthlyTaskForMonth[] {
  const out: MonthlyTaskForMonth[] = [];
  for (const task of tasks) {
    if (!isMonthlyTaskRepeatable(task)) {
      out.push({
        ...task,
        completions: monthlyTaskCompletions(task),
      });
      continue;
    }
    const instances = monthlyTaskCompletions(task).filter(
      (c) =>
        c.isInstance ||
        (!c.isUnscheduled &&
          (c.scheduledDayOfMonth != null || c.doneAt != null)),
    );
    for (const completion of instances) {
      out.push({
        ...task,
        completion,
        completions: [completion],
      });
    }
  }
  return out;
}

export function parseFestOccasion(raw: string):
  | { ok: true; occasion: string }
  | { ok: false; error: string } {
  const occasion = raw.trim();
  if (!occasion) return { ok: false, error: "Skriv vilken slags fest det är." };
  if (occasion.length > 80) {
    return { ok: false, error: "Håll festnamnet under 80 tecken." };
  }
  return { ok: true, occasion };
}

export function formatFestOccasionWhen(
  completion: Pick<
    MonthlyCompletion,
    "occasion" | "scheduledDayOfMonth" | "doneAt"
  >,
  monthStart: string,
): string {
  const when =
    completion.scheduledDayOfMonth != null
      ? formatMonthDayLong(monthStart, completion.scheduledDayOfMonth)
      : completion.doneAt
        ? formatMonthDayLong(
            `${completion.doneAt.slice(0, 7)}-01`,
            Number(completion.doneAt.slice(8, 10)),
          )
        : null;
  const name = completion.occasion?.trim() || null;
  if (name && when) return `${name} · ${when}`;
  if (name) return `${name} · inte placerad på en dag`;
  if (when) return when;
  return "Fest · inte placerad på en dag";
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

export function monthlyTaskInstanceKey(task: MonthlyTaskForMonth): string {
  return task.completion?.id ?? task.id;
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
