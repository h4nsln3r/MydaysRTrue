import type { TaskCategory } from "@/lib/tasks";
import type { WeekPlanItem, WeekPlanItemKind } from "@/lib/week-plan";

export const TRAINING_KINDS = new Set<WeekPlanItemKind>([
  "gym",
  "cardio",
  "sport",
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

/** Groups placed day items excluding weekly tasks (those use their own sortable list). */
export function groupWeekPlanDayItems(
  items: WeekPlanItem[],
  categories: TaskCategory[],
): WeekPlanItemGroup[] {
  const billsId = categoryIdByName(categories, "Räkningar");
  const financeId = categoryIdByName(categories, "Ekonomi");
  const savingsId = categoryIdByName(categories, "Sparande");

  const training = items.filter(
    (i) =>
      TRAINING_KINDS.has(i.kind) &&
      !(i.kind === "bathing" && i.bathingRole === "source"),
  );
  const bills = items.filter(
    (i) =>
      (i.kind === "monthly_bill" && i.categoryId === billsId) ||
      (i.kind === "task" && i.categoryId === billsId),
  );
  const financeMonthly = items.filter(
    (i) => i.kind === "monthly_bill" && i.categoryId === financeId,
  );
  const savings = items.filter(
    (i) => i.kind === "monthly_bill" && i.categoryId === savingsId,
  );
  const monthlyOther = items.filter(
    (i) =>
      i.kind === "monthly_bill" &&
      i.categoryId !== billsId &&
      i.categoryId !== financeId &&
      i.categoryId !== savingsId,
  );
  const weight = items.filter((i) => i.kind === "weight");

  const groups: WeekPlanItemGroup[] = [];
  if (training.length > 0) {
    groups.push({ id: "training", label: "Träning & bad", items: training });
  }
  if (financeMonthly.length > 0) {
    groups.push({ id: "finance", label: "Ekonomi", items: financeMonthly });
  }
  if (savings.length > 0) {
    groups.push({ id: "savings", label: "Sparande", items: savings });
  }
  if (monthlyOther.length > 0) {
    groups.push({ id: "monthly", label: "Månadsuppgifter", items: monthlyOther });
  }
  if (bills.length > 0) {
    groups.push({ id: "bills", label: "Räkningar", items: bills });
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

/** Groups everything in the left backlog: training, weight, HOME, DEV, MUSIC, Livet, bills, other. */
export function groupWeekPlanBacklogItems(
  items: WeekPlanItem[],
  categories: TaskCategory[],
): WeekPlanItemGroup[] {
  const homeId = categoryIdByName(categories, "HOME");
  const devId = categoryIdByName(categories, "DEV");
  const musicId = categoryIdByName(categories, "MUSIC");
  const lifeId = categoryIdByName(categories, "Livet");
  const billsId = categoryIdByName(categories, "Räkningar");
  const financeId = categoryIdByName(categories, "Ekonomi");
  const savingsId = categoryIdByName(categories, "Sparande");

  const training = items.filter((i) => isBacklogTrainingItem(i));
  const weight = items.filter((i) => i.kind === "weight");
  const home = items.filter(
    (i) => i.kind === "task" && i.categoryId === homeId,
  );
  const dev = items.filter((i) => i.kind === "task" && i.categoryId === devId);
  const music = items.filter(
    (i) => i.kind === "task" && i.categoryId === musicId,
  );
  const life = items.filter(
    (i) => i.kind === "task" && i.categoryId === lifeId,
  );
  const bills = items.filter(
    (i) =>
      (i.kind === "monthly_bill" && i.categoryId === billsId) ||
      (i.kind === "task" && i.categoryId === billsId),
  );
  const financeMonthly = items.filter(
    (i) => i.kind === "monthly_bill" && i.categoryId === financeId,
  );
  const savings = items.filter(
    (i) => i.kind === "monthly_bill" && i.categoryId === savingsId,
  );
  const monthlyOther = items.filter(
    (i) =>
      i.kind === "monthly_bill" &&
      i.categoryId !== billsId &&
      i.categoryId !== financeId &&
      i.categoryId !== savingsId,
  );
  const otherTasks = items.filter(
    (i) =>
      i.kind === "task" &&
      i.categoryId !== homeId &&
      i.categoryId !== devId &&
      i.categoryId !== musicId &&
      i.categoryId !== lifeId &&
      i.categoryId !== billsId &&
      i.categoryId !== savingsId,
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
  if (music.length > 0) {
    groups.push({ id: "music", label: "MUSIC", items: music });
  }
  if (life.length > 0) {
    groups.push({ id: "life", label: "Livet", items: life });
  }
  if (financeMonthly.length > 0) {
    groups.push({ id: "finance", label: "Ekonomi", items: financeMonthly });
  }
  if (savings.length > 0) {
    groups.push({ id: "savings", label: "Sparande", items: savings });
  }
  if (monthlyOther.length > 0) {
    groups.push({ id: "monthly", label: "Månadsuppgifter", items: monthlyOther });
  }
  if (bills.length > 0) {
    groups.push({ id: "bills", label: "Räkningar", items: bills });
  }
  if (otherTasks.length > 0) {
    groups.push({ id: "other", label: "Övrigt", items: otherTasks });
  }
  return groups;
}
