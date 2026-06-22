import type { DayActivityKind } from "@/lib/day-activities";
import type { TaskCategory, WeeklyTaskForWeek } from "@/lib/tasks";

export interface ActivityCategoryDisplay {
  icon: string;
  label: string;
  accent: string;
}

const TRAINING_CATEGORY: Record<
  Exclude<DayActivityKind, "task">,
  ActivityCategoryDisplay
> = {
  gym: { icon: "🏋️", label: "Gym", accent: "#ff7a1a" },
  cardio: { icon: "🏃", label: "Cardio", accent: "#5fb6ff" },
  sport: { icon: "⚽", label: "Sport", accent: "#a78bfa" },
  bathing: { icon: "🧖", label: "Bad & bastu", accent: "#38bdf8" },
  weight: { icon: "⚖️", label: "Vikt", accent: "#c084fc" },
};

export function trainingCategory(
  kind: Exclude<DayActivityKind, "task">,
): ActivityCategoryDisplay {
  return TRAINING_CATEGORY[kind];
}

export function taskCategory(
  task: WeeklyTaskForWeek,
  categories: TaskCategory[],
): ActivityCategoryDisplay | null {
  if (!task.categoryId) return null;
  const category = categories.find((c) => c.id === task.categoryId);
  if (!category) return null;
  return {
    icon: category.icon,
    label: category.name,
    accent: category.accent,
  };
}
