import "server-only";

import { cardioKindMeta, isCardioKind } from "@/lib/cardio";
import {
  addDaysISO,
  localISOFromTimestamp,
  parseLocalISO,
  weekStartISO,
} from "@/lib/date";
import { UTGIFTER_CATEGORY_NAME } from "@/lib/expenses";
import type { InsightSession, InsightSpend, InsightWealth } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import type { LiveEventKind } from "@/lib/live-events";
import {
  balancesFromSnapshotRow,
  financeTotal,
  isSavingsTransferTaskKey,
  SAVINGS_TRANSFER_TASKS,
} from "@/lib/monthly-finance";
import { isMoodKey, type MoodKey } from "@/lib/mood";
import type { WorkKind } from "@/lib/work";
import { getWorkLogsInRange } from "@/lib/work.server";

export interface YearMovementDay {
  date: string;
  steps: number;
  activityHours: number;
  mood: MoodKey | null;
  moodNote: string | null;
  workKind: WorkKind | null;
}

/** Steps, activity, mood and work for every logged day in a calendar year. */
export async function getYearMovement(
  userId: string,
  year: number,
): Promise<YearMovementDay[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const supabase = await createClient();
  const [activityRes, moodRes, workByDate] = await Promise.all([
    supabase
      .from("daily_activity_logs")
      .select("local_date, steps, activity_hours")
      .eq("user_id", userId)
      .gte("local_date", start)
      .lte("local_date", end),
    supabase
      .from("mood_daily_logs")
      .select("local_date, mood, note")
      .eq("user_id", userId)
      .gte("local_date", start)
      .lte("local_date", end),
    getWorkLogsInRange(userId, start, end),
  ]);

  const byDate = new Map<string, YearMovementDay>();
  const ensure = (date: string): YearMovementDay => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const created: YearMovementDay = {
      date,
      steps: 0,
      activityHours: 0,
      mood: null,
      moodNote: null,
      workKind: null,
    };
    byDate.set(date, created);
    return created;
  };

  for (const row of activityRes.data ?? []) {
    const day = ensure(row.local_date);
    day.steps = row.steps ?? 0;
    day.activityHours =
      row.activity_hours == null ? 0 : Number(row.activity_hours);
  }
  for (const row of moodRes.data ?? []) {
    const day = ensure(row.local_date);
    day.mood = isMoodKey(row.mood) ? row.mood : null;
    day.moodNote = row.note;
  }
  for (const [date, work] of workByDate) {
    if (!work.startedAt || !work.kind) continue;
    if (date < start || date > end) continue;
    ensure(date).workKind = work.kind;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const LIVE_PROSE: Record<LiveEventKind, string> = {
  concert: "konserten",
  sport: "sportkvällen",
  race: "loppet",
  birthday: "födelsedagen",
  wedding: "bröllopet",
  other: "kvällen",
};

export function liveMomentLabel(kind: LiveEventKind, title: string): string {
  const name = title.trim();
  const short = name.length <= 42 ? name : `${name.slice(0, 41)}…`;
  return `${LIVE_PROSE[kind]} ${short}`;
}

/** Attended live events in a date range, as short prose fragments. */
export async function getAttendedLiveMoments(
  userId: string,
  start: string,
  end: string,
): Promise<{ date: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_events")
    .select("kind, title, event_date")
    .eq("user_id", userId)
    .not("attended_at", "is", null)
    .is("archived_at", null)
    .gte("event_date", start)
    .lte("event_date", end)
    .order("event_date", { ascending: true });

  return (data ?? []).map((row) => ({
    date: row.event_date,
    label: liveMomentLabel(row.kind, row.title),
  }));
}

export interface YearInsightExtras {
  sessions: InsightSession[];
  spends: InsightSpend[];
  wealth: InsightWealth | null;
}

function placementDate(weekStart: string, weekday: number | null): string | null {
  if (weekday == null) return null;
  return addDaysISO(weekStart, weekday - 1);
}

function inYear(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function worthFromRow(row: {
  kort: number | null;
  spar: number | null;
  isk: number | null;
  sbab_spar: number | null;
  avanza: number | null;
  krypto: number | null;
  cash: number | null;
  done_at: string | null;
  month_start: string;
}): { monthStart: string; totalKr: number } | null {
  if (!row.done_at) return null;
  const balances = balancesFromSnapshotRow(row);
  const filled = Object.values(balances).filter((value) => value != null);
  if (filled.length === 0) return null;
  return { monthStart: row.month_start, totalKr: financeTotal(balances) };
}

/** Done training, spends, savings and wealth for one calendar year. */
export async function getYearInsightExtras(
  userId: string,
  year: number,
): Promise<YearInsightExtras> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const fromWeek = weekStartISO(parseLocalISO(start));
  const toWeek = weekStartISO(parseLocalISO(end));
  const supabase = await createClient();

  const [
    gymPlacements,
    gymTemplates,
    cardioPlacements,
    sportPlacements,
    sportTemplates,
    bathPlacements,
    bathTemplates,
    weeklyTasks,
    categories,
    weeklyPlacements,
    monthlyTasks,
    monthlyCompletions,
    snapshots,
  ] = await Promise.all([
    supabase
      .from("gym_week_placements")
      .select("week_start, weekday, done_at, template_id")
      .eq("user_id", userId)
      .gte("week_start", fromWeek)
      .lte("week_start", toWeek)
      .not("done_at", "is", null),
    supabase
      .from("gym_session_templates")
      .select("id, label")
      .eq("user_id", userId),
    supabase
      .from("cardio_week_placements")
      .select("week_start, weekday, done_at, plan_kind, actual_kind")
      .eq("user_id", userId)
      .gte("week_start", fromWeek)
      .lte("week_start", toWeek)
      .not("done_at", "is", null),
    supabase
      .from("sport_week_placements")
      .select("week_start, weekday, done_at, template_id, plan_sport, actual_sport")
      .eq("user_id", userId)
      .gte("week_start", fromWeek)
      .lte("week_start", toWeek)
      .not("done_at", "is", null),
    supabase
      .from("sport_session_templates")
      .select("id, label")
      .eq("user_id", userId),
    supabase
      .from("bathing_week_placements")
      .select("week_start, weekday, done_at, template_id")
      .eq("user_id", userId)
      .gte("week_start", fromWeek)
      .lte("week_start", toWeek)
      .not("done_at", "is", null),
    supabase
      .from("bathing_session_templates")
      .select("id, label")
      .eq("user_id", userId),
    supabase
      .from("weekly_tasks")
      .select("id, title, completion_kind, category_id")
      .eq("user_id", userId)
      .in("completion_kind", ["shop", "expense"]),
    supabase.from("task_categories").select("id, name").eq("user_id", userId),
    supabase
      .from("weekly_task_placements")
      .select("task_id, done_at, shop_amount, shop_location, note")
      .eq("user_id", userId)
      .gte("week_start", fromWeek)
      .lte("week_start", toWeek)
      .not("done_at", "is", null)
      .not("shop_amount", "is", null),
    supabase
      .from("monthly_tasks")
      .select("id, key, title, completion_kind, category_id")
      .eq("user_id", userId),
    supabase
      .from("monthly_task_completions")
      .select("task_id, done_at, amount, note")
      .eq("user_id", userId)
      .gte("month_start", start)
      .lte("month_start", `${year}-12-01`)
      .not("done_at", "is", null)
      .not("amount", "is", null),
    supabase
      .from("monthly_finance_snapshots")
      .select(
        "month_start, kort, spar, isk, sbab_spar, avanza, krypto, cash, done_at",
      )
      .eq("user_id", userId)
      .gte("month_start", `${year - 1}-12-01`)
      .lte("month_start", `${year}-12-01`)
      .not("done_at", "is", null)
      .order("month_start", { ascending: true }),
  ]);

  const gymLabel = new Map(
    (gymTemplates.data ?? []).map((row) => [row.id, row.label]),
  );
  const sportLabel = new Map(
    (sportTemplates.data ?? []).map((row) => [row.id, row.label]),
  );
  const bathLabel = new Map(
    (bathTemplates.data ?? []).map((row) => [row.id, row.label]),
  );
  const sessions: InsightSession[] = [];
  const pushSession = (
    weekStart: string,
    weekday: number | null,
    doneAt: string | null,
    label: string,
    kind: InsightSession["kind"],
  ) => {
    if (!doneAt) return;
    const date = placementDate(weekStart, weekday);
    const name = label.trim();
    if (!date || !name || !inYear(date, start, end)) return;
    sessions.push({ date, label: name, kind });
  };

  for (const row of gymPlacements.data ?? []) {
    pushSession(
      row.week_start,
      row.weekday,
      row.done_at,
      gymLabel.get(row.template_id) || "Gym",
      "gym",
    );
  }
  for (const row of cardioPlacements.data ?? []) {
    const kind = isCardioKind(row.actual_kind)
      ? row.actual_kind
      : isCardioKind(row.plan_kind)
        ? row.plan_kind
        : null;
    pushSession(
      row.week_start,
      row.weekday,
      row.done_at,
      cardioKindMeta(kind)?.label || "Cardio",
      "cardio",
    );
  }
  for (const row of sportPlacements.data ?? []) {
    pushSession(
      row.week_start,
      row.weekday,
      row.done_at,
      row.actual_sport?.trim() ||
        row.plan_sport?.trim() ||
        sportLabel.get(row.template_id) ||
        "Sport",
      "sport",
    );
  }
  for (const row of bathPlacements.data ?? []) {
    pushSession(
      row.week_start,
      row.weekday,
      row.done_at,
      bathLabel.get(row.template_id) || "Bad",
      "bath",
    );
  }

  const categoryName = new Map(
    (categories.data ?? []).map((row) => [row.id, row.name]),
  );
  const weeklyById = new Map((weeklyTasks.data ?? []).map((row) => [row.id, row]));
  const spends: InsightSpend[] = [];
  for (const row of weeklyPlacements.data ?? []) {
    const task = weeklyById.get(row.task_id);
    if (!task || row.shop_amount == null || !row.done_at) continue;
    const date = localISOFromTimestamp(row.done_at);
    if (!inYear(date, start, end) || row.shop_amount <= 0) continue;
    const category = task.category_id
      ? categoryName.get(task.category_id)
      : null;
    const kind =
      task.completion_kind === "expense" || category === UTGIFTER_CATEGORY_NAME
        ? "expense"
        : "shopping";
    const label =
      row.shop_location?.trim() || row.note?.trim() || task.title.trim();
    if (!label) continue;
    spends.push({ date, amountKr: row.shop_amount, label, kind });
  }

  const monthlyById = new Map(
    (monthlyTasks.data ?? []).map((row) => [row.id, row]),
  );
  for (const row of monthlyCompletions.data ?? []) {
    const task = monthlyById.get(row.task_id);
    if (!task || row.amount == null || !row.done_at || row.amount <= 0) continue;
    const date = localISOFromTimestamp(row.done_at);
    if (!inYear(date, start, end)) continue;
    if (isSavingsTransferTaskKey(task.key)) {
      spends.push({
        date,
        amountKr: row.amount,
        label: SAVINGS_TRANSFER_TASKS[task.key].title,
        kind: "saving",
      });
      continue;
    }
    const category = task.category_id
      ? categoryName.get(task.category_id)
      : null;
    if (task.completion_kind === "amount" && category === UTGIFTER_CATEGORY_NAME) {
      const label = row.note?.trim() || task.title.trim();
      if (!label) continue;
      spends.push({ date, amountKr: row.amount, label, kind: "expense" });
    }
  }

  const points = (snapshots.data ?? [])
    .map(worthFromRow)
    .filter((point): point is { monthStart: string; totalKr: number } => point != null)
    .filter((point) => point.monthStart <= end);
  const latest = [...points].reverse().find((point) => point.monthStart >= start) ?? null;
  const earlier = latest
    ? points.filter((point) => point.monthStart < latest.monthStart)
    : [];
  const previous = earlier[0] ?? null;
  const wealth: InsightWealth | null = latest
    ? {
        totalKr: latest.totalKr,
        asOf: latest.monthStart,
        previousKr: previous?.totalKr ?? null,
        previousAsOf: previous?.monthStart ?? null,
      }
    : null;

  return { sessions, spends, wealth };
}
