// Client-safe week progress layout types and merge helpers.

import { WEEK_PROGRESS_HABIT_KEYS } from "@/lib/habits";

export const WEEK_PROGRESS_SECTION_KEYS = [
  "daily",
  "training",
  "tasks",
  "journal",
] as const;

export type WeekProgressSectionKey =
  (typeof WEEK_PROGRESS_SECTION_KEYS)[number];

export const WEEK_PROGRESS_TRAINING_KEYS = [
  "gym",
  "cardio",
  "sport",
  "bathing",
] as const;

export type WeekProgressTrainingKey =
  (typeof WEEK_PROGRESS_TRAINING_KEYS)[number];

export type WeekProgressDailyRowKey = "water" | `habit:${string}`;

export interface WeekProgressLayout {
  sections: WeekProgressSectionKey[];
  dailyRows: WeekProgressDailyRowKey[];
  trainingRows: WeekProgressTrainingKey[];
}

export const WEEK_PROGRESS_SECTION_LABEL: Record<
  WeekProgressSectionKey,
  string
> = {
  daily: "Dagligt",
  training: "Träning & hälsa",
  tasks: "Uppgifter",
  journal: "Dagbok",
};

export const WEEK_PROGRESS_TRAINING_META: Record<
  WeekProgressTrainingKey,
  { icon: string; label: string }
> = {
  gym: { icon: "🏋️", label: "Gym" },
  cardio: { icon: "🏃", label: "Cardio" },
  sport: { icon: "⚽", label: "Sport" },
  bathing: { icon: "🧖", label: "Bad & bastu" },
};

export const DEFAULT_WEEK_PROGRESS_LAYOUT: WeekProgressLayout = {
  sections: [...WEEK_PROGRESS_SECTION_KEYS],
  dailyRows: [
    "water",
    ...WEEK_PROGRESS_HABIT_KEYS.map((key) => `habit:${key}` as const),
  ],
  trainingRows: [...WEEK_PROGRESS_TRAINING_KEYS],
};

export function habitDailyRowKey(habitKey: string): WeekProgressDailyRowKey {
  return `habit:${habitKey}`;
}

export function parseDailyRowKey(
  key: WeekProgressDailyRowKey,
): { type: "water" } | { type: "habit"; habitKey: string } {
  if (key === "water") return { type: "water" };
  return { type: "habit", habitKey: key.slice(6) };
}

function mergeKeyOrder<T extends string>(
  saved: T[],
  defaults: readonly T[],
  allowed: readonly T[],
): T[] {
  const allowedSet = new Set(allowed);
  const result: T[] = [];
  const seen = new Set<T>();

  for (const key of saved) {
    if (allowedSet.has(key) && !seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }
  for (const key of defaults) {
    if (allowedSet.has(key) && !seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }
  for (const key of allowed) {
    if (!seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }
  return result;
}

/** Merge saved layout with defaults and currently available rows. */
export function mergeWeekProgressLayout(
  saved: WeekProgressLayout | null | undefined,
  availableHabitKeys: string[],
): WeekProgressLayout {
  const defaults = DEFAULT_WEEK_PROGRESS_LAYOUT;
  const allowedDaily: WeekProgressDailyRowKey[] = [
    "water",
    ...availableHabitKeys.map(habitDailyRowKey),
  ];

  return {
    sections: mergeKeyOrder(
      saved?.sections ?? [],
      defaults.sections,
      WEEK_PROGRESS_SECTION_KEYS,
    ),
    dailyRows: mergeKeyOrder(
      saved?.dailyRows ?? [],
      defaults.dailyRows.filter((k) => allowedDaily.includes(k)),
      allowedDaily,
    ),
    trainingRows: mergeKeyOrder(
      saved?.trainingRows ?? [],
      defaults.trainingRows,
      WEEK_PROGRESS_TRAINING_KEYS,
    ),
  };
}

function isSectionKey(value: string): value is WeekProgressSectionKey {
  return (WEEK_PROGRESS_SECTION_KEYS as readonly string[]).includes(value);
}

function isTrainingKey(value: string): value is WeekProgressTrainingKey {
  return (WEEK_PROGRESS_TRAINING_KEYS as readonly string[]).includes(value);
}

function isDailyRowKey(value: string): value is WeekProgressDailyRowKey {
  return value === "water" || value.startsWith("habit:");
}

/** Validate and normalize layout from JSON before saving. */
export function sanitizeWeekProgressLayout(
  raw: unknown,
  availableHabitKeys: string[],
): WeekProgressLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const sections = Array.isArray(obj.sections)
    ? obj.sections.filter(
        (v): v is WeekProgressSectionKey =>
          typeof v === "string" && isSectionKey(v),
      )
    : [];

  const dailyRows = Array.isArray(obj.dailyRows)
    ? obj.dailyRows.filter(
        (v): v is WeekProgressDailyRowKey =>
          typeof v === "string" && isDailyRowKey(v),
      )
    : [];

  const trainingRows = Array.isArray(obj.trainingRows)
    ? obj.trainingRows.filter(
        (v): v is WeekProgressTrainingKey =>
          typeof v === "string" && isTrainingKey(v),
      )
    : [];

  return mergeWeekProgressLayout(
    { sections, dailyRows, trainingRows },
    availableHabitKeys,
  );
}
