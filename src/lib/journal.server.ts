import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BathingSessionForWeek } from "@/lib/bathing";
import { formatWaterTemp } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { SportSessionForWeek } from "@/lib/sport";
import { formatSportDetail } from "@/lib/sport";
import { addDaysISO, isoWeekdayFromLocalISO } from "@/lib/date";
import type { GymSessionForWeek } from "@/lib/gym";
import { GYM_WARMUP_LABEL } from "@/lib/gym";
import {
  buildJournalNarrative,
  buildJournalPreview,
  type DailyJournal,
  type JournalDisplayEntry,
  type ManualJournalEntry,
  type WeekJournalDay,
  type WeekJournalSummary,
} from "@/lib/journal";
import { MOOD_ICON, MOOD_LABEL, type MoodKey } from "@/lib/mood";
import { isMoodKey } from "@/lib/mood";
import {
  formatMonthlyTaskDetail,
  type MonthlyTaskForMonth,
  type WeeklyTaskForWeek,
} from "@/lib/tasks";
import { monthlyTasksOnLocalDate } from "@/lib/monthly-bills";
import type { MonthlyBillsWeekContext } from "@/lib/tasks.server";
import { formatWeightKg } from "@/lib/format";
import type { WeightWeekPlan } from "@/lib/weight";
import type { WorkDailyLog } from "@/lib/work";
import {
  getJournalTrackersForDate,
  getJournalTrackersForWeek,
  intakeJournalIcon,
  intakeJournalTitle,
  mealJournalBody,
  mealJournalIcon,
  mealJournalTitle,
  type JournalDailyTrackers,
} from "@/lib/journal-trackers.server";
import { MEDIA_KIND_LABEL } from "@/lib/media";
import { SNACK_ICON, SNACK_LABEL } from "@/lib/habits";
import { formatMl } from "@/lib/water";

interface ManualRow {
  id: string;
  local_date: string;
  body: string;
  created_at: string;
  updated_at: string;
}

function rowToManual(r: ManualRow): ManualJournalEntry {
  return {
    id: r.id,
    localDate: r.local_date,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function manualToDisplay(entry: ManualJournalEntry): JournalDisplayEntry {
  return {
    id: entry.id,
    source: "manual",
    icon: "📝",
    title: "Anteckning",
    body: entry.body,
    at: entry.createdAt,
    editable: true,
  };
}

export interface JournalDayContext {
  localDate: string;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  monthlyTasks?: MonthlyTaskForMonth[];
  mood: MoodKey | null;
  weightKg: number | null;
  work: WorkDailyLog | null;
  trackers?: JournalDailyTrackers;
}

export interface WeekJournalContext {
  weekStart: string;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  sportSessions: SportSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  monthlyBillsWeek?: MonthlyBillsWeekContext;
  weightPlan: WeightWeekPlan;
  workByDate: Map<string, WorkDailyLog>;
}

function buildTrackerEntries(trackers: JournalDailyTrackers): JournalDisplayEntry[] {
  const entries: JournalDisplayEntry[] = [];

  for (const meal of trackers.meals) {
    entries.push({
      id: `meal-${meal.id}`,
      source: "meal",
      icon: mealJournalIcon(meal.meal),
      title: mealJournalTitle(meal.meal),
      body: mealJournalBody(
        meal.meal,
        meal.description,
        meal.waterMl,
        meal.cookedBy,
        meal.mealBoxes,
        meal.restaurantName,
        meal.cookedByName,
      ),
      at: meal.loggedAt,
      editable: false,
    });
  }

  for (const snack of trackers.snacks) {
    entries.push({
      id: `snack-${snack.slot}-${snack.loggedAt}`,
      source: "snack",
      icon: SNACK_ICON[snack.slot],
      title: SNACK_LABEL[snack.slot],
      body: snack.description.trim() || "Mellanmål",
      at: snack.loggedAt,
      editable: false,
    });
  }

  for (const item of trackers.intake) {
    const body =
      item.kind === "creatine"
        ? "Kreatin"
        : item.kind === "shake"
          ? "Shake"
          : item.description.trim();
    entries.push({
      id: `intake-${item.id}`,
      source: "intake",
      icon: intakeJournalIcon(item.kind),
      title: intakeJournalTitle(item.kind),
      body,
      at: item.loggedAt,
      editable: false,
    });
  }

  for (const log of trackers.waterLogs) {
    const body = log.note?.trim()
      ? `${formatMl(log.amountMl)} — ${log.note.trim()}`
      : formatMl(log.amountMl);
    entries.push({
      id: `water-${log.id}`,
      source: "water",
      icon: "💧",
      title: "Vatten",
      body,
      at: log.loggedAt,
      editable: false,
    });
  }

  for (const habit of trackers.habits) {
    const statusText =
      habit.status === "yes"
        ? habit.label
        : `${habit.label} (delvis)`;
    entries.push({
      id: `habit-${habit.id}`,
      source: "habit",
      icon: habit.icon,
      title: habit.label,
      body: habit.note?.trim() || statusText,
      at: habit.loggedAt,
      editable: false,
    });
  }

  if (trackers.activity.loggedAt) {
    const parts: string[] = [];
    if (trackers.activity.steps != null && trackers.activity.steps > 0) {
      parts.push(`${trackers.activity.steps.toLocaleString("sv-SE")} steg`);
    }
    if (
      trackers.activity.activityHours != null &&
      trackers.activity.activityHours > 0
    ) {
      parts.push(`${trackers.activity.activityHours} h aktivitet`);
    }
    if (parts.length > 0) {
      entries.push({
        id: `activity-${trackers.activity.loggedAt}`,
        source: "activity",
        icon: "👟",
        title: "Aktivitet",
        body: parts.join(", "),
        at: trackers.activity.loggedAt,
        editable: false,
      });
    }
  }

  if (trackers.media) {
    const kindLabel = MEDIA_KIND_LABEL[trackers.media.kind].toLowerCase();
    entries.push({
      id: `media-${trackers.media.loggedAt}`,
      source: "media",
      icon: "📺",
      title: MEDIA_KIND_LABEL[trackers.media.kind],
      body: `${kindLabel}: ${trackers.media.title} (${trackers.media.detail})`,
      at: trackers.media.loggedAt,
      editable: false,
    });
  }

  if (trackers.mobileGames) {
    entries.push({
      id: `games-${trackers.mobileGames.loggedAt}`,
      source: "mobile_game",
      icon: "📱",
      title: "Mobilspel",
      body: trackers.mobileGames.labels.join(", "),
      at: trackers.mobileGames.loggedAt,
      editable: false,
    });
  }

  return entries;
}

function buildAutoEntries(ctx: JournalDayContext): JournalDisplayEntry[] {
  const entries: JournalDisplayEntry[] = [];

  if (ctx.trackers) {
    entries.push(...buildTrackerEntries(ctx.trackers));
  }

  for (const s of ctx.gymSessions) {
    if (!s.placement.doneAt) continue;
    const userNote = s.placement.note?.trim();
    const parts: string[] = [];
    if (!userNote && s.placement.warmup) {
      parts.push(`Uppvärmning: ${GYM_WARMUP_LABEL[s.placement.warmup]}`);
    }
    entries.push({
      id: `gym-${s.placement.id}`,
      source: "gym",
      icon: s.icon,
      title: s.label,
      body: userNote || (parts.length > 0 ? parts.join(". ") : s.label),
      at: s.placement.doneAt,
      editable: false,
    });
  }

  for (const s of ctx.cardioSessions) {
    if (!s.placement.doneAt) continue;
    entries.push({
      id: `cardio-${s.placement.id}`,
      source: "cardio",
      icon: s.icon,
      title: s.label,
      body: s.placement.note?.trim() || "Pass klart.",
      at: s.placement.doneAt,
      editable: false,
    });
  }

  for (const s of ctx.sportSessions) {
    if (!s.placement.doneAt) continue;
    entries.push({
      id: `sport-${s.placement.id}`,
      source: "sport",
      icon: s.icon,
      title: s.placement.actualSport?.trim() || s.label,
      body: formatSportDetail(s.placement) ?? "Pass klart.",
      at: s.placement.doneAt,
      editable: false,
    });
  }

  for (const s of ctx.bathingSessions) {
    if (!s.placement.doneAt) continue;
    const parts: string[] = [];
    if (s.placement.waterTempC != null) {
      parts.push(formatWaterTemp(s.placement.waterTempC));
    }
    if (s.placement.note) parts.push(s.placement.note);
    if (s.description && parts.length === 0) parts.push(s.description);
    entries.push({
      id: `bathing-${s.placement.id}`,
      source: "bathing",
      icon: s.icon,
      title: s.label,
      body: parts.length > 0 ? parts.join(". ") : "Klart.",
      at: s.placement.doneAt,
      editable: false,
    });
  }

  for (const t of journalWeeklyTasksForDate(ctx.tasks, ctx.localDate)) {
    const placement = t.placement!;
    const parts: string[] = [];
    if (placement.planNote) parts.push(`Plan: ${placement.planNote}`);
    if (placement.band) parts.push(placement.band);
    if (placement.note) parts.push(placement.note);
    entries.push({
      id: `task-${placement.id}`,
      source: "task",
      icon: t.icon,
      title: t.title,
      body: parts.length > 0 ? parts.join(". ") : "Klar.",
      at: placement.doneAt!,
      editable: false,
    });
  }

  for (const t of journalMonthlyTasksForDate(ctx.monthlyTasks ?? [], ctx.localDate)) {
    const completion = t.completion!;
    const detail = formatMonthlyTaskDetail(t, completion);
    entries.push({
      id: `monthly-task-${completion.id}`,
      source: "task",
      icon: t.icon,
      title: t.title,
      body: detail ?? "Klar.",
      at: completion.doneAt!,
      editable: false,
    });
  }

  if (ctx.mood) {
    entries.push({
      id: `mood-${ctx.localDate}`,
      source: "mood",
      icon: MOOD_ICON[ctx.mood],
      title: "Dagskänsla",
      body: MOOD_LABEL[ctx.mood],
      at: `${ctx.localDate}T12:00:00.000Z`,
      editable: false,
    });
  }

  if (ctx.weightKg != null) {
    entries.push({
      id: `weight-${ctx.localDate}`,
      source: "weight",
      icon: "⚖️",
      title: "Vikt",
      body: formatWeightKg(ctx.weightKg),
      at: `${ctx.localDate}T08:00:00.000Z`,
      editable: false,
    });
  }

  if (ctx.work?.startedAt) {
    entries.push({
      id: `work-start-${ctx.localDate}`,
      source: "work_start",
      icon: "💼",
      title: "Jobb start",
      body: ctx.work.startNote?.trim() || "",
      at: ctx.work.startedAt,
      editable: false,
    });
  }

  if (ctx.work?.endedAt) {
    entries.push({
      id: `work-end-${ctx.localDate}`,
      source: "work_end",
      icon: "🏠",
      title: "Jobb slut",
      body: ctx.work.endNote?.trim() || "",
      at: ctx.work.endedAt,
      editable: false,
    });
  }

  return entries;
}

function mergeJournalEntries(
  manual: ManualJournalEntry[],
  auto: JournalDisplayEntry[],
): JournalDisplayEntry[] {
  return [...manual.map(manualToDisplay), ...auto].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export async function getManualJournalEntries(
  userId: string,
  localDate: string,
): Promise<ManualJournalEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("id, local_date, body, created_at, updated_at")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("created_at", { ascending: true });
  return (data ?? []).map(rowToManual);
}

export async function getManualJournalEntriesForWeek(
  userId: string,
  weekStart: string,
): Promise<ManualJournalEntry[]> {
  const weekEnd = addDaysISO(weekStart, 6);
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("id, local_date, body, created_at, updated_at")
    .eq("user_id", userId)
    .gte("local_date", weekStart)
    .lte("local_date", weekEnd)
    .order("created_at", { ascending: true });
  return (data ?? []).map(rowToManual);
}

async function getMoodsForWeek(
  userId: string,
  weekStart: string,
): Promise<Map<string, MoodKey>> {
  const weekEnd = addDaysISO(weekStart, 6);
  const supabase = await createClient();
  const { data } = await supabase
    .from("mood_daily_logs")
    .select("local_date, mood")
    .eq("user_id", userId)
    .gte("local_date", weekStart)
    .lte("local_date", weekEnd);

  const map = new Map<string, MoodKey>();
  for (const row of data ?? []) {
    if (isMoodKey(row.mood)) map.set(row.local_date, row.mood);
  }
  return map;
}

function sessionsForDate<T extends { placement: { weekday: number | null } }>(
  sessions: T[],
  localDate: string,
): T[] {
  const weekday = isoWeekdayFromLocalISO(localDate);
  return sessions.filter(
    (s) => s.placement.weekday != null && s.placement.weekday === weekday,
  );
}

/** Weekly tasks checked off on this calendar day. */
function journalWeeklyTasksForDate(
  tasks: WeeklyTaskForWeek[],
  localDate: string,
): WeeklyTaskForWeek[] {
  return tasks.filter((t) => {
    const doneAt = t.placement?.doneAt;
    return doneAt != null && doneAt.slice(0, 10) === localDate;
  });
}

/** Monthly tasks checked off on this calendar day. */
function journalMonthlyTasksForDate(
  tasks: MonthlyTaskForMonth[],
  localDate: string,
): MonthlyTaskForMonth[] {
  return tasks.filter((t) => {
    const doneAt = t.completion?.doneAt;
    return doneAt != null && doneAt.slice(0, 10) === localDate;
  });
}

function monthlyTasksForDate(
  billsWeek: MonthlyBillsWeekContext,
  localDate: string,
): MonthlyTaskForMonth[] {
  const monthStart = `${localDate.slice(0, 7)}-01`;
  const merged = billsWeek.tasks.map((task) => ({
    ...task,
    completion:
      billsWeek.completionsByTaskMonth.get(`${task.id}|${monthStart}`) ??
      task.completion ??
      null,
  }));
  return monthlyTasksOnLocalDate(
    merged,
    localDate,
    billsWeek.completionsByTaskMonth,
    { includeWhenDone: true },
  );
}

function weightForDate(weightPlan: WeightWeekPlan, localDate: string): number | null {
  if (!weightPlan.enabled || weightPlan.log?.localDate !== localDate) return null;
  return weightPlan.log.weightKg;
}

export function buildDailyJournal(
  manual: ManualJournalEntry[],
  ctx: JournalDayContext,
): DailyJournal {
  const entries = mergeJournalEntries(manual, buildAutoEntries(ctx));
  const narrative = buildJournalNarrative(entries);
  return {
    localDate: ctx.localDate,
    entries,
    narrative,
  };
}

export async function getDailyJournal(
  userId: string,
  ctx: JournalDayContext,
): Promise<DailyJournal> {
  const [manual, trackers] = await Promise.all([
    getManualJournalEntries(userId, ctx.localDate),
    ctx.trackers
      ? Promise.resolve(ctx.trackers)
      : getJournalTrackersForDate(userId, ctx.localDate),
  ]);
  return buildDailyJournal(manual, { ...ctx, trackers });
}

export async function getWeekJournalSummary(
  userId: string,
  context: WeekJournalContext,
): Promise<WeekJournalSummary> {
  const [manualEntries, moods, trackersByDate] = await Promise.all([
    getManualJournalEntriesForWeek(userId, context.weekStart),
    getMoodsForWeek(userId, context.weekStart),
    getJournalTrackersForWeek(
      userId,
      context.weekStart,
      addDaysISO(context.weekStart, 6),
    ),
  ]);

  const manualByDate = new Map<string, ManualJournalEntry[]>();
  for (const entry of manualEntries) {
    const list = manualByDate.get(entry.localDate) ?? [];
    list.push(entry);
    manualByDate.set(entry.localDate, list);
  }

  const days: WeekJournalDay[] = [];
  for (let i = 0; i < 7; i++) {
    const localDate = addDaysISO(context.weekStart, i);
    const dayCtx: JournalDayContext = {
      localDate,
      gymSessions: sessionsForDate(context.gymSessions, localDate),
      cardioSessions: sessionsForDate(context.cardioSessions, localDate),
      sportSessions: sessionsForDate(context.sportSessions, localDate),
      bathingSessions: sessionsForDate(context.bathingSessions, localDate),
      tasks: context.tasks,
      monthlyTasks: context.monthlyBillsWeek
        ? monthlyTasksForDate(context.monthlyBillsWeek, localDate)
        : undefined,
      mood: moods.get(localDate) ?? null,
      weightKg: weightForDate(context.weightPlan, localDate),
      work: context.workByDate.get(localDate) ?? null,
      trackers: trackersByDate.get(localDate),
    };
    const manual = manualByDate.get(localDate) ?? [];
    const entries = mergeJournalEntries(manual, buildAutoEntries(dayCtx));
    const narrative = buildJournalNarrative(entries);
    days.push({
      localDate,
      entries,
      narrative,
      preview: buildJournalPreview(entries, narrative),
      entryCount: entries.length,
    });
  }

  return { weekStart: context.weekStart, days };
}
