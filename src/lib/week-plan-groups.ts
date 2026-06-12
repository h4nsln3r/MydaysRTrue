import type { TaskCategory } from "@/lib/tasks";
import type { WeekPlanItem, WeekPlanItemKind } from "@/lib/week-plan";

export const TRAINING_KINDS = new Set<WeekPlanItemKind>([
  "gym",
  "cardio",
  "bathing",
]);

export interface WeekPlanItemGroup {
  id: string;
  label: string;
  items: WeekPlanItem[];
}

function categoryIdByName(
  categories: TaskCategory[],
  name: string,
): string | undefined {
  return categories.find((c) => c.name === name)?.id;
}

/** Groups placed day items: training, HOME, DEV, other tasks, weight. */
export function groupWeekPlanDayItems(
  items: WeekPlanItem[],
  categories: TaskCategory[],
): WeekPlanItemGroup[] {
  const homeId = categoryIdByName(categories, "HOME");
  const devId = categoryIdByName(categories, "DEV");

  const training = items.filter(
    (i) =>
      TRAINING_KINDS.has(i.kind) &&
      !(i.kind === "bathing" && i.bathingRole === "source"),
  );
  const home = items.filter(
    (i) => i.kind === "task" && i.categoryId === homeId,
  );
  const dev = items.filter((i) => i.kind === "task" && i.categoryId === devId);
  const otherTasks = items.filter(
    (i) =>
      i.kind === "task" &&
      i.categoryId !== homeId &&
      i.categoryId !== devId,
  );
  const weight = items.filter((i) => i.kind === "weight");

  const groups: WeekPlanItemGroup[] = [];
  if (training.length > 0) {
    groups.push({ id: "training", label: "Träning & bad", items: training });
  }
  if (home.length > 0) groups.push({ id: "home", label: "HOME", items: home });
  if (dev.length > 0) groups.push({ id: "dev", label: "DEV", items: dev });
  if (otherTasks.length > 0) {
    groups.push({ id: "other", label: "Övrigt", items: otherTasks });
  }
  if (weight.length > 0) {
    groups.push({ id: "weight", label: "Vikt", items: weight });
  }
  return groups;
}

function isBacklogTrainingItem(item: WeekPlanItem): boolean {
  if (item.kind === "bathing") return item.bathingRole === "source";
  return TRAINING_KINDS.has(item.kind);
}

/** Groups everything in the left backlog: training, weight, HOME, DEV, other. */
export function groupWeekPlanBacklogItems(
  items: WeekPlanItem[],
  categories: TaskCategory[],
): WeekPlanItemGroup[] {
  const homeId = categoryIdByName(categories, "HOME");
  const devId = categoryIdByName(categories, "DEV");

  const training = items.filter((i) => isBacklogTrainingItem(i));
  const weight = items.filter((i) => i.kind === "weight");
  const home = items.filter(
    (i) => i.kind === "task" && i.categoryId === homeId,
  );
  const dev = items.filter((i) => i.kind === "task" && i.categoryId === devId);
  const otherTasks = items.filter(
    (i) =>
      i.kind === "task" &&
      i.categoryId !== homeId &&
      i.categoryId !== devId,
  );

  const groups: WeekPlanItemGroup[] = [];
  if (training.length > 0) {
    groups.push({ id: "training", label: "Träning & bad", items: training });
  }
  if (weight.length > 0) {
    groups.push({ id: "weight", label: "Vikt", items: weight });
  }
  if (home.length > 0) groups.push({ id: "home", label: "HOME", items: home });
  if (dev.length > 0) groups.push({ id: "dev", label: "DEV", items: dev });
  if (otherTasks.length > 0) {
    groups.push({ id: "other", label: "Övrigt", items: otherTasks });
  }
  return groups;
}
