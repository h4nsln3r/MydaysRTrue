import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BathingSessionForWeek } from "@/lib/bathing";
import { formatWaterTemp } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
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
import type { WeeklyTaskForWeek } from "@/lib/tasks";
import { formatWeightKg } from "@/lib/format";
import type { WeightWeekPlan } from "@/lib/weight";
import type { WorkDailyLog } from "@/lib/work";

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
  bathingSessions: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  mood: MoodKey | null;
  weightKg: number | null;
  work: WorkDailyLog | null;
}

export interface WeekJournalContext {
  weekStart: string;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  tasks: WeeklyTaskForWeek[];
  weightPlan: WeightWeekPlan;
  workByDate: Map<string, WorkDailyLog>;
}

function buildAutoEntries(ctx: JournalDayContext): JournalDisplayEntry[] {
  const entries: JournalDisplayEntry[] = [];

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

  for (const t of ctx.tasks) {
    if (!t.placement?.doneAt) continue;
    const parts: string[] = [];
    if (t.placement.planNote) parts.push(`Plan: ${t.placement.planNote}`);
    if (t.placement.note) parts.push(t.placement.note);
    entries.push({
      id: `task-${t.placement.id}`,
      source: "task",
      icon: t.icon,
      title: t.title,
      body: parts.length > 0 ? parts.join(". ") : "Klar.",
      at: t.placement.doneAt,
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

function tasksForDate(tasks: WeeklyTaskForWeek[], localDate: string): WeeklyTaskForWeek[] {
  const weekday = isoWeekdayFromLocalISO(localDate);
  return tasks.filter(
    (t) => t.placement?.weekday != null && t.placement.weekday === weekday,
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
  const manual = await getManualJournalEntries(userId, ctx.localDate);
  return buildDailyJournal(manual, ctx);
}

export async function getWeekJournalSummary(
  userId: string,
  context: WeekJournalContext,
): Promise<WeekJournalSummary> {
  const [manualEntries, moods] = await Promise.all([
    getManualJournalEntriesForWeek(userId, context.weekStart),
    getMoodsForWeek(userId, context.weekStart),
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
      bathingSessions: sessionsForDate(context.bathingSessions, localDate),
      tasks: tasksForDate(context.tasks, localDate),
      mood: moods.get(localDate) ?? null,
      weightKg: weightForDate(context.weightPlan, localDate),
      work: context.workByDate.get(localDate) ?? null,
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
