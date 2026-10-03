// Choices behind the day-plan plus button. Only repeatable week-plan
// standards: training variants, bad, shake, and HOME / DEV / MUSIC / SPEL / Livet.

import { RING_PERSONS, RING_TASK_KEY, type RingPerson } from "@/lib/calls";
import { CARDIO_KINDS, type CardioKind } from "@/lib/cardio";
import type { UserGame } from "@/lib/games";
import type { UserSport } from "@/lib/sports";
import {
  MUSIC_ACTIVITIES,
  MUSIC_ACTIVITY_ICON,
  MUSIC_ACTIVITY_LABEL,
  SPEND_KIND_ICON,
  SPEND_KIND_LABEL,
  allowedSpendKinds,
  isGameWeeklyTaskKey,
  isMusicWeeklyTaskKey,
  isRingWeeklyTaskKey,
  musicActivityNeedsBand,
  type MusicActivity,
  type SpendKind,
  type TaskCategory,
  type WeeklyTask,
  type WeeklyTaskCompletionKind,
} from "@/lib/tasks";

export interface DayQuickAddTask {
  id: string;
  key: string | null;
  title: string;
  icon: string;
  categoryId: string | null;
  completionKind: WeeklyTaskCompletionKind;
  sortOrder: number;
  enabled: boolean;
  isRepeatable: boolean;
  singleWeekStart: string | null;
}

export interface DayQuickAddTemplate {
  id: string;
  label: string;
  icon: string;
}

export interface DayQuickAddSources {
  gym: DayQuickAddTemplate[];
  cardioTemplateId: string | null;
  sportTemplateId: string | null;
  baths: DayQuickAddTemplate[];
  shake: { habitId: string; label: string; icon: string } | null;
}

export type DayQuickAddPayload =
  | { kind: "gym"; templateId: string }
  | { kind: "cardio"; templateId: string; planKind: CardioKind }
  | { kind: "sport"; templateId: string; sportId: string }
  | { kind: "bathing"; templateId: string }
  | { kind: "shake"; habitId: string }
  | {
      kind: "task";
      taskId: string;
      musicActivity?: MusicActivity | null;
      band?: string | null;
      spendKind?: SpendKind | null;
      gameId?: string | null;
      callPerson?: RingPerson | null;
      callOtherName?: string | null;
    };

export type DayQuickAddStep =
  | { type: "oneOff" }
  | { type: "commit"; payload: DayQuickAddPayload }
  | { type: "band"; taskId: string; activity: MusicActivity }
  | { type: "callOther"; taskId: string }
  | {
      type: "menu";
      title: string;
      items: DayQuickAddItem[];
      emptyHint?: string;
    };

export interface DayQuickAddItem {
  id: string;
  label: string;
  icon: string;
  step: DayQuickAddStep;
}

const CATEGORY_ORDER = ["HOME", "DEV", "MUSIC", "SPEL", "Livet"] as const;

/** Repeatable standards only. Legacy numbered slots stay out once a canonical row exists. */
export function isQuickAddWeeklyTask(task: {
  enabled: boolean;
  isRepeatable: boolean;
  singleWeekStart: string | null;
  key: string | null;
}): boolean {
  if (!task.enabled || !task.isRepeatable || task.singleWeekStart) return false;
  if (isMusicWeeklyTaskKey(task.key) && task.key !== "music") return false;
  if (isRingWeeklyTaskKey(task.key) && task.key !== RING_TASK_KEY) return false;
  if (isGameWeeklyTaskKey(task.key) && task.key !== "game") return false;
  return true;
}

function categoryIcon(
  categories: TaskCategory[],
  name: string,
  fallback: string,
): string {
  return categories.find((c) => c.name === name)?.icon || fallback;
}

function tasksInCategory(
  tasks: DayQuickAddTask[],
  categories: TaskCategory[],
  name: string,
): DayQuickAddTask[] {
  const id = categories.find((c) => c.name === name)?.id;
  if (!id) return [];
  return tasks
    .filter((t) => t.categoryId === id && isQuickAddWeeklyTask(t))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function taskStep(task: DayQuickAddTask, games: UserGame[]): DayQuickAddStep {
  if (task.completionKind === "music" || isMusicWeeklyTaskKey(task.key)) {
    return {
      type: "menu",
      title: task.title,
      items: MUSIC_ACTIVITIES.map((activity) => ({
        id: `${task.id}:${activity}`,
        label: MUSIC_ACTIVITY_LABEL[activity],
        icon: MUSIC_ACTIVITY_ICON[activity],
        step: musicActivityNeedsBand(activity)
          ? { type: "band", taskId: task.id, activity }
          : {
              type: "commit",
              payload: { kind: "task", taskId: task.id, musicActivity: activity },
            },
      })),
    };
  }

  if (task.completionKind === "shop" || task.completionKind === "expense") {
    return {
      type: "menu",
      title: task.title,
      items: allowedSpendKinds(task.completionKind).map((spendKind) => ({
        id: `${task.id}:${spendKind}`,
        label: SPEND_KIND_LABEL[spendKind],
        icon: SPEND_KIND_ICON[spendKind],
        step: {
          type: "commit",
          payload: { kind: "task", taskId: task.id, spendKind },
        },
      })),
    };
  }

  if (isGameWeeklyTaskKey(task.key)) {
    return {
      type: "menu",
      title: task.title,
      emptyHint: "Inga spel att välja. Lägg till spel under Inställningar.",
      items: [...games]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((game) => ({
          id: `${task.id}:${game.id}`,
          label: game.title,
          icon: game.icon,
          step: {
            type: "commit",
            payload: { kind: "task", taskId: task.id, gameId: game.id },
          },
        })),
    };
  }

  if (isRingWeeklyTaskKey(task.key)) {
    return {
      type: "menu",
      title: task.title,
      items: RING_PERSONS.map((person) => ({
        id: `${task.id}:${person.key}`,
        label: person.label,
        icon: person.icon,
        step:
          person.key === "ovrigt"
            ? { type: "callOther", taskId: task.id }
            : {
                type: "commit",
                payload: {
                  kind: "task",
                  taskId: task.id,
                  callPerson: person.key,
                },
              },
      })),
    };
  }

  return {
    type: "commit",
    payload: { kind: "task", taskId: task.id },
  };
}

function categoryItem(
  name: (typeof CATEGORY_ORDER)[number],
  tasks: DayQuickAddTask[],
  categories: TaskCategory[],
  games: UserGame[],
): DayQuickAddItem | null {
  const rows = tasksInCategory(tasks, categories, name);
  if (rows.length === 0) return null;
  const icon = categoryIcon(
    categories,
    name,
    name === "HOME"
      ? "🏠"
      : name === "DEV"
        ? "💻"
        : name === "MUSIC"
          ? "🎵"
          : name === "SPEL"
            ? "🎲"
            : "💛",
  );
  const items = rows.map((task) => ({
    id: task.id,
    label: task.title,
    icon: task.icon,
    step: taskStep(task, games),
  }));

  if (items.length === 1) {
    const only = items[0];
    if (only.step.type === "menu") {
      return {
        id: name,
        label: name,
        icon,
        step: { ...only.step, title: name },
      };
    }
    return { id: name, label: name, icon, step: only.step };
  }

  return {
    id: name,
    label: name,
    icon,
    step: { type: "menu", title: name, items },
  };
}

export function toDayQuickAddTask(task: WeeklyTask): DayQuickAddTask {
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    icon: task.icon,
    categoryId: task.categoryId,
    completionKind: task.completionKind,
    sortOrder: task.sortOrder,
    enabled: task.enabled,
    isRepeatable: task.isRepeatable,
    singleWeekStart: task.singleWeekStart,
  };
}

export function buildDayQuickAddItems(input: {
  tasks: DayQuickAddTask[];
  categories: TaskCategory[];
  sources: DayQuickAddSources;
  games: UserGame[];
  sports: UserSport[];
}): DayQuickAddItem[] {
  const items: DayQuickAddItem[] = [
    {
      id: "one-off",
      label: "Engångsuppgift",
      icon: "✓",
      step: { type: "oneOff" },
    },
  ];

  const training: DayQuickAddItem[] = [];
  for (const gym of input.sources.gym) {
    training.push({
      id: `gym:${gym.id}`,
      label: gym.label,
      icon: gym.icon || "💪",
      step: { type: "commit", payload: { kind: "gym", templateId: gym.id } },
    });
  }
  if (input.sources.cardioTemplateId) {
    for (const kind of CARDIO_KINDS) {
      training.push({
        id: `cardio:${kind.key}`,
        label: kind.label,
        icon: kind.icon,
        step: {
          type: "commit",
          payload: {
            kind: "cardio",
            templateId: input.sources.cardioTemplateId,
            planKind: kind.key,
          },
        },
      });
    }
  }
  if (input.sources.sportTemplateId) {
    for (const sport of [...input.sports].sort((a, b) => a.sortOrder - b.sortOrder)) {
      training.push({
        id: `sport:${sport.id}`,
        label: sport.title,
        icon: sport.icon || "🏸",
        step: {
          type: "commit",
          payload: {
            kind: "sport",
            templateId: input.sources.sportTemplateId,
            sportId: sport.id,
          },
        },
      });
    }
  }
  if (training.length === 1) {
    items.push(training[0]);
  } else if (training.length > 1) {
    items.push({
      id: "training",
      label: "Träning",
      icon: "💪",
      step: { type: "menu", title: "Träning", items: training },
    });
  }

  for (const bath of input.sources.baths) {
    items.push({
      id: `bath:${bath.id}`,
      label: bath.label,
      icon: bath.icon || "🛁",
      step: {
        type: "commit",
        payload: { kind: "bathing", templateId: bath.id },
      },
    });
  }

  if (input.sources.shake) {
    items.push({
      id: `shake:${input.sources.shake.habitId}`,
      label: "Shake",
      icon: input.sources.shake.icon || "🥤",
      step: {
        type: "commit",
        payload: { kind: "shake", habitId: input.sources.shake.habitId },
      },
    });
  }

  for (const name of CATEGORY_ORDER) {
    const item = categoryItem(name, input.tasks, input.categories, input.games);
    if (item) items.push(item);
  }

  return items;
}
