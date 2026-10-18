// Period insights for week, month and year progress views.
// Pure functions — pages hand in data they already loaded.

import { cardioSessionDisplay, type CardioSessionForWeek } from "@/lib/cardio";
import {
  addDaysISO,
  formatDayLong,
  formatDayShort,
  isoWeekdayFromLocalISO,
  isoWeekNumber,
  localISOFromTimestamp,
  monthEndISO,
  parseLocalISO,
  placementLocalDate,
  weekStartISO,
} from "@/lib/date";
import type { HabitStatus, WeekHabitDayDetails } from "@/lib/habits";
import { UTGIFTER_CATEGORY_NAME } from "@/lib/expenses";
import { expandLeaveDates, leaveForDate, type LeavePeriod } from "@/lib/leave";
import {
  financeTotal,
  formatKr,
  isSavingsTransferTaskKey,
  SAVINGS_TRANSFER_TASKS,
  type MonthlyFinanceSnapshot,
} from "@/lib/monthly-finance";
import { MOOD_LABEL, type MoodKey } from "@/lib/mood";
import { monthlyTaskCompletions, type MonthlyTaskForMonth } from "@/lib/tasks";
import type { WorkDailyLog, WorkKind } from "@/lib/work";
import type { GymSessionForWeek } from "@/lib/gym";
import type { SportSessionForWeek } from "@/lib/sport";
import type { BathingSessionForWeek } from "@/lib/bathing";

export type InsightScope = "week" | "month" | "year";

export interface InsightSession {
  date: string;
  label: string;
  /** Gym and bath don't explain a high step count. Cardio and sport can. */
  kind: "gym" | "cardio" | "sport" | "bath";
}

export interface InsightMoment {
  date: string;
  /** Prose fragment, e.g. "konserten Kent". */
  label: string;
}

export interface InsightCompletion {
  date: string;
  title: string;
  subtitle: string;
}

export interface InsightRestaurant {
  name: string;
  visits: number;
}

export type InsightSpendKind = "expense" | "shopping" | "saving";

export interface InsightSpend {
  date: string;
  amountKr: number;
  label: string;
  kind: InsightSpendKind;
}

/** Saved net worth, compared with an earlier snapshot when one exists. */
export interface InsightWealth {
  totalKr: number;
  asOf: string;
  previousKr: number | null;
  previousAsOf: string | null;
}

export interface InsightDay {
  date: string;
  isFuture: boolean;
  steps: number;
  stepsGoal: number;
  activityHours: number;
  waterMl: number;
  waterGoalMl: number;
  mood: MoodKey | null;
  moodNote: string | null;
  sugarFree: HabitStatus | null;
  /** True when logged smoke-free parts are all yes. */
  smokeFree: boolean | null;
  pokemonGo: boolean;
  workKind: WorkKind | null;
  leaveKind: LeavePeriod["kind"] | null;
  leaveTitle: string | null;
}

export interface InsightSlice {
  scope: InsightScope;
  start: string;
  end: string;
  today: string;
  days: InsightDay[];
  sessions: InsightSession[];
  moments: InsightMoment[];
  completions: InsightCompletion[];
  leavePeriods: LeavePeriod[];
  topRestaurant?: InsightRestaurant | null;
  spends?: InsightSpend[];
  wealth?: InsightWealth | null;
}

export interface InsightStat {
  label: string;
  value: string;
  hint?: string;
}

export interface InsightRow {
  id: string;
  label: string;
  value: string;
  detail: string;
  /** Most steps in the comparison. */
  peak: boolean;
  /** Most training sessions in the comparison. */
  trainPeak: boolean;
}

export interface PeriodInsightModel {
  title: string;
  kicker: string;
  lead: string;
  why: string | null;
  stats: InsightStat[];
  rowsCaption: string | null;
  rows: InsightRow[];
  highlights: string[];
}

const TITLE: Record<InsightScope, string> = {
  week: "Veckans bild",
  month: "Månadens bild",
  year: "Årets bild",
};

const WEEKDAY_PLURAL = [
  "",
  "måndagar",
  "tisdagar",
  "onsdagar",
  "torsdagar",
  "fredagar",
  "lördagar",
  "söndagar",
];

interface Bucket {
  id: string;
  label: string;
  /** "vecka 42" or "juli" */
  name: string;
  /** "vecka 42" or "i juli" */
  inPhrase: string;
  start: string;
  end: string;
  days: InsightDay[];
  steps: number;
  sessions: number;
  spendKr: number;
}

function sv(n: number): string {
  return Math.round(n).toLocaleString("sv-SE");
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function joinAnd(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} och ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} och ${clean[clean.length - 1]}`;
}

function cap(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function asSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function sentences(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .map(asSentence)
    .join(" ");
}

function clipNote(note: string | null): string | null {
  if (!note) return null;
  const trimmed = note.trim().replace(/\s+/g, " ");
  if (trimmed.length < 4 || trimmed.length > 90) return null;
  return trimmed;
}

function trimTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= 42) return trimmed;
  return `${trimmed.slice(0, 41)}…`;
}

function clampEnd(end: string, today: string): string {
  return end < today ? end : today;
}

function monthName(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  return new Date(year, month - 1, 1).toLocaleDateString("sv-SE", {
    month: "long",
  });
}

function formatSpan(start: string, end: string): string {
  if (start === end) return formatDayShort(start);
  const a = parseLocalISO(start);
  const b = parseLocalISO(end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${formatDayShort(end)}`;
  }
  return `${formatDayShort(start)}–${formatDayShort(end)}`;
}

function pastDays(slice: InsightSlice): InsightDay[] {
  const last = clampEnd(slice.end, slice.today);
  return slice.days.filter(
    (day) => !day.isFuture && day.date >= slice.start && day.date <= last,
  );
}

function sumSteps(days: InsightDay[]): number {
  return days.reduce((sum, day) => sum + (day.steps > 0 ? day.steps : 0), 0);
}

function periodOpen(slice: InsightSlice): boolean {
  return slice.end > slice.today && slice.start <= slice.today;
}

function wherePhrase(slice: InsightSlice): string {
  if (slice.scope === "week") return "den här veckan";
  if (slice.scope === "month") return `i ${monthName(slice.start.slice(0, 7))}`;
  return `under ${slice.start.slice(0, 4)}`;
}

function smokeFreeFlag(details: WeekHabitDayDetails): boolean | null {
  const smoke = details.smokeFree;
  if (!smoke) return null;
  const parts = [smoke.nicotine, smoke.cannabis].filter(
    (value): value is HabitStatus => value != null,
  );
  if (parts.length === 0) return null;
  return parts.every((value) => value === "yes");
}

function emptyDay(date: string, isFuture: boolean): InsightDay {
  return {
    date,
    isFuture,
    steps: 0,
    stepsGoal: 0,
    activityHours: 0,
    waterMl: 0,
    waterGoalMl: 0,
    mood: null,
    moodNote: null,
    sugarFree: null,
    smokeFree: null,
    pokemonGo: false,
    workKind: null,
    leaveKind: null,
    leaveTitle: null,
  };
}

export function insightDaysFromHabits(input: {
  days: Array<{
    date: string;
    isFuture: boolean;
    mood: MoodKey | null;
    moodNote: string | null;
    details: WeekHabitDayDetails;
  }>;
  workByDate: ReadonlyMap<string, WorkDailyLog>;
  leavePeriods: LeavePeriod[];
  today: string;
}): InsightDay[] {
  return input.days.map((day) => {
    const period = leaveForDate(day.date, input.leavePeriods);
    const work = input.workByDate.get(day.date);
    const water = day.details.water;
    return {
      date: day.date,
      isFuture: day.isFuture || day.date > input.today,
      steps: day.details.steps?.value ?? 0,
      stepsGoal: day.details.steps?.goal ?? 0,
      activityHours: day.details.activity?.value ?? 0,
      waterMl: water?.totalMl ?? 0,
      waterGoalMl: water?.goalMl ?? 0,
      mood: day.mood,
      moodNote: day.moodNote,
      sugarFree: day.details.sugarFree ?? null,
      smokeFree: smokeFreeFlag(day.details),
      pokemonGo: day.details.mobileGames?.pokemonGo === true,
      workKind: work?.startedAt && work.kind ? work.kind : null,
      leaveKind: period?.kind ?? null,
      leaveTitle: period?.title?.trim() || null,
    };
  });
}

export function insightDaysFromMovement(
  movement: Array<{
    date: string;
    steps: number;
    activityHours: number;
    mood: MoodKey | null;
    moodNote: string | null;
    workKind: WorkKind | null;
  }>,
  leavePeriods: LeavePeriod[],
  today: string,
): InsightDay[] {
  return movement.map((day) => {
    const period = leaveForDate(day.date, leavePeriods);
    return {
      ...emptyDay(day.date, day.date > today),
      steps: day.steps,
      activityHours: day.activityHours,
      mood: day.mood,
      moodNote: day.moodNote,
      workKind: day.workKind,
      leaveKind: period?.kind ?? null,
      leaveTitle: period?.title?.trim() || null,
    };
  });
}

export function doneTrainingSessions(input: {
  gym: GymSessionForWeek[];
  cardio: CardioSessionForWeek[];
  sport: SportSessionForWeek[];
  bathing: BathingSessionForWeek[];
}): InsightSession[] {
  const out: InsightSession[] = [];
  const push = (
    date: string | null,
    label: string,
    doneAt: string | null,
    kind: InsightSession["kind"],
  ) => {
    if (!date || !doneAt) return;
    const name = label.trim();
    if (!name) return;
    out.push({ date, label: name, kind });
  };

  for (const session of input.gym) {
    push(
      placementLocalDate(session.placement),
      session.label || "Gym",
      session.placement.doneAt,
      "gym",
    );
  }
  for (const session of input.cardio) {
    const display = cardioSessionDisplay(session);
    push(
      placementLocalDate(session.placement),
      display.label,
      session.placement.doneAt,
      "cardio",
    );
  }
  for (const session of input.sport) {
    const name =
      session.placement.actualSport?.trim() ||
      session.placement.planSport?.trim() ||
      session.label;
    push(placementLocalDate(session.placement), name, session.placement.doneAt, "sport");
  }
  for (const session of input.bathing) {
    push(
      placementLocalDate(session.placement),
      session.label,
      session.placement.doneAt,
      "bath",
    );
  }
  return out;
}

export function insightSpendsFromEntries(
  entries: Array<{
    localDate: string;
    amountKr: number;
    shopLocation: string | null;
    description: string;
    title: string;
  }>,
  kind: "expense" | "shopping",
): InsightSpend[] {
  return entries
    .filter((entry) => entry.amountKr > 0 && entry.localDate)
    .map((entry) => ({
      date: entry.localDate,
      amountKr: entry.amountKr,
      label:
        (entry.shopLocation || entry.description || entry.title).trim() ||
        entry.title,
      kind,
    }));
}

export function insightSavingsFromTasks(
  tasks: MonthlyTaskForMonth[],
  start: string,
  end: string,
): InsightSpend[] {
  const out: InsightSpend[] = [];
  for (const task of tasks) {
    if (!isSavingsTransferTaskKey(task.key)) continue;
    const label = SAVINGS_TRANSFER_TASKS[task.key].title;
    for (const completion of monthlyTaskCompletions(task)) {
      if (!completion.doneAt || completion.amount == null || completion.amount <= 0) {
        continue;
      }
      const date = localISOFromTimestamp(completion.doneAt);
      if (date < start || date > end) continue;
      out.push({
        date,
        amountKr: completion.amount,
        label,
        kind: "saving",
      });
    }
  }
  return out;
}

/** Monthly Utgifter booked on a date, so a week can show the bill paid that week. */
export function insightMonthlyExpensesFromTasks(
  tasks: MonthlyTaskForMonth[],
  categories: Array<{ id: string; name: string }>,
  start: string,
  end: string,
): InsightSpend[] {
  const utgifter = new Set(
    categories
      .filter((category) => category.name === UTGIFTER_CATEGORY_NAME)
      .map((category) => category.id),
  );
  const out: InsightSpend[] = [];
  for (const task of tasks) {
    if (task.completionKind !== "amount") continue;
    if (!task.categoryId || !utgifter.has(task.categoryId)) continue;
    if (isSavingsTransferTaskKey(task.key)) continue;
    for (const completion of monthlyTaskCompletions(task)) {
      if (!completion.doneAt || completion.amount == null || completion.amount <= 0) {
        continue;
      }
      const date = localISOFromTimestamp(completion.doneAt);
      if (date < start || date > end) continue;
      const label = completion.note?.trim() || task.title.trim();
      if (!label) continue;
      out.push({
        date,
        amountKr: completion.amount,
        label,
        kind: "expense",
      });
    }
  }
  return out;
}

function savedWorth(snapshot: MonthlyFinanceSnapshot | null): number | null {
  if (!snapshot?.doneAt) return null;
  const filled = Object.values(snapshot.balances).filter((value) => value != null);
  if (filled.length === 0) return null;
  return financeTotal(snapshot.balances);
}

export function insightWealth(
  current: MonthlyFinanceSnapshot | null,
  previous: MonthlyFinanceSnapshot | null,
): InsightWealth | null {
  const total = savedWorth(current);
  if (total == null || !current) return null;
  const previousTotal = savedWorth(previous);
  return {
    totalKr: total,
    asOf: current.monthStart,
    previousKr: previousTotal,
    previousAsOf:
      previousTotal != null && previous ? previous.monthStart : null,
  };
}

function leavePhrases(periods: LeavePeriod[], start: string, end: string): string[] {
  const phrases: string[] = [];
  for (const period of periods) {
    const count = expandLeaveDates(period).filter(
      (date) => date >= start && date <= end,
    ).length;
    if (count === 0) continue;
    const title = period.title?.trim();
    if (period.kind === "travel") {
      phrases.push(
        title
          ? `${count} ${count === 1 ? "dag" : "dagar"} på resan ${trimTitle(title)}`
          : `${count} ${count === 1 ? "resdag" : "resdagar"}`,
      );
    } else if (period.kind === "vacation") {
      phrases.push(`${count} semester${count === 1 ? "dag" : "dagar"}`);
    } else {
      phrases.push(`${count} ${count === 1 ? "ledig dag" : "lediga dagar"}`);
    }
  }
  return phrases;
}

function movementKey(label: string): string | null {
  const name = label.trim().toLowerCase();
  if (!name) return null;
  if (name.startsWith("löp")) return "löpning";
  if (name.startsWith("cyk")) return "cykling";
  if (
    name.startsWith("sim") ||
    name.startsWith("gym") ||
    name.startsWith("bad") ||
    name.startsWith("bastu")
  ) {
    return null;
  }
  return name;
}

function movementPhrase(key: string, count: number): string {
  if (key === "löpning") return count === 1 ? "ett löppass" : `${count} löppass`;
  if (key === "cykling") return count === 1 ? "ett cykelpass" : `${count} cykelpass`;
  if (count === 1) return key;
  return `${count} × ${key}`;
}

function movementPhrases(
  sessions: InsightSession[],
  start: string,
  end: string,
): string[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    if (session.kind !== "cardio" && session.kind !== "sport") continue;
    if (session.date < start || session.date > end) continue;
    const key = movementKey(session.label);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => movementPhrase(key, count));
}

function momentPhrases(moments: InsightMoment[], start: string, end: string): string[] {
  const unique: string[] = [];
  for (const moment of moments) {
    if (moment.date < start || moment.date > end) continue;
    if (unique.includes(moment.label)) continue;
    unique.push(moment.label);
    if (unique.length === 2) break;
  }
  return unique;
}

function pokemonPhrase(days: InsightDay[]): string | null {
  const count = days.filter((day) => day.pokemonGo).length;
  if (count < 2) return null;
  return `Pokemon Go ${count} dagar`;
}

function contrastSentence(
  special: InsightDay[],
  other: InsightDay[],
  name: string,
): { gap: number; sentence: string } | null {
  const specialSteps = special.filter((day) => day.steps > 0).map((day) => day.steps);
  const otherSteps = other.filter((day) => day.steps > 0).map((day) => day.steps);
  if (specialSteps.length < 2 || otherSteps.length < 2) return null;
  const specialAvg = average(specialSteps);
  const otherAvg = average(otherSteps);
  const gap = specialAvg - otherAvg;
  if (specialAvg < otherAvg * 1.18 || gap < 1500) return null;
  return {
    gap,
    sentence: `${name} snittade ${sv(specialAvg)} steg mot ${sv(otherAvg)} övriga dagar.`,
  };
}

function daysBetween(days: InsightDay[], start: string, end: string): InsightDay[] {
  return days.filter((day) => !day.isFuture && day.date >= start && day.date <= end);
}

interface Explanation {
  chip: string | null;
  sentence: string | null;
}

function explainRange(
  days: InsightDay[],
  periods: LeavePeriod[],
  sessions: InsightSession[],
  moments: InsightMoment[],
  start: string,
  end: string,
  today: string,
): Explanation {
  const last = clampEnd(end, today);
  const inRange = daysBetween(days, start, last);
  const reasons = [
    ...leavePhrases(periods, start, last),
    ...movementPhrases(sessions, start, last),
    ...momentPhrases(moments, start, last),
  ];
  const pokemon = pokemonPhrase(inRange);
  if (pokemon) reasons.push(pokemon);

  const leaveDays = inRange.filter((day) => day.leaveKind);
  const stayDays = inRange.filter((day) => !day.leaveKind);
  const officeDays = inRange.filter((day) => day.workKind === "office");
  const homeDays = inRange.filter((day) => day.workKind === "home");
  const runDates = new Set(
    sessions
      .filter(
        (session) =>
          session.date >= start &&
          session.date <= last &&
          (session.kind === "cardio" || session.kind === "sport") &&
          movementKey(session.label) === "löpning",
      )
      .map((session) => session.date),
  );
  const runDays = inRange.filter((day) => runDates.has(day.date));
  const otherRunDays = inRange.filter((day) => !runDates.has(day.date));
  const goDays = inRange.filter((day) => day.pokemonGo);
  const otherGoDays = inRange.filter((day) => !day.pokemonGo);

  const leaveName = leaveDays.every((day) => day.leaveKind === "travel")
    ? "Resdagarna"
    : leaveDays.every((day) => day.leaveKind === "vacation")
      ? "Semesterdagarna"
      : "Lediga dagar";

  const contrasts = [
    contrastSentence(leaveDays, stayDays, leaveName),
    contrastSentence(officeDays, homeDays, "Kontorsdagarna"),
    contrastSentence(runDays, otherRunDays, "Löpdagarna"),
    contrastSentence(goDays, otherGoDays, "Pokemon Go-dagarna"),
  ].filter((item): item is { gap: number; sentence: string } => item != null);
  contrasts.sort((a, b) => b.gap - a.gap);
  const bestContrast = contrasts[0] ?? null;

  const chip = reasons.length > 0 ? reasons.slice(0, 2).join(" · ") : null;
  if (reasons.length === 0 && !bestContrast) {
    return { chip: null, sentence: null };
  }

  const reasonText = reasons.length > 0 ? cap(joinAnd(reasons.slice(0, 4))) : "";
  if (bestContrast && reasonText) {
    return { chip, sentence: `${asSentence(reasonText)} ${bestContrast.sentence}` };
  }
  if (bestContrast) return { chip, sentence: bestContrast.sentence };
  return { chip, sentence: asSentence(reasonText) };
}

function bestStepDay(days: InsightDay[]): InsightDay | null {
  let best: InsightDay | null = null;
  for (const day of days) {
    if (day.isFuture || day.steps <= 0) continue;
    if (!best || day.steps > best.steps) best = day;
  }
  return best;
}

function bestDaySentence(days: InsightDay[], scope: InsightScope): string | null {
  const best = bestStepDay(days);
  if (!best) return null;
  const note = clipNote(best.moodNote);
  const prefix =
    scope === "month"
      ? "Toppdagen den veckan var"
      : scope === "year"
        ? "Toppdagen den månaden var"
        : "Bäst var";
  const base = `${prefix} ${formatDayLong(best.date)} med ${sv(best.steps)} steg`;
  return note ? `${base} — ${note}.` : `${base}.`;
}

function goalSentence(days: InsightDay[]): string | null {
  const logged = days.filter(
    (day) => !day.isFuture && day.steps > 0 && day.stepsGoal > 0,
  );
  if (logged.length < 2) return null;
  const hits = logged.filter((day) => day.steps >= day.stepsGoal).length;
  if (hits === 0) return null;
  const elapsed = days.filter((day) => !day.isFuture && day.stepsGoal > 0).length;
  if (logged.length === elapsed) {
    return `Dagsmålet träffades ${hits} av ${elapsed} dagar.`;
  }
  return `Dagsmålet träffades ${hits} av ${logged.length} loggade dagar.`;
}

function dominantMood(days: InsightDay[]): { key: MoodKey; count: number } | null {
  const counts = new Map<MoodKey, number>();
  for (const day of days) {
    if (day.isFuture || !day.mood) continue;
    counts.set(day.mood, (counts.get(day.mood) ?? 0) + 1);
  }
  let best: { key: MoodKey; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

function spendKrIn(slice: InsightSlice, start: string, end: string): number {
  return (slice.spends ?? [])
    .filter(
      (spend) =>
        spend.kind !== "saving" && spend.date >= start && spend.date <= end,
    )
    .reduce((sum, spend) => sum + spend.amountKr, 0);
}

function makeBucket(
  slice: InsightSlice,
  id: string,
  label: string,
  name: string,
  inPhrase: string,
  start: string,
  end: string,
): Bucket {
  const days = pastDays(slice)
    .filter((day) => day.date >= start && day.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const sessions = slice.sessions.filter(
    (session) => session.date >= start && session.date <= end,
  ).length;
  return {
    id,
    label,
    name,
    inPhrase,
    start,
    end,
    days,
    steps: sumSteps(days),
    sessions,
    spendKr: spendKrIn(slice, start, end),
  };
}

function weekBuckets(slice: InsightSlice): Bucket[] {
  const last = clampEnd(slice.end, slice.today);
  const keys = new Set<string>();
  const consider = (date: string) => {
    if (date < slice.start || date > last) return;
    keys.add(weekStartISO(parseLocalISO(date)));
  };
  for (const day of pastDays(slice)) consider(day.date);
  for (const session of slice.sessions) consider(session.date);
  for (const spend of slice.spends ?? []) {
    if (spend.kind !== "saving") consider(spend.date);
  }

  return [...keys].sort().map((weekStart) => {
    const weekEnd = addDaysISO(weekStart, 6);
    const start = weekStart < slice.start ? slice.start : weekStart;
    const end = weekEnd > last ? last : weekEnd;
    const week = isoWeekNumber(parseLocalISO(weekStart));
    return makeBucket(
      slice,
      weekStart,
      `v.${week} · ${formatSpan(start, end)}`,
      `vecka ${week}`,
      `vecka ${week}`,
      start,
      end,
    );
  });
}

function buildBuckets(slice: InsightSlice): Bucket[] {
  if (slice.scope === "week") return [];
  if (slice.scope === "month") return weekBuckets(slice);

  const last = clampEnd(slice.end, slice.today);
  const keys = new Set<string>();
  const add = (date: string) => {
    if (date < slice.start || date > slice.end || date > slice.today) return;
    keys.add(date.slice(0, 7));
  };
  for (const day of slice.days) add(day.date);
  for (const session of slice.sessions) add(session.date);
  for (const spend of slice.spends ?? []) {
    if (spend.kind !== "saving") add(spend.date);
  }
  for (const moment of slice.moments) add(moment.date);
  for (const item of slice.completions) add(item.date);
  for (const period of slice.leavePeriods) {
    for (const date of expandLeaveDates(period)) add(date);
  }

  return [...keys].sort().map((yearMonth) => {
    const start = `${yearMonth}-01`;
    const end = clampEnd(monthEndISO(start), last);
    return makeBucket(
      slice,
      yearMonth,
      cap(monthName(yearMonth)),
      monthName(yearMonth),
      `i ${monthName(yearMonth)}`,
      start,
      end,
    );
  });
}

function peakBy(
  buckets: Bucket[],
  pick: (bucket: Bucket) => number,
): Bucket[] {
  const active = buckets.filter((bucket) => pick(bucket) > 0);
  if (active.length < 2) return [];
  const max = Math.max(...active.map(pick));
  const peaks = active.filter((bucket) => pick(bucket) === max);
  if (peaks.length > 2) return [];
  return peaks;
}

function peakBuckets(buckets: Bucket[]): Bucket[] {
  const withSteps = buckets.filter((bucket) => bucket.steps > 0);
  if (withSteps.length === 0) return [];
  const max = Math.max(...withSteps.map((bucket) => bucket.steps));
  return withSteps.filter((bucket) => bucket.steps === max);
}

function bucketInProgress(bucket: Bucket, slice: InsightSlice): boolean {
  if (bucket.start > slice.today) return false;
  if (slice.scope === "month") return addDaysISO(bucket.id, 6) > slice.today;
  if (slice.scope === "year") return monthEndISO(bucket.start) > slice.today;
  return false;
}

function rowDetail(
  bucket: Bucket,
  slice: InsightSlice,
  openBucket: boolean,
  tags: string[],
): string {
  const explained = explainRange(
    slice.days,
    slice.leavePeriods,
    slice.sessions,
    slice.moments,
    bucket.start,
    bucket.end,
    slice.today,
  );
  const parts: string[] = [...tags];
  if (openBucket) parts.push("hittills");
  if (explained.chip) parts.push(explained.chip);
  const loggedGoal = bucket.days.filter((day) => day.steps > 0 && day.stepsGoal > 0);
  const hits = loggedGoal.filter((day) => day.steps >= day.stepsGoal).length;
  if (loggedGoal.length >= 2 && hits > 0) {
    parts.push(`mål ${hits}/${loggedGoal.length}`);
  }
  const mood = dominantMood(bucket.days);
  const moodDays = bucket.days.filter((day) => day.mood).length;
  if (mood && mood.count >= 2 && mood.count >= moodDays * 0.5) {
    parts.push(MOOD_LABEL[mood.key].toLowerCase());
  }
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "hittills")) {
    if (bucket.steps <= 0) {
      parts.push("inga steg loggade");
    } else {
      const logged = bucket.days.filter((day) => day.steps > 0).length;
      if (logged > 0) parts.push(`snitt ${sv(bucket.steps / logged)} / dag`);
    }
  }
  if (bucket.steps > 0 || bucket.sessions > 0) {
    if (bucket.spendKr > 0) parts.push(formatKr(bucket.spendKr));
  }
  return parts.join(" · ");
}

function rowValue(bucket: Bucket): string {
  const parts: string[] = [];
  if (bucket.steps > 0) parts.push(sv(bucket.steps));
  if (bucket.sessions > 0) {
    parts.push(`${bucket.sessions} pass`);
  }
  if (parts.length === 0 && bucket.spendKr > 0) parts.push(formatKr(bucket.spendKr));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function extraGood(days: InsightDay[]): string | null {
  const past = days.filter((day) => !day.isFuture);
  const withGoal = past.filter((day) => day.stepsGoal > 0 && day.steps > 0);
  if (withGoal.length >= 4 && withGoal.every((day) => day.steps >= day.stepsGoal)) {
    return "Extra bra: stegmålet varje dag du loggade.";
  }
  const sugar = past.filter((day) => day.sugarFree != null);
  if (sugar.length >= 4 && sugar.every((day) => day.sugarFree === "yes")) {
    return "Extra bra: sockerfri alla loggade dagar.";
  }
  const smoke = past.filter((day) => day.smokeFree != null);
  if (smoke.length >= 4 && smoke.every((day) => day.smokeFree)) {
    return "Extra bra: rökfri alla loggade dagar.";
  }
  const moods = past.filter((day) => day.mood);
  if (
    moods.length >= 4 &&
    moods.every((day) => day.mood === "happy" || day.mood === "joyful")
  ) {
    return "Extra bra: bara glada eller lyckliga dagar.";
  }
  return null;
}

function trainingPhrase(sessions: InsightSession[], grouped = false): string | null {
  if (sessions.length === 0) return null;
  if (!grouped) {
    const counts = new Map<string, { label: string; count: number }>();
    for (const session of sessions) {
      const key = session.label.trim().toLowerCase();
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { label: session.label.trim(), count: 1 });
    }
    const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
    const phrases = ranked.slice(0, 6).map(({ label, count }) => {
      const key = movementKey(label);
      if (key === "löpning" || key === "cykling") return movementPhrase(key, count);
      const name = label.toLowerCase();
      if (name.startsWith("gym")) return count === 1 ? "ett gympass" : `${count} gympass`;
      if (name.startsWith("sim")) return count === 1 ? "ett simpass" : `${count} simpass`;
      if (name.startsWith("bad")) return count === 1 ? "ett bad" : `${count} bad`;
      if (name.startsWith("bastu")) return count === 1 ? "en bastu" : `${count} bastu`;
      return count === 1 ? name : `${count} × ${name}`;
    });
    const hidden = ranked.slice(6).reduce((sum, item) => sum + item.count, 0);
    if (hidden > 0) phrases.push(`${hidden} pass till`);
    return `Träning: ${joinAnd(phrases)}.`;
  }
  let gym = 0;
  let bath = 0;
  let sauna = 0;
  const cardio = new Map<string, number>();
  const sport = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string) => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  for (const session of sessions) {
    const name = session.label.trim().toLowerCase();
    if (session.kind === "gym") {
      gym += 1;
      continue;
    }
    if (session.kind === "bath") {
      if (name.startsWith("bastu")) sauna += 1;
      else bath += 1;
      continue;
    }
    if (session.kind === "cardio") {
      if (name.startsWith("löp")) bump(cardio, "löpning");
      else if (name.startsWith("cyk")) bump(cardio, "cykling");
      else if (name.startsWith("sim")) bump(cardio, "simning");
      else if (name) bump(cardio, name);
      continue;
    }
    const sportName = name.includes("discgolf") || name === "disc"
      ? "discgolf"
      : name.includes("gocart") || name.includes("gokart")
        ? "gokart"
        : name;
    if (sportName) bump(sport, sportName);
  }

  const parts: string[] = [];
  if (gym > 0) parts.push(gym === 1 ? "ett gympass" : `${gym} gympass`);
  for (const [key, count] of [...cardio.entries()].sort((a, b) => b[1] - a[1])) {
    if (key === "löpning" || key === "cykling") parts.push(movementPhrase(key, count));
    else if (key === "simning") parts.push(count === 1 ? "ett simpass" : `${count} simpass`);
    else parts.push(count === 1 ? key : `${count} × ${key}`);
  }
  if (bath > 0) parts.push(bath === 1 ? "ett bad" : `${bath} bad`);
  if (sauna > 0) parts.push(sauna === 1 ? "en bastu" : `${sauna} bastu`);

  const sports = [...sport.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sports.slice(0, 2)) {
    parts.push(count === 1 ? key : `${count} × ${key}`);
  }
  const rest = sports.slice(2).reduce((sum, [, count]) => sum + count, 0);
  if (rest > 0) parts.push(`${rest} andra sportpass`);
  return `Träning: ${joinAnd(parts)}.`;
}

function weekdayPattern(days: InsightDay[]): string | null {
  const buckets = new Map<number, number[]>();
  for (const day of days) {
    if (day.isFuture || day.steps <= 0) continue;
    const weekday = isoWeekdayFromLocalISO(day.date);
    const list = buckets.get(weekday) ?? [];
    list.push(day.steps);
    buckets.set(weekday, list);
  }
  const avgs = [...buckets.entries()]
    .filter(([, values]) => values.length >= 2)
    .map(([weekday, values]) => ({ weekday, avg: average(values) }));
  if (avgs.length < 3) return null;
  avgs.sort((a, b) => b.avg - a.avg);
  const best = avgs[0];
  const restAvg = average(avgs.slice(1).map((item) => item.avg));
  if (best.avg < restAvg * 1.2 || best.avg - restAvg < 1500) return null;
  return `Du går mest på ${WEEKDAY_PLURAL[best.weekday]}, i snitt ${sv(best.avg)} steg.`;
}

function moodStepsPattern(days: InsightDay[]): string | null {
  const bright = days.filter(
    (day) =>
      !day.isFuture &&
      day.steps > 0 &&
      (day.mood === "happy" || day.mood === "joyful"),
  );
  const heavy = days.filter(
    (day) =>
      !day.isFuture &&
      day.steps > 0 &&
      (day.mood === "stressed" || day.mood === "sad" || day.mood === "angry"),
  );
  if (bright.length < 3 || heavy.length < 3) return null;
  const brightAvg = average(bright.map((day) => day.steps));
  const heavyAvg = average(heavy.map((day) => day.steps));
  if (brightAvg > heavyAvg * 1.2 && brightAvg - heavyAvg >= 1500) {
    return `Glada dagar snittar ${sv(brightAvg)} steg, tyngre dagar ${sv(heavyAvg)}.`;
  }
  if (heavyAvg > brightAvg * 1.2 && heavyAvg - brightAvg >= 1500) {
    return `Tyngre dagar snittar ${sv(heavyAvg)} steg, glada dagar ${sv(brightAvg)}.`;
  }
  return null;
}

function moodSummary(days: InsightDay[]): string | null {
  const mood = dominantMood(days);
  if (!mood || mood.count < 3) return null;
  const total = days.filter((day) => !day.isFuture && day.mood).length;
  if (mood.count < total * 0.45) return null;
  return `Humöret var mest ${MOOD_LABEL[mood.key].toLowerCase()} (${mood.count} dagar).`;
}

function quietSentence(buckets: Bucket[]): string | null {
  const withSteps = buckets.filter(
    (bucket) => bucket.steps > 0 && bucket.days.length >= 5,
  );
  if (withSteps.length < 2) return null;
  const peak = Math.max(...withSteps.map((bucket) => bucket.steps));
  const quiet = [...withSteps].sort((a, b) => a.steps - b.steps)[0];
  if (quiet.steps > peak * 0.65) return null;
  const sick = quiet.days.filter((day) => day.workKind === "sick").length;
  const reason =
    sick === 1 ? "1 sjukdag" : sick > 1 ? `${sick} sjukdagar` : null;
  const base = `Lugnast var ${quiet.name} med ${sv(quiet.steps)} steg`;
  return reason ? `${base} — ${reason}.` : `${base}.`;
}

function completionSentence(items: InsightCompletion[], why: string): string | null {
  if (items.length === 0) return null;
  const fresh = items.filter(
    (item) => !why.toLowerCase().includes(item.title.toLowerCase()),
  );
  const source = fresh.length > 0 ? fresh : items;
  const shown = source.slice(0, 3);
  const hidden = items.length - shown.length;
  const names = joinAnd(shown.map((item) => item.title));
  if (hidden > 0) return `Klart: ${names} och ${hidden} till.`;
  return `Klart: ${names}.`;
}

function buildStats(slice: InsightSlice, days: InsightDay[]): InsightStat[] {
  const stats: InsightStat[] = [];
  const last = clampEnd(slice.end, slice.today);
  const sessions = slice.sessions.filter(
    (session) => session.date >= slice.start && session.date <= last,
  );
  const completions = slice.completions.filter(
    (item) => item.date >= slice.start && item.date <= last,
  );
  const logged = days.filter((day) => day.steps > 0);
  const total = sumSteps(days);
  if (total > 0) {
    stats.push({
      label: "Steg",
      value: sv(total),
      hint: logged.length > 0 ? `snitt ${sv(total / logged.length)}` : undefined,
    });
  }
  const goalDays = days.filter((day) => day.steps > 0 && day.stepsGoal > 0);
  const goalHits = goalDays.filter((day) => day.steps >= day.stepsGoal).length;
  if (goalDays.length >= 2 && goalHits > 0) {
    stats.push({
      label: "Stegmål",
      value: `${goalHits}/${goalDays.length}`,
      hint: "loggade dagar",
    });
  }
  if (sessions.length > 0) {
    stats.push({
      label: "Träning",
      value: String(sessions.length),
      hint: sessions.length === 1 ? "gjort pass" : "gjorda pass",
    });
  }
  const periodSpends = (slice.spends ?? []).filter(
    (spend) => spend.date >= slice.start && spend.date <= last && spend.amountKr > 0,
  );
  const costs = periodSpends.filter((spend) => spend.kind !== "saving");
  const saved = periodSpends.filter((spend) => spend.kind === "saving");
  const spentKr = costs.reduce((sum, spend) => sum + spend.amountKr, 0);
  const savedKr = saved.reduce((sum, spend) => sum + spend.amountKr, 0);
  if (spentKr > 0) {
    const kinds = new Set(costs.map((spend) => spend.kind));
    const hint = kinds.has("expense") && kinds.has("shopping")
      ? "utgifter och handling"
      : kinds.has("shopping")
        ? "handlat"
        : "utgifter";
    stats.push({
      label: "Pengar",
      value: formatKr(spentKr),
      hint: savedKr > 0 ? `sparat ${formatKr(savedKr)}` : hint,
    });
  } else if (savedKr > 0) {
    stats.push({
      label: "Sparat",
      value: formatKr(savedKr),
    });
  }
  if (slice.wealth && slice.scope !== "week") {
    const delta =
      slice.wealth.previousKr == null
        ? null
        : slice.wealth.totalKr - slice.wealth.previousKr;
    stats.push({
      label: "Tillgångar",
      value: formatKr(slice.wealth.totalKr),
      hint:
        delta == null
          ? monthName(slice.wealth.asOf.slice(0, 7))
          : `${formatKr(Math.abs(delta))} ${delta >= 0 ? "mer" : "mindre"}`,
    });
  }
  if (completions.length > 0) {
    stats.push({
      label: "Klart",
      value: String(completions.length),
      hint: "avklarat",
    });
  }
  const mood = dominantMood(days);
  if (mood && mood.count >= 2) {
    stats.push({
      label: "Humör",
      value: MOOD_LABEL[mood.key],
      hint: `${mood.count} dagar`,
    });
  }
  const waterLogged = days.filter((day) => day.waterMl > 0 && day.waterGoalMl > 0);
  const waterHits = waterLogged.filter((day) => day.waterMl >= day.waterGoalMl).length;
  if (waterLogged.length >= 2 && waterHits > 0) {
    stats.push({
      label: "Vatten",
      value: `${waterHits}/${waterLogged.length}`,
      hint: "dagar på målet",
    });
  }
  const activity = days.reduce((sum, day) => sum + day.activityHours, 0);
  if (activity >= 1) {
    const rounded = Math.round(activity * 10) / 10;
    stats.push({
      label: "Aktivitet",
      value: `${rounded.toLocaleString("sv-SE")} h`,
      hint: "loggad tid",
    });
  }
  return stats.slice(0, 6);
}

function fallbackLead(slice: InsightSlice, days: InsightDay[]): string | null {
  const where = wherePhrase(slice);
  if (slice.completions.length > 0) {
    const names = joinAnd(slice.completions.slice(0, 3).map((item) => item.title));
    return `Klart ${where}: ${names}.`;
  }
  const last = clampEnd(slice.end, slice.today);
  const explained = explainRange(
    slice.days,
    slice.leavePeriods,
    slice.sessions,
    slice.moments,
    slice.start,
    last,
    slice.today,
  );
  if (explained.sentence) return explained.sentence;
  const training = trainingPhrase(slice.sessions, slice.scope === "year");
  if (training) return training;
  const money = moneyLead(slice);
  if (money) return money;
  return moodSummary(days);
}

function periodCosts(slice: InsightSlice): InsightSpend[] {
  const last = clampEnd(slice.end, slice.today);
  return (slice.spends ?? []).filter(
    (spend) =>
      spend.kind !== "saving" &&
      spend.amountKr > 0 &&
      spend.date >= slice.start &&
      spend.date <= last,
  );
}

function moneyLead(slice: InsightSlice): string | null {
  const costs = periodCosts(slice);
  if (costs.length === 0) return null;
  const total = costs.reduce((sum, spend) => sum + spend.amountKr, 0);
  const kinds = new Set(costs.map((spend) => spend.kind));
  const where = wherePhrase(slice);
  if (kinds.has("shopping") && !kinds.has("expense")) {
    return `Handlat för ${formatKr(total)} ${where}.`;
  }
  if (kinds.has("expense") && kinds.has("shopping")) {
    return `${formatKr(total)} i utgifter och handling ${where}.`;
  }
  return `${formatKr(total)} i utgifter ${where}.`;
}

function wealthWhen(monthStart: string, sliceYear: string): string {
  const name = monthName(monthStart.slice(0, 7));
  const year = monthStart.slice(0, 4);
  return year === sliceYear ? name : `${name} ${year}`;
}

function wealthSentence(slice: InsightSlice): string | null {
  const wealth = slice.wealth;
  if (!wealth || slice.scope === "week") return null;
  const now = formatKr(wealth.totalKr);
  const year = slice.start.slice(0, 4);
  if (wealth.previousKr == null || !wealth.previousAsOf) {
    return slice.scope === "year"
      ? `Tillgångarna är ${now} i ${wealthWhen(wealth.asOf, year)}.`
      : `Tillgångarna är ${now}.`;
  }
  const delta = wealth.totalKr - wealth.previousKr;
  const then = wealthWhen(wealth.previousAsOf, year);
  if (Math.abs(delta) < 1) return `Tillgångarna är ${now}, samma som i ${then}.`;
  const direction = delta > 0 ? "mer" : "mindre";
  return `Tillgångarna är ${now}, ${formatKr(Math.abs(delta))} ${direction} än i ${then}.`;
}

function savingsSentence(slice: InsightSlice): string | null {
  const last = clampEnd(slice.end, slice.today);
  const saved = (slice.spends ?? []).filter(
    (spend) =>
      spend.kind === "saving" &&
      spend.amountKr > 0 &&
      spend.date >= slice.start &&
      spend.date <= last,
  );
  if (saved.length === 0) return null;
  const total = saved.reduce((sum, spend) => sum + spend.amountKr, 0);
  if (saved.length === 1) {
    return `Sparat ${formatKr(total)} (${trimTitle(saved[0].label)}).`;
  }
  return `Sparat ${formatKr(total)}.`;
}

function moneyHighlight(slice: InsightSlice, buckets: Bucket[]): string | null {
  const costs = periodCosts(slice);
  if (costs.length === 0) return null;
  const parts: string[] = [];
  const peaks = peakBy(buckets, (bucket) => bucket.spendKr);
  if (peaks.length === 1) {
    parts.push(
      `Mest pengar gick ${peaks[0].inPhrase}, ${formatKr(peaks[0].spendKr)}`,
    );
  } else if (peaks.length === 2) {
    parts.push(
      `Mest pengar gick ${peaks[0].inPhrase} och ${peaks[1].inPhrase}, ${formatKr(peaks[0].spendKr)}`,
    );
  }
  const top = [...costs].sort((a, b) => b.amountKr - a.amountKr)[0];
  if (costs.length > 1 || parts.length === 0) {
    const verb = top.kind === "shopping" ? "Störst handling" : "Störst utgift";
    parts.push(`${verb}: ${trimTitle(top.label)}, ${formatKr(top.amountKr)}`);
  }
  return sentences(parts);
}

function trainingComparison(buckets: Bucket[], stepPeaks: Bucket[]): string | null {
  const trainPeaks = peakBy(buckets, (bucket) => bucket.sessions);
  if (trainPeaks.length === 0) return null;
  if (
    stepPeaks.length === 1 &&
    trainPeaks.length === 1 &&
    stepPeaks[0].id === trainPeaks[0].id
  ) {
    return null;
  }
  if (trainPeaks.length === 1) {
    return `Mest tränade du ${trainPeaks[0].inPhrase}, ${trainPeaks[0].sessions} pass.`;
  }
  return `Mest tränade du ${trainPeaks[0].inPhrase} och ${trainPeaks[1].inPhrase}, ${trainPeaks[0].sessions} pass.`;
}

function yearWeekHighlights(slice: InsightSlice): string[] {
  if (slice.scope !== "year") return [];
  const weeks = weekBuckets(slice);
  const stepPeaks = peakBy(weeks, (bucket) => bucket.steps);
  const trainPeaks = peakBy(weeks, (bucket) => bucket.sessions);
  if (
    stepPeaks.length === 1 &&
    trainPeaks.length === 1 &&
    stepPeaks[0].id === trainPeaks[0].id
  ) {
    const peak = stepPeaks[0];
    return [
      `${cap(peak.name)} stack ut med ${sv(peak.steps)} steg och ${peak.sessions} pass, mest av båda.`,
    ];
  }
  const notes: string[] = [];
  if (stepPeaks.length === 1) {
    notes.push(
      `Mest gick du ${stepPeaks[0].inPhrase}, ${sv(stepPeaks[0].steps)} steg.`,
    );
  } else if (stepPeaks.length === 2) {
    notes.push(
      `Mest gick du ${stepPeaks[0].inPhrase} och ${stepPeaks[1].inPhrase}, ${sv(stepPeaks[0].steps)} steg.`,
    );
  }
  if (trainPeaks.length === 1) {
    notes.push(
      `Mest tränade du ${trainPeaks[0].inPhrase}, ${trainPeaks[0].sessions} pass.`,
    );
  } else if (trainPeaks.length === 2) {
    notes.push(
      `Mest tränade du ${trainPeaks[0].inPhrase} och ${trainPeaks[1].inPhrase}, ${trainPeaks[0].sessions} pass.`,
    );
  }
  return notes;
}

function buildLead(
  slice: InsightSlice,
  days: InsightDay[],
  buckets: Bucket[],
  open: boolean,
): string {
  const total = sumSteps(days);
  if (total <= 0) return fallbackLead(slice, days) ?? "";
  const where = wherePhrase(slice);
  const head = open
    ? `Hittills ${sv(total)} steg ${where}.`
    : `${sv(total)} steg ${where}.`;
  if (slice.scope === "week") {
    return sentences([head, bestDaySentence(days, slice.scope), goalSentence(days)]);
  }
  const peaks = buckets.length >= 2 ? peakBuckets(buckets) : [];
  if (peaks.length === 0) return sentences([head, goalSentence(days)]);
  const peak = peaks[0];
  const second = peaks[1];
  const trainPeaks = peakBy(buckets, (bucket) => bucket.sessions);
  const folded =
    !second &&
    trainPeaks.length === 1 &&
    trainPeaks[0].id === peak.id;
  const peakLine = second
    ? `Högst ligger ${peak.name} och ${second.name}, med ${sv(peak.steps)} steg.`
    : folded
      ? `Mest gick du ${peak.inPhrase}, ${sv(peak.steps)} steg, och där tränade du också mest, ${peak.sessions} pass.`
      : `Mest gick du ${peak.inPhrase}, ${sv(peak.steps)} steg.`;
  return sentences([
    head,
    peakLine,
    folded ? null : trainingComparison(buckets, peaks),
    goalSentence(days),
  ]);
}

function hasSignal(slice: InsightSlice, days: InsightDay[]): boolean {
  if (days.length === 0 && slice.scope !== "year") return false;
  return (
    days.some(
      (day) =>
        day.steps > 0 ||
        day.mood != null ||
        day.activityHours > 0 ||
        day.waterMl > 0 ||
        day.leaveKind != null,
    ) ||
    slice.sessions.length > 0 ||
    slice.moments.some((moment) => moment.date <= slice.today) ||
    slice.completions.some((item) => item.date <= slice.today) ||
    (slice.spends ?? []).some(
      (spend) =>
        spend.amountKr > 0 &&
        spend.date >= slice.start &&
        spend.date <= slice.today,
    ) ||
    (slice.wealth != null && slice.scope !== "week") ||
    leavePhrases(slice.leavePeriods, slice.start, clampEnd(slice.end, slice.today))
      .length > 0
  );
}

export function buildPeriodInsights(slice: InsightSlice): PeriodInsightModel | null {
  const days = pastDays(slice);
  if (!hasSignal(slice, days)) return null;

  const open = periodOpen(slice);
  const buckets = buildBuckets(slice);
  const peaks = peakBuckets(buckets);
  const focus =
    slice.scope === "week"
      ? { start: slice.start, end: slice.end, days }
      : peaks[0]
        ? { start: peaks[0].start, end: peaks[0].end, days: peaks[0].days }
        : { start: slice.start, end: slice.end, days };

  const explained = explainRange(
    slice.days,
    slice.leavePeriods,
    slice.sessions,
    slice.moments,
    focus.start,
    focus.end,
    slice.today,
  );
  const why =
    explained.sentence ??
    (slice.scope === "week" ? null : bestDaySentence(focus.days, slice.scope));

  const lead = buildLead(slice, days, buckets, open);
  if (!lead && !why) return null;

  const whyText = why ?? "";
  const training = trainingPhrase(
    slice.sessions.filter(
      (session) => session.date >= slice.start && session.date <= slice.today,
    ),
    slice.scope === "year",
  );
  const highlights = [
    extraGood(days),
    slice.scope === "year" ? training : null,
    ...yearWeekHighlights(slice),
    completionSentence(
      slice.completions.filter((item) => item.date <= slice.today),
      whyText,
    ),
    moneyHighlight(slice, buckets),
    savingsSentence(slice),
    wealthSentence(slice),
    slice.scope === "week" ? moodSummary(days) : weekdayPattern(days),
    slice.scope === "week" ? null : quietSentence(buckets),
    slice.scope === "week" ? null : (moodStepsPattern(days) ?? moodSummary(days)),
    slice.scope === "year" ? null : training,
    slice.topRestaurant && slice.topRestaurant.visits >= 2
      ? `Mest ute: ${slice.topRestaurant.name} (${slice.topRestaurant.visits} besök).`
      : null,
  ].filter((item): item is string => Boolean(item));

  const seen = new Set<string>();
  const uniqueHighlights = highlights.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });

  const trainPeaks = peakBy(buckets, (bucket) => bucket.sessions);
  const comparable = buckets.filter(
    (bucket) => bucket.steps > 0 || bucket.sessions > 0 || bucket.spendKr > 0,
  );
  const rows =
    comparable.length >= 2
      ? comparable.map((bucket) => {
          const stepPeak = peaks.some((peak) => peak.id === bucket.id);
          const trainPeak = trainPeaks.some((peak) => peak.id === bucket.id);
          const tags: string[] = [];
          if (stepPeak && trainPeak) tags.push("mest steg och träning");
          else if (stepPeak && trainPeaks.length > 0) tags.push("mest steg");
          else if (trainPeak) tags.push("mest träning");
          return {
            id: bucket.id,
            label: bucket.label,
            value: rowValue(bucket),
            detail: rowDetail(
              bucket,
              slice,
              bucketInProgress(bucket, slice),
              tags,
            ),
            peak: stepPeak,
            trainPeak,
          };
        })
      : [];

  return {
    title: TITLE[slice.scope],
    kicker: open ? "hittills" : "vad som stack ut",
    lead,
    why,
    stats: buildStats(slice, days),
    rowsCaption:
      rows.length === 0 ? null : slice.scope === "month" ? "Vecka för vecka" : "Månad för månad",
    rows,
    highlights: uniqueHighlights.slice(0, 7),
  };
}
