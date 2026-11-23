// Weekly backfill + improvement review for the week progress view.
// Pure functions — the page hands in data it already loaded.

import {
  addDaysISO,
  formatDayShort,
  formatWeekdayShort,
} from "@/lib/date";
import type { Habit, HabitStatus, WeekHabitDayDetails } from "@/lib/habits";
import { habitStatusPoints } from "@/lib/habits";
import type { MonthlyTaskForMonth, WeeklyTaskForWeek } from "@/lib/tasks";
import type { GymSessionForWeek } from "@/lib/gym";
import { cardioSessionDisplay, type CardioSessionForWeek } from "@/lib/cardio";
import type { SportSessionForWeek } from "@/lib/sport";
import type { BathingSessionForWeek } from "@/lib/bathing";
import type { WeightWeekPlan } from "@/lib/weight";
import type { MoodKey } from "@/lib/mood";
import {
  isMonthlyTaskComplete,
  monthlyTasksOnLocalDate,
} from "@/lib/monthly-bills";

/** Minimal day shape — matches WeekHabitDay without importing server-only. */
export interface WeekReviewHabitDay {
  date: string;
  isFuture: boolean;
  isToday: boolean;
  weekday: number;
  statuses: Record<string, HabitStatus | null>;
  hiddenHabitIds: string[];
  hideWater: boolean;
  mood: MoodKey | null;
  details: WeekHabitDayDetails;
}

export interface WeekReviewHabitWeek {
  weekStart: string;
  weekEnd: string;
  habits: Habit[];
  days: WeekReviewHabitDay[];
}

export interface WeekReviewWaterDay {
  date: string;
  goalMl: number;
  totalMl: number;
  goalMet: boolean;
  isFuture: boolean;
}

export interface WeekReviewWaterWeek {
  days: WeekReviewWaterDay[];
}

export type WeekReviewGapSeverity = "empty" | "thin";

export interface WeekReviewGapDay {
  date: string;
  /** e.g. "Tis 18 nov" */
  label: string;
  severity: WeekReviewGapSeverity;
  /** Trackers still empty, e.g. "Humör", "Vatten". */
  missing: string[];
  /** Planned items not marked done. */
  openPlan: string[];
  /** 0–100 how much of expected daily tracking is filled. */
  fillPct: number;
}

export interface WeekReviewSlip {
  id: string;
  label: string;
  detail: string;
}

export interface WeekReviewTip {
  id: string;
  text: string;
}

export interface WeekReviewModel {
  title: string;
  kicker: string;
  lead: string | null;
  gapDays: WeekReviewGapDay[];
  slips: WeekReviewSlip[];
  tips: WeekReviewTip[];
}

interface TrackerProbe {
  label: string;
  /** True when the user has logged something for this tracker. */
  filled: boolean;
  /** True when logged and counts as done (yes/half toward goal). */
  hit: boolean;
}

function joinAnd(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} och ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} och ${clean[clean.length - 1]}`;
}

function dayLabel(date: string): string {
  const weekday = formatWeekdayShort(date);
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} ${formatDayShort(date)}`;
}

function isHidden(day: WeekReviewHabitDay, habitId: string): boolean {
  return day.hiddenHabitIds.includes(habitId);
}

function statusHit(status: HabitStatus | null | undefined): boolean {
  return habitStatusPoints(status) > 0;
}

function probesForDay(
  day: WeekReviewHabitDay,
  habits: Habit[],
  waterDay: WeekReviewWaterDay | undefined,
): TrackerProbe[] {
  const probes: TrackerProbe[] = [];
  const details: WeekHabitDayDetails = day.details;
  const hidden = new Set(day.hiddenHabitIds);

  if (!day.hideWater) {
    const ml = details.water?.totalMl ?? waterDay?.totalMl ?? 0;
    const goal = details.water?.goalMl ?? waterDay?.goalMl ?? 0;
    probes.push({
      label: "Vatten",
      filled: ml > 0,
      hit: goal > 0 ? ml >= goal : ml > 0,
    });
  }

  for (const habit of habits) {
    if (hidden.has(habit.id)) continue;
    const status = day.statuses[habit.id] ?? null;

    if (habit.kind === "mood" || habit.key === "mood") {
      probes.push({
        label: habit.label || "Humör",
        filled: day.mood != null,
        hit: day.mood != null,
      });
      continue;
    }

    if (habit.kind === "steps" || habit.key === "steps") {
      const value = details.steps?.value ?? 0;
      const goal = details.steps?.goal ?? 0;
      probes.push({
        label: habit.label || "Steg",
        filled: value > 0,
        hit: goal > 0 ? value >= goal : value > 0,
      });
      continue;
    }

    if (habit.kind === "activity_hours" || habit.key === "activity_hours") {
      const value = details.activity?.value ?? 0;
      const goal = details.activity?.goal ?? 0;
      probes.push({
        label: habit.label || "Aktivitet",
        filled: value > 0,
        hit: goal > 0 ? value >= goal * 0.5 : value > 0,
      });
      continue;
    }

    if (habit.kind === "meal" || habit.key === "meals") {
      probes.push({
        label: habit.label || "Måltider",
        filled: status != null,
        hit: statusHit(status),
      });
      continue;
    }

    if (habit.kind === "snack") {
      probes.push({
        label: habit.label || "Mellanmål",
        filled: status != null,
        hit: statusHit(status),
      });
      continue;
    }

    if (habit.kind === "smoke_free" || habit.key === "smoke_free") {
      const smoke = details.smokeFree;
      const filled =
        smoke != null && (smoke.nicotine != null || smoke.cannabis != null);
      probes.push({
        label: habit.label || "Rökfri",
        filled,
        hit: statusHit(status),
      });
      continue;
    }

    if (habit.kind === "mobile_games" || habit.key === "mobile_games") {
      probes.push({
        label: habit.label || "Mobilspel",
        filled: details.mobileGames != null,
        hit: statusHit(status),
      });
      continue;
    }

    if (habit.kind === "intake" || habit.key === "intake") {
      const intake = details.intake ?? {};
      const filled = Object.values(intake).some(Boolean);
      probes.push({
        label: habit.label || "Intag",
        filled,
        hit: statusHit(status),
      });
      continue;
    }

    // Tri-state / media / live: past days coerce null → "no".
    probes.push({
      label: habit.label,
      filled: status === "yes" || status === "half",
      hit: statusHit(status),
    });
  }

  return probes;
}

function openPlanForDay(input: {
  date: string;
  weekday: number;
  gym: GymSessionForWeek[];
  cardio: CardioSessionForWeek[];
  sport: SportSessionForWeek[];
  bathing: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  monthlyTasks: MonthlyTaskForMonth[];
  weightPlan: WeightWeekPlan | null;
}): string[] {
  const open: string[] = [];

  for (const session of input.gym) {
    if (session.placement.weekday !== input.weekday) continue;
    if (session.placement.doneAt) continue;
    open.push(session.label?.trim() || "Gym");
  }
  for (const session of input.cardio) {
    if (session.placement.weekday !== input.weekday) continue;
    if (session.placement.doneAt) continue;
    open.push(cardioSessionDisplay(session).label);
  }
  for (const session of input.sport) {
    if (session.placement.weekday !== input.weekday) continue;
    if (session.placement.doneAt) continue;
    open.push(
      session.placement.actualSport?.trim() ||
        session.placement.planSport?.trim() ||
        session.label?.trim() ||
        "Sport",
    );
  }
  for (const session of input.bathing) {
    if (session.placement.weekday !== input.weekday) continue;
    if (session.placement.doneAt) continue;
    open.push(session.label?.trim() || "Bad");
  }
  for (const task of input.tasks) {
    if (task.placement?.weekday !== input.weekday) continue;
    if (task.placement?.doneAt) continue;
    const title = task.title?.trim();
    if (title) open.push(title);
  }
  for (const task of monthlyTasksOnLocalDate(input.monthlyTasks, input.date)) {
    if (isMonthlyTaskComplete(task, task.completion)) continue;
    const title = task.title?.trim();
    if (title) open.push(title);
  }
  if (
    input.weightPlan?.enabled &&
    input.weightPlan.weekday === input.weekday &&
    input.weightPlan.log?.localDate !== input.date
  ) {
    open.push("Vikt");
  }

  return open;
}

function classifyGap(
  day: WeekReviewHabitDay,
  probes: TrackerProbe[],
  openPlan: string[],
): WeekReviewGapDay | null {
  const expected = probes.length;
  if (expected === 0 && openPlan.length === 0) return null;

  const filledCount = probes.filter((p) => p.filled).length;
  const fillPct =
    expected > 0 ? Math.round((filledCount / expected) * 100) : 100;
  const missing = probes.filter((p) => !p.filled).map((p) => p.label);

  // Tri-state habits coerce null → "no", so focus gaps on trackers where we
  // can tell "never logged" from details (mood, water, steps, …).
  let effectiveMissing = missing;
  let effectiveFillPct = fillPct;
  if (filledCount >= Math.ceil(expected * 0.45)) {
    const isHardGap = (label: string) => {
      const lower = label.toLowerCase();
      return (
        lower.includes("humör") ||
        lower.includes("vatten") ||
        lower.includes("steg") ||
        lower.includes("måltid") ||
        lower.includes("rök") ||
        lower.includes("mobil") ||
        lower.includes("intag") ||
        lower.includes("aktiv") ||
        lower.includes("mellanmål")
      );
    };
    effectiveMissing = missing.filter(isHardGap);
    const hardExpected = probes.filter((p) => isHardGap(p.label));
    const hardFilled = hardExpected.filter((p) => p.filled).length;
    effectiveFillPct =
      hardExpected.length > 0
        ? Math.round((hardFilled / hardExpected.length) * 100)
        : fillPct;
  }

  const needsFill =
    effectiveFillPct < 70 ||
    effectiveMissing.length >= 2 ||
    (effectiveMissing.length >= 1 && openPlan.length > 0);

  if (!needsFill && openPlan.length === 0) return null;
  if (effectiveMissing.length === 0 && openPlan.length === 0) return null;

  const severity: WeekReviewGapSeverity =
    effectiveFillPct <= 25 || effectiveMissing.length >= 4 ? "empty" : "thin";

  return {
    date: day.date,
    label: dayLabel(day.date),
    severity,
    missing: effectiveMissing.slice(0, 6),
    openPlan: openPlan.slice(0, 5),
    fillPct: effectiveFillPct,
  };
}

function buildSlips(input: {
  habitWeek: WeekReviewHabitWeek;
  water: WeekReviewWaterWeek;
  gym: GymSessionForWeek[];
  cardio: CardioSessionForWeek[];
  sport: SportSessionForWeek[];
  bathing: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  today: string;
}): WeekReviewSlip[] {
  const slips: WeekReviewSlip[] = [];
  const pastDays = input.habitWeek.days.filter((d) => d.date < input.today);
  if (pastDays.length === 0) return slips;

  for (const habit of input.habitWeek.habits) {
    let due = 0;
    let hit = 0;
    let missed = 0;
    for (const day of pastDays) {
      if (isHidden(day, habit.id)) continue;
      // Skip days where the habit does not apply (null and not coerced — meals)
      const status = day.statuses[habit.id];
      if (habit.kind === "meal" || habit.kind === "snack") {
        if (status == null) continue;
      }
      if (habit.kind === "mood" && day.mood == null) continue;
      if (
        (habit.kind === "steps" || habit.key === "steps") &&
        (day.details.steps?.value ?? 0) <= 0
      ) {
        continue;
      }
      if (
        (habit.kind === "activity_hours" || habit.key === "activity_hours") &&
        (day.details.activity?.value ?? 0) <= 0
      ) {
        continue;
      }
      if (
        (habit.kind === "smoke_free" || habit.key === "smoke_free") &&
        !day.details.smokeFree
      ) {
        continue;
      }

      due += 1;
      if (statusHit(status)) hit += 1;
      else missed += 1;
    }
    if (due < 3 || missed === 0) continue;
    const rate = hit / due;
    if (rate >= 0.7) continue;
    slips.push({
      id: `habit-${habit.id}`,
      label: habit.label,
      detail: `${hit} av ${due} loggade dagar`,
    });
  }

  const waterPast = input.water.days.filter(
    (d) => d.date < input.today && d.totalMl > 0,
  );
  if (waterPast.length >= 3) {
    const hits = waterPast.filter((d) => d.goalMet).length;
    if (hits / waterPast.length < 0.7) {
      slips.push({
        id: "water-goal",
        label: "Vattenmål",
        detail: `${hits} av ${waterPast.length} dagar med logg`,
      });
    }
  }

  const placementDate = (weekday: number | null | undefined): string | null => {
    if (weekday == null) return null;
    return addDaysISO(input.habitWeek.weekStart, weekday - 1);
  };
  const isPastPlacement = (weekday: number | null | undefined) => {
    const date = placementDate(weekday);
    return date != null && date < input.today;
  };

  const plannedSessions = [
    ...input.gym.map((s) => ({
      done: Boolean(s.placement.doneAt),
      weekday: s.placement.weekday,
    })),
    ...input.cardio.map((s) => ({
      done: Boolean(s.placement.doneAt),
      weekday: s.placement.weekday,
    })),
    ...input.sport.map((s) => ({
      done: Boolean(s.placement.doneAt),
      weekday: s.placement.weekday,
    })),
    ...input.bathing.map((s) => ({
      done: Boolean(s.placement.doneAt),
      weekday: s.placement.weekday,
    })),
  ].filter((s) => isPastPlacement(s.weekday));
  if (plannedSessions.length >= 2) {
    const done = plannedSessions.filter((s) => s.done).length;
    if (done < plannedSessions.length) {
      slips.push({
        id: "training",
        label: "Planerad träning",
        detail: `${done} av ${plannedSessions.length} pass markerade`,
      });
    }
  }

  const placedTasks = input.tasks.filter((t) =>
    isPastPlacement(t.placement?.weekday),
  );
  if (placedTasks.length >= 2) {
    const done = placedTasks.filter((t) => t.placement?.doneAt).length;
    if (done < placedTasks.length) {
      slips.push({
        id: "tasks",
        label: "Veckotasks",
        detail: `${done} av ${placedTasks.length} klara`,
      });
    }
  }

  return slips.slice(0, 5);
}

function buildTips(
  gapDays: WeekReviewGapDay[],
  slips: WeekReviewSlip[],
): WeekReviewTip[] {
  const tips: WeekReviewTip[] = [];

  if (gapDays.length >= 2) {
    tips.push({
      id: "backfill",
      text: `Gå igenom ${joinAnd(gapDays.map((d) => d.label.toLowerCase()))} och fyll i det som saknas — det tar ofta bara någon minut per dag.`,
    });
  } else if (gapDays.length === 1) {
    tips.push({
      id: "backfill-one",
      text: `${gapDays[0].label} ser tunn ut. Öppna dagen och komplettera det som saknas.`,
    });
  }

  const emptyish = gapDays.filter((d) => d.severity === "empty");
  if (emptyish.length >= 1) {
    const weekdays = emptyish.map((d) => formatWeekdayShort(d.date));
    const unique = [...new Set(weekdays)];
    if (unique.length === 1) {
      tips.push({
        id: "weekday-pattern",
        text: `${unique[0].charAt(0).toUpperCase()}${unique[0].slice(1)} brukar bli eftersatt — lägg en påminnelse eller fyll i samma kväll.`,
      });
    }
  }

  const weakest = slips[0];
  if (weakest) {
    tips.push({
      id: `focus-${weakest.id}`,
      text: `Nästa vecka: sikta på ${weakest.label.toLowerCase()} först (${weakest.detail}).`,
    });
  }

  const moodGaps = gapDays.filter((d) =>
    d.missing.some((m) => m.toLowerCase().includes("humör")),
  );
  if (moodGaps.length >= 2) {
    tips.push({
      id: "mood",
      text: "Humöret saknas flera dagar — det är ofta det snabbaste att fylla i i efterhand.",
    });
  }

  const seen = new Set<string>();
  return tips.filter((tip) => {
    if (seen.has(tip.id)) return false;
    seen.add(tip.id);
    return true;
  }).slice(0, 4);
}

export function buildWeekReview(input: {
  habitWeek: WeekReviewHabitWeek;
  water: WeekReviewWaterWeek;
  gym: GymSessionForWeek[];
  cardio: CardioSessionForWeek[];
  sport: SportSessionForWeek[];
  bathing: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  monthlyTasks?: MonthlyTaskForMonth[];
  weightPlan?: WeightWeekPlan | null;
  today: string;
}): WeekReviewModel | null {
  const {
    habitWeek,
    water,
    gym,
    cardio,
    sport,
    bathing,
    tasks,
    today,
  } = input;
  const monthlyTasks = input.monthlyTasks ?? [];
  const weightPlan = input.weightPlan ?? null;
  const waterByDate = new Map(water.days.map((d) => [d.date, d]));

  const gapDays: WeekReviewGapDay[] = [];
  for (const day of habitWeek.days) {
    // Only days that have already passed — never today or future.
    if (day.date >= today) continue;
    const probes = probesForDay(day, habitWeek.habits, waterByDate.get(day.date));
    const openPlan = openPlanForDay({
      date: day.date,
      weekday: day.weekday,
      gym,
      cardio,
      sport,
      bathing,
      tasks,
      monthlyTasks,
      weightPlan,
    });
    const gap = classifyGap(day, probes, openPlan);
    if (gap) gapDays.push(gap);
  }

  const slips = buildSlips({
    habitWeek,
    water,
    gym,
    cardio,
    sport,
    bathing,
    tasks,
    today,
  });
  const tips = buildTips(gapDays, slips);

  if (gapDays.length === 0 && slips.length === 0 && tips.length === 0) {
    return null;
  }

  const weekOpen = habitWeek.weekEnd >= today && habitWeek.weekStart <= today;

  let lead: string | null = null;
  if (gapDays.length > 0) {
    lead = `${gapDays.length} ${
      gapDays.length === 1 ? "dag ser" : "dagar ser"
    } ofullständig ${gapDays.length === 1 ? "ut" : "ut"} — öppna och fyll i.`;
  } else if (slips.length > 0) {
    lead = `Svagast den här veckan: ${slips[0].label.toLowerCase()}.`;
  }

  return {
    title: "Veckocheck",
    kicker: weekOpen ? "fyll i · förbättra" : "vad som saknades",
    lead,
    gapDays,
    slips,
    tips,
  };
}
