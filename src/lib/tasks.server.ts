import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, DISPLAY_TIMEZONE, isoWeekdayFromLocalISO, parseLocalISO, todayLocalISO, weekStartISO } from "@/lib/date";
import {
  dedupeMonthlyTasks,
  expandWeeklyTaskPlacements,
  FEST_TASK_KEY,
  isRepeatableWeeklyTaskKey,
  isWeeklyTaskRepeatable,
  monthlyTaskKeeperScore,
  REPEATABLE_WEEKLY_TASK_GOAL,
  type MonthlyCompletion,
  type MonthlyTask,
  type MonthlyTaskCompletionKind,
  type MonthlyTaskForMonth,
  type TaskCategory,
  type TaskScope,
  type Weekday,
  type WeeklyPlacement,
  type WeeklyTask,
  type WeeklyTaskChecklistItem,
  type WeeklyTaskChecklistCompletion,
  type WeeklyTaskForWeek,
  type WeeklyTaskCompletionKind,
  type MusicLogKind,
  musicActivityFromLegacyKey,
  parseMusicActivity,
  parseSpendKind,
} from "@/lib/tasks";
import {
  balancesFromSnapshotRow,
  SAVINGS_TRANSFER_TASKS,
  type MonthlyFinanceBalances,
  type MonthlyFinanceSnapshot,
} from "@/lib/monthly-finance";
import {
  effectiveScheduledDay,
  monthStartFromDate,
  monthlyTasksOnLocalDate,
} from "@/lib/monthly-bills";
import { repairAmountCompletionsMissingDone } from "@/app/(app)/tasks-actions";
import { parseGameKind, type GameKind } from "@/lib/games";
import { ensureDefaultUserGames } from "@/lib/games.server";

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  scope: TaskScope;
  name: string;
  icon: string;
  accent: string;
  sort_order: number;
  weekly_goal?: number | null;
}

function rowToCategory(r: CategoryRow): TaskCategory {
  return {
    id: r.id,
    scope: r.scope,
    name: r.name,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    weeklyGoal:
      r.weekly_goal != null
        ? Math.max(1, Math.min(14, r.weekly_goal))
        : null,
  };
}

/** All active categories for the user, optionally filtered by scope. */
export async function getCategories(
  userId: string,
  scope?: TaskScope,
): Promise<TaskCategory[]> {
  const supabase = await createClient();
  let q = supabase
    .from("task_categories")
    .select("id, scope, name, icon, accent, sort_order, weekly_goal")
    .eq("user_id", userId)
    .is("archived_at", null);
  if (scope) q = q.eq("scope", scope);
  q = q.order("scope", { ascending: true }).order("sort_order", { ascending: true });
  const { data } = await q;
  return (data ?? []).map(rowToCategory);
}

// ----------------------------------------------------------------------------
// Weekly tasks
// ----------------------------------------------------------------------------

interface WeeklyTaskRow {
  id: string;
  category_id: string | null;
  key: string | null;
  title: string;
  notes: string | null;
  icon: string;
  accent: string;
  sort_order: number;
  default_weekday: number | null;
  completion_kind: string;
  single_week_start: string | null;
  enabled: boolean;
  is_repeatable?: boolean | null;
  weekly_goal?: number | null;
}

function rowToWeekly(r: WeeklyTaskRow): WeeklyTask {
  const legacyRepeatable = isRepeatableWeeklyTaskKey(r.key);
  return {
    id: r.id,
    categoryId: r.category_id,
    key: r.key,
    title: r.title,
    notes: r.notes,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    completionKind: r.completion_kind as WeeklyTask["completionKind"],
    defaultWeekday: r.default_weekday as Weekday | null,
    singleWeekStart: r.single_week_start,
    enabled: r.enabled ?? true,
    isRepeatable: r.is_repeatable ?? legacyRepeatable,
    weeklyGoal:
      r.weekly_goal != null
        ? Math.max(1, Math.min(14, r.weekly_goal))
        : REPEATABLE_WEEKLY_TASK_GOAL,
  };
}

function isActiveWeeklyRow(r: WeeklyTaskRow): boolean {
  return r.single_week_start != null || (r.enabled ?? true);
}

function weekStartFromCreatedAt(createdAt: string): string {
  const local = new Date(createdAt).toLocaleDateString("en-CA", {
    timeZone: DISPLAY_TIMEZONE,
  });
  return weekStartISO(parseLocalISO(local));
}

/**
 * Fixes one-offs pinned to a later week than when they were created (carryOver bug).
 * Runs on every week load so existing bad rows heal without manual SQL.
 */
async function repairMisplacedOneOffWeekPins(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("weekly_tasks")
    .select("id, created_at, single_week_start")
    .eq("user_id", userId)
    .is("archived_at", null)
    .not("single_week_start", "is", null);

  const toRepair: { id: string; weekStart: string }[] = [];
  for (const row of rows ?? []) {
    if (!row.single_week_start) continue;
    const createdWeek = weekStartFromCreatedAt(row.created_at);
    if (row.single_week_start > createdWeek) {
      toRepair.push({ id: row.id, weekStart: createdWeek });
    }
  }
  if (toRepair.length === 0) return;

  const byWeek = new Map<string, string[]>();
  for (const row of toRepair) {
    const list = byWeek.get(row.weekStart) ?? [];
    list.push(row.id);
    byWeek.set(row.weekStart, list);
  }

  for (const [correctWeek, taskIds] of byWeek) {
    await supabase
      .from("weekly_tasks")
      .update({ single_week_start: correctWeek })
      .eq("user_id", userId)
      .in("id", taskIds);

    const { data: existingPlacements } = await supabase
      .from("weekly_task_placements")
      .select("task_id")
      .eq("user_id", userId)
      .eq("week_start", correctWeek)
      .in("task_id", taskIds);

    const hasPlacement = new Set(
      (existingPlacements ?? []).map((p) => p.task_id),
    );
    const missingIds = taskIds.filter((id) => !hasPlacement.has(id));
    if (missingIds.length === 0) continue;

    const { data: sourcePlacements } = await supabase
      .from("weekly_task_placements")
      .select("task_id, weekday, day_sort_order, week_start")
      .eq("user_id", userId)
      .in("task_id", missingIds)
      .order("week_start", { ascending: true });

    const sourceByTask = new Map<
      string,
      { weekday: number | null; day_sort_order: number }
    >();
    for (const p of sourcePlacements ?? []) {
      if (!sourceByTask.has(p.task_id)) {
        sourceByTask.set(p.task_id, {
          weekday: p.weekday,
          day_sort_order: p.day_sort_order ?? 0,
        });
      }
    }

    await supabase.from("weekly_task_placements").insert(
      missingIds.map((taskId) => {
        const src = sourceByTask.get(taskId);
        return {
          user_id: userId,
          task_id: taskId,
          week_start: correctWeek,
          weekday: src?.weekday ?? null,
          day_sort_order: src?.day_sort_order ?? 0,
        };
      }),
    );
  }
}

interface WeeklyPlacementRow {
  id: string;
  task_id: string;
  week_start: string;
  weekday: number | null;
  day_sort_order: number;
  done_at: string | null;
  plan_note: string | null;
  note: string | null;
  shop_location: string | null;
  shop_amount: number | null;
  shop_amount_expr: string | null;
  spend_kind: string | null;
  laundry_loads: number | null;
  laundry_booked_from_id: string | null;
  band: string | null;
  music_activity: string | null;
  plan_todo: string | null;
  music_log_kind: string | null;
  gig_id: string | null;
  live_event_id: string | null;
  on_hold: boolean;
  coding_project_id: string | null;
  game_id: string | null;
}

function rowToPlacement(
  r: WeeklyPlacementRow,
  extras?: {
    projectTitleById?: Map<string, string>;
    gameById?: Map<string, { title: string; kind: GameKind | null; icon: string }>;
  },
): WeeklyPlacement {
  const game = r.game_id ? extras?.gameById?.get(r.game_id) : undefined;
  return {
    id: r.id,
    taskId: r.task_id,
    weekStart: r.week_start,
    weekday: r.weekday as Weekday | null,
    daySortOrder: r.day_sort_order ?? 0,
    doneAt: r.done_at,
    planNote: r.plan_note,
    note: r.note,
    shopLocation: r.shop_location,
    shopAmount: r.shop_amount != null ? Number(r.shop_amount) : null,
    shopAmountExpr: r.shop_amount_expr,
    spendKind: parseSpendKind(r.spend_kind),
    laundryLoads: r.laundry_loads,
    laundryBookedFromId: r.laundry_booked_from_id,
    musicActivity: parseMusicActivity(r.music_activity),
    planTodo: r.plan_todo,
    band: r.band,
    musicLogKind: (r.music_log_kind as MusicLogKind | null) ?? null,
    gigId: r.gig_id,
    liveEventId: r.live_event_id,
    onHold: r.on_hold ?? false,
    codingProjectId: r.coding_project_id,
    codingProjectTitle: r.coding_project_id
      ? (extras?.projectTitleById?.get(r.coding_project_id) ?? null)
      : null,
    gameId: r.game_id,
    gameTitle: game?.title ?? null,
    gameKind: game?.kind ?? null,
    gameIcon: game?.icon ?? null,
  };
}

interface ChecklistRow {
  id: string;
  task_id: string;
  text: string;
  sort_order: number;
}

function rowToChecklistItem(r: ChecklistRow): WeeklyTaskChecklistItem {
  return {
    id: r.id,
    taskId: r.task_id,
    text: r.text,
    sortOrder: r.sort_order,
    completion: null,
  };
}

interface ChecklistCompletionRow {
  id: string;
  checklist_item_id: string;
  local_date: string;
  note: string | null;
  done_at: string;
}

function rowToChecklistCompletion(
  r: ChecklistCompletionRow,
): WeeklyTaskChecklistCompletion {
  return {
    id: r.id,
    checklistItemId: r.checklist_item_id,
    localDate: r.local_date,
    note: r.note,
    doneAt: r.done_at,
  };
}

function attachChecklistCompletionsForDate(
  tasks: WeeklyTaskForWeek[],
  localDate: string,
): WeeklyTaskForWeek[] {
  return tasks.map((task) => ({
    ...task,
    checklist: task.checklist.map((item) => ({
      ...item,
      completion:
        task.checklistCompletions.find(
          (c) => c.checklistItemId === item.id && c.localDate === localDate,
        ) ?? null,
    })),
  }));
}

const WEEKLY_TASK_SELECT =
  "id, category_id, key, title, notes, icon, accent, sort_order, default_weekday, completion_kind, single_week_start, enabled, is_repeatable, weekly_goal";

const WEEKLY_PLACEMENT_SELECT =
  "id, task_id, week_start, weekday, day_sort_order, done_at, plan_note, note, shop_location, shop_amount, shop_amount_expr, spend_kind, laundry_loads, laundry_booked_from_id, band, music_activity, plan_todo, music_log_kind, gig_id, live_event_id, on_hold, coding_project_id, game_id";

const CHECKLIST_SELECT = "id, task_id, text, sort_order";

const CHECKLIST_COMPLETION_SELECT =
  "id, checklist_item_id, local_date, note, done_at";

const REPEATABLE_CANONICAL: Array<{
  key: string;
  legacyLike: string;
  title: string;
  notes: string;
  icon: string;
  accent: string;
  completionKind: WeeklyTaskCompletionKind;
  categoryName: string;
  sortOrder: number;
  weeklyGoal?: number;
}> = [
  {
    key: "dev_code",
    legacyLike: "dev_code_%",
    title: "Kodning",
    notes:
      "Dra in hur många kodpass du vill — minst 2 per vecka. Anteckna vad du gjorde; projekt är valfritt.",
    icon: "💻",
    accent: "#5fb6ff",
    completionKind: "journal",
    categoryName: "DEV",
    sortOrder: 0,
  },
  {
    key: "home_handla",
    legacyLike: "home_handla_%",
    title: "Handla",
    notes:
      "Dra in hur många handlingar du vill — minst 2 per vecka. Välj mat, privat eller delat, och ange butik och summa när du är klar.",
    icon: "🛒",
    accent: "#6ee7a3",
    completionKind: "shop",
    categoryName: "HOME",
    sortOrder: 1,
  },
  {
    key: "home_projekt",
    legacyLike: "home_projekt_%",
    title: "Hemmaprojekt",
    notes:
      "Dra in hur många hemmaprojekt du vill. Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.",
    icon: "🔨",
    accent: "#6ee7a3",
    completionKind: "journal",
    categoryName: "HOME",
    sortOrder: 3,
    weeklyGoal: 1,
  },
  {
    key: "life_ring_mamma",
    legacyLike: "life_ring_mamma_%",
    title: "Ring mamma",
    notes: "Dra in hur många samtal du vill — minst 2 per vecka.",
    icon: "📞",
    accent: "#f472b6",
    completionKind: "journal",
    categoryName: "Livet",
    sortOrder: 0,
  },
  {
    key: "music",
    legacyLike: "music_%",
    title: "Musik",
    notes:
      "Dra in hur många musikpass du vill — minst 2 per vecka. Välj vad du ska göra när du planerar.",
    icon: "🎵",
    accent: "#e879f9",
    completionKind: "music",
    categoryName: "MUSIC",
    sortOrder: 0,
  },
];

async function backfillMusicActivityFromLegacyKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  await supabase
    .from("weekly_tasks")
    .update({ archived_at: null })
    .eq("user_id", userId)
    .eq("key", "music");

  const { data: tasks } = await supabase
    .from("weekly_tasks")
    .select("id, key")
    .eq("user_id", userId)
    .like("key", "music%");
  for (const task of tasks ?? []) {
    const fromKey = musicActivityFromLegacyKey(task.key);
    if (task.key === "music_live") {
      await supabase
        .from("weekly_task_placements")
        .update({ music_activity: "spelning" })
        .eq("user_id", userId)
        .eq("task_id", task.id)
        .eq("music_log_kind", "gig")
        .is("music_activity", null);
      await supabase
        .from("weekly_task_placements")
        .update({ music_activity: "live" })
        .eq("user_id", userId)
        .eq("task_id", task.id)
        .is("music_activity", null);
      continue;
    }
    if (!fromKey) continue;
    await supabase
      .from("weekly_task_placements")
      .update({ music_activity: fromKey })
      .eq("user_id", userId)
      .eq("task_id", task.id)
      .is("music_activity", null);
  }
}

/**
 * Promote legacy numbered slots (dev_code_1/2, …) into one repeatable task
 * and archive leftovers — same idea as bathing ensureBadTemplate.
 */
export async function ensureRepeatableWeeklyTasks(
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  await backfillMusicActivityFromLegacyKeys(supabase, userId);

  for (const spec of REPEATABLE_CANONICAL) {
    let canonicalId: string | null = null;

    const { data: canonical } = await supabase
      .from("weekly_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("key", spec.key)
      .is("archived_at", null)
      .maybeSingle();
    if (canonical) canonicalId = canonical.id;

    if (!canonicalId) {
      const { data: legacy } = await supabase
        .from("weekly_tasks")
        .select("id")
        .eq("user_id", userId)
        .like("key", spec.legacyLike)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (legacy) {
        const { error } = await supabase
          .from("weekly_tasks")
          .update({
            key: spec.key,
            title: spec.title,
            notes: spec.notes,
            icon: spec.icon,
            accent: spec.accent,
            completion_kind: spec.completionKind,
            default_weekday: null,
            sort_order: spec.sortOrder,
            is_repeatable: true,
            weekly_goal: spec.weeklyGoal ?? REPEATABLE_WEEKLY_TASK_GOAL,
          })
          .eq("id", legacy.id)
          .eq("user_id", userId);
        if (!error) canonicalId = legacy.id;
      }
    }

    if (!canonicalId) {
      const { data: category } = await supabase
        .from("task_categories")
        .select("id")
        .eq("user_id", userId)
        .eq("scope", "task")
        .eq("name", spec.categoryName)
        .is("archived_at", null)
        .maybeSingle();

      const { data: created, error } = await supabase
        .from("weekly_tasks")
        .insert({
          user_id: userId,
          category_id: category?.id ?? null,
          key: spec.key,
          title: spec.title,
          notes: spec.notes,
          icon: spec.icon,
          accent: spec.accent,
          sort_order: spec.sortOrder,
          default_weekday: null,
          completion_kind: spec.completionKind,
          is_repeatable: true,
          weekly_goal: spec.weeklyGoal ?? REPEATABLE_WEEKLY_TASK_GOAL,
        })
        .select("id")
        .maybeSingle();
      if (!error && created) canonicalId = created.id;
    }

    if (!canonicalId) continue;

    await supabase
      .from("weekly_tasks")
      .update({
        title: spec.title,
        notes: spec.notes,
        default_weekday: null,
        is_repeatable: true,
        weekly_goal: spec.weeklyGoal ?? REPEATABLE_WEEKLY_TASK_GOAL,
      })
      .eq("id", canonicalId)
      .eq("user_id", userId);

    const { data: leftovers } = await supabase
      .from("weekly_tasks")
      .select("id")
      .eq("user_id", userId)
      .is("archived_at", null)
      .neq("id", canonicalId)
      .or(`key.eq.${spec.key},key.like.${spec.legacyLike}`);

    for (const leftover of leftovers ?? []) {
      await supabase
        .from("weekly_task_placements")
        .update({ task_id: canonicalId })
        .eq("user_id", userId)
        .eq("task_id", leftover.id);
      await supabase
        .from("weekly_tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", leftover.id)
        .eq("user_id", userId);
    }
  }
}

export async function getWeeklyTasks(userId: string): Promise<WeeklyTask[]> {
  await ensureGameWeeklyTask(userId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_tasks")
    .select(WEEKLY_TASK_SELECT)
    .eq("user_id", userId)
    .is("archived_at", null)
    // Exclude one-off (single-week) tasks from the permanent template list.
    .is("single_week_start", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToWeekly);
}

export interface WeekSummary {
  weekStart: string;
  tasks: WeeklyTaskForWeek[];
  categories: TaskCategory[];
}

/**
 * Returns all of the user's active weekly tasks merged with their placement
 * for the given week. Tasks without a placement sit in the backlog.
 */
/**
 * Rolls incomplete one-off tasks from earlier weeks into the current week so they
 * can be planned. Only runs when loading the current week's plan — browsing a
 * future week must not re-pin one-offs to that future week.
 */
async function carryOverIncompleteOneOffTasks(
  userId: string,
  weekStart: string,
): Promise<void> {
  const todayWeekStart = weekStartISO(parseLocalISO(todayLocalISO()));
  if (weekStart !== todayWeekStart) return;

  const supabase = await createClient();
  const { data: staleOneOffs } = await supabase
    .from("weekly_tasks")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null)
    .not("single_week_start", "is", null)
    .lt("single_week_start", todayWeekStart);

  if (!staleOneOffs?.length) return;

  const taskIds = staleOneOffs.map((t) => t.id);
  const { data: donePlacements } = await supabase
    .from("weekly_task_placements")
    .select("task_id")
    .eq("user_id", userId)
    .in("task_id", taskIds)
    .not("done_at", "is", null);

  const completedIds = new Set((donePlacements ?? []).map((p) => p.task_id));
  const toCarryIds = taskIds.filter((id) => !completedIds.has(id));
  if (toCarryIds.length === 0) return;

  await supabase
    .from("weekly_tasks")
    .update({ single_week_start: todayWeekStart })
    .eq("user_id", userId)
    .in("id", toCarryIds);

  const { data: existingPlacements } = await supabase
    .from("weekly_task_placements")
    .select("task_id, on_hold")
    .eq("user_id", userId)
    .eq("week_start", todayWeekStart)
    .in("task_id", toCarryIds);

  const hasPlacement = new Set((existingPlacements ?? []).map((p) => p.task_id));

  const { data: sourcePlacements } = await supabase
    .from("weekly_task_placements")
    .select("task_id, on_hold, week_start")
    .eq("user_id", userId)
    .in("task_id", toCarryIds)
    .order("week_start", { ascending: false });

  const onHoldByTask = new Map<string, boolean>();
  for (const p of sourcePlacements ?? []) {
    if (!onHoldByTask.has(p.task_id)) {
      onHoldByTask.set(p.task_id, p.on_hold ?? false);
    }
  }

  const toInsert = toCarryIds
    .filter((id) => !hasPlacement.has(id))
    .map((taskId) => ({
      user_id: userId,
      task_id: taskId,
      week_start: todayWeekStart,
      weekday: null,
      day_sort_order: 0,
      on_hold: onHoldByTask.get(taskId) ?? false,
    }));

  if (toInsert.length > 0) {
    await supabase.from("weekly_task_placements").insert(toInsert);
  }
}

async function ensureGameWeeklyTask(userId: string): Promise<void> {
  const supabase = await createClient();
  await ensureDefaultUserGames(userId);

  const GAME_NOTES =
    "Dra in hur många spelsessioner du vill — minst 1 per vecka. Välj spel och logga efteråt.";

  const { data: canonical } = await supabase
    .from("weekly_tasks")
    .select("id, archived_at")
    .eq("user_id", userId)
    .eq("key", "game")
    .maybeSingle();

  const { data: legacy } = await supabase
    .from("weekly_tasks")
    .select("id, archived_at")
    .eq("user_id", userId)
    .eq("key", "game_dnd")
    .maybeSingle();

  let categoryId: string | null = null;
  const { data: category } = await supabase
    .from("task_categories")
    .select("id")
    .eq("user_id", userId)
    .eq("scope", "task")
    .eq("name", "SPEL")
    .is("archived_at", null)
    .maybeSingle();

  if (category) {
    categoryId = category.id;
  } else {
    const { data: created } = await supabase
      .from("task_categories")
      .insert({
        user_id: userId,
        scope: "task",
        name: "SPEL",
        icon: "🎲",
        accent: "#a78bfa",
        sort_order: 5,
      })
      .select("id")
      .maybeSingle();
    categoryId = created?.id ?? null;
  }

  const patch = {
    archived_at: null,
    title: "Spel",
    notes: GAME_NOTES,
    icon: "🎲",
    accent: "#a78bfa",
    completion_kind: "journal" as const,
    is_repeatable: true,
    category_id: categoryId,
    sort_order: 0,
    key: "game",
  };

  if (canonical) {
    await supabase
      .from("weekly_tasks")
      .update(patch)
      .eq("id", canonical.id)
      .eq("user_id", userId);
    if (legacy && legacy.id !== canonical.id) {
      await supabase
        .from("weekly_task_placements")
        .update({ task_id: canonical.id })
        .eq("user_id", userId)
        .eq("task_id", legacy.id);
      await supabase
        .from("weekly_tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", legacy.id)
        .eq("user_id", userId);
    }
    return;
  }

  if (legacy) {
    await supabase
      .from("weekly_tasks")
      .update(patch)
      .eq("id", legacy.id)
      .eq("user_id", userId);
    return;
  }

  await supabase.from("weekly_tasks").insert({
    user_id: userId,
    ...patch,
    default_weekday: null,
    weekly_goal: 1,
  });
}

export async function getWeekSummary(
  userId: string,
  weekStart: string,
): Promise<WeekSummary> {
  await repairMisplacedOneOffWeekPins(userId);
  await carryOverIncompleteOneOffTasks(userId, weekStart);
  await ensureRepeatableWeeklyTasks(userId);
  await ensureGameWeeklyTask(userId);

  const weekEnd = addDaysISO(weekStart, 6);
  const supabase = await createClient();
  const [tasksRes, placementsRes, catsRes, checklistRes, checklistCompletionsRes, doneCustomRes] =
    await Promise.all([
    supabase
      .from("weekly_tasks")
      .select(WEEKLY_TASK_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      // Permanent templates (single_week_start null) plus one-offs for THIS week.
      .or(`single_week_start.is.null,single_week_start.eq.${weekStart}`)
      .order("sort_order", { ascending: true }),
    supabase
      .from("weekly_task_placements")
      .select(WEEKLY_PLACEMENT_SELECT)
      .eq("user_id", userId)
      .eq("week_start", weekStart),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order, weekly_goal")
      .eq("user_id", userId)
      .eq("scope", "task")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("weekly_task_checklist_items")
      .select(CHECKLIST_SELECT)
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("weekly_task_checklist_completions")
      .select(CHECKLIST_COMPLETION_SELECT)
      .eq("user_id", userId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    supabase
      .from("weekly_task_placements")
      .select("task_id")
      .eq("user_id", userId)
      .not("done_at", "is", null),
  ]);

  const taskRows = tasksRes.data ?? [];
  const taskById = new Map(taskRows.map((r) => [r.id, r]));
  const everCompletedCustom = new Set<string>();
  for (const row of doneCustomRes.data ?? []) {
    const t = taskById.get(row.task_id);
    if (t && t.key == null && t.single_week_start == null) {
      everCompletedCustom.add(row.task_id);
    }
  }

  function includeWeeklyTask(row: WeeklyTaskRow): boolean {
    if (!isActiveWeeklyRow(row)) return false;
    if (row.key != null || row.single_week_start != null) return true;
    return !everCompletedCustom.has(row.id);
  }

  const projectIds = [
    ...new Set(
      (placementsRes.data ?? [])
        .map((r) => r.coding_project_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const projectTitleById = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("coding_projects")
      .select("id, title")
      .eq("user_id", userId)
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectTitleById.set(p.id, p.title);
    }
  }

  const gameIds = [
    ...new Set(
      (placementsRes.data ?? [])
        .map((r) => r.game_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const gameById = new Map<
    string,
    { title: string; kind: GameKind | null; icon: string }
  >();
  if (gameIds.length > 0) {
    const { data: games } = await supabase
      .from("user_games")
      .select("id, title, kind, icon")
      .eq("user_id", userId)
      .in("id", gameIds);
    for (const g of games ?? []) {
      gameById.set(g.id, {
        title: g.title,
        kind: parseGameKind(g.kind),
        icon: g.icon,
      });
    }
  }

  const placementExtras = { projectTitleById, gameById };

  const placementsByTask = new Map<string, WeeklyPlacement[]>();
  for (const row of placementsRes.data ?? []) {
    const list = placementsByTask.get(row.task_id) ?? [];
    list.push(rowToPlacement(row, placementExtras));
    placementsByTask.set(row.task_id, list);
  }

  // Non-repeatable tasks should have at most one placement per week. After the
  // unique constraint was dropped for repeatables, duplicates can linger and
  // break React keys / unplace. Keep the best row and delete the rest.
  const duplicatePlacementIds: string[] = [];
  for (const row of taskRows) {
    if (isWeeklyTaskRepeatable(rowToWeekly(row))) continue;
    // Booking + wash can legitimately be two laundry rows in one week.
    if (row.completion_kind === "laundry") continue;
    const list = placementsByTask.get(row.id);
    if (!list || list.length <= 1) continue;
    const ranked = [...list].sort((a, b) => {
      const score = (p: WeeklyPlacement) => {
        let s = 0;
        if (p.doneAt) s += 8;
        if (p.weekday != null && !p.onHold) s += 4;
        if (!p.onHold) s += 2;
        if (p.weekday != null) s += 1;
        return s;
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return a.daySortOrder - b.daySortOrder;
    });
    const keeper = ranked[0]!;
    placementsByTask.set(row.id, [keeper]);
    for (const extra of ranked.slice(1)) {
      duplicatePlacementIds.push(extra.id);
    }
  }
  if (duplicatePlacementIds.length > 0) {
    await supabase
      .from("weekly_task_placements")
      .delete()
      .eq("user_id", userId)
      .in("id", duplicatePlacementIds);
  }

  const checklistByTask = new Map<string, WeeklyTaskChecklistItem[]>();
  for (const row of checklistRes.data ?? []) {
    const list = checklistByTask.get(row.task_id) ?? [];
    list.push(rowToChecklistItem(row));
    checklistByTask.set(row.task_id, list);
  }

  const checklistItemToTask = new Map<string, string>();
  for (const [taskId, items] of checklistByTask) {
    for (const item of items) {
      checklistItemToTask.set(item.id, taskId);
    }
  }

  const completionsByTask = new Map<string, WeeklyTaskChecklistCompletion[]>();
  for (const row of checklistCompletionsRes.data ?? []) {
    const taskId = checklistItemToTask.get(row.checklist_item_id);
    if (!taskId) continue;
    const list = completionsByTask.get(taskId) ?? [];
    list.push(rowToChecklistCompletion(row));
    completionsByTask.set(taskId, list);
  }

  const dayOrderCursor = new Map<number, number>();
  for (const list of placementsByTask.values()) {
    for (const p of list) {
      if (p.weekday != null) {
        const next =
          Math.max(dayOrderCursor.get(p.weekday) ?? -1, p.daySortOrder) + 1;
        dayOrderCursor.set(p.weekday, next);
      }
    }
  }

  const toInsert: {
    user_id: string;
    task_id: string;
    week_start: string;
    weekday: number | null;
    day_sort_order: number;
  }[] = [];

  for (const row of taskRows) {
    if (!includeWeeklyTask(row)) continue;
    const existing = placementsByTask.get(row.id) ?? [];
    if (existing.length > 0) continue;
    // Repeatable tasks stay as backlog sources until dragged — no auto-placement.
    if (isWeeklyTaskRepeatable(rowToWeekly(row))) continue;
    const wd = row.default_weekday;
    let daySortOrder = 0;
    if (wd != null) {
      daySortOrder = dayOrderCursor.get(wd) ?? 0;
      dayOrderCursor.set(wd, daySortOrder + 1);
    }
    toInsert.push({
      user_id: userId,
      task_id: row.id,
      week_start: weekStart,
      weekday: wd,
      day_sort_order: daySortOrder,
    });
  }

  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("weekly_task_placements")
      .insert(toInsert)
      .select(WEEKLY_PLACEMENT_SELECT);
    for (const row of inserted ?? []) {
      const list = placementsByTask.get(row.task_id) ?? [];
      list.push(rowToPlacement(row, placementExtras));
      placementsByTask.set(row.task_id, list);
    }
  }

  const tasks: WeeklyTaskForWeek[] = taskRows
    .filter(includeWeeklyTask)
    .map((row) => {
      const placements = placementsByTask.get(row.id) ?? [];
      const primary =
        placements.find((p) => p.weekday != null && !p.onHold) ??
        placements[0] ??
        null;
      return {
        ...rowToWeekly(row),
        placement: primary,
        placements,
        checklist: checklistByTask.get(row.id) ?? [],
        checklistCompletions: completionsByTask.get(row.id) ?? [],
      };
    });

  const categories = (catsRes.data ?? []).map(rowToCategory);
  return { weekStart, tasks, categories };
}

export interface WeeklyTasksDaySummary {
  localDate: string;
  weekStart: string;
  weekday: Weekday;
  tasks: WeeklyTaskForWeek[];
  /** All tasks in the ISO week (for journal / done-on-day lookup). */
  weekTasks: WeeklyTaskForWeek[];
  /** One-off tasks paused for this week. */
  onHoldTasks: WeeklyTaskForWeek[];
  categories: TaskCategory[];
}

/** Weekly tasks placed on the weekday of `localDate` (within that ISO week). */
export async function getWeeklyTasksForDate(
  userId: string,
  localDate: string,
): Promise<WeeklyTasksDaySummary> {
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  const { tasks, categories } = await getWeekSummary(userId, weekStart);
  const withCompletions = attachChecklistCompletionsForDate(tasks, localDate);
  const expanded = expandWeeklyTaskPlacements(withCompletions);
  const forDay = expanded
    .filter(
      (t) =>
        t.placement?.weekday != null &&
        t.placement.weekday === weekday &&
        !t.placement.onHold,
    )
    .sort((a, b) => {
      const ao = a.placement?.daySortOrder ?? a.sortOrder;
      const bo = b.placement?.daySortOrder ?? b.sortOrder;
      return ao - bo;
    });
  const onHoldTasks = withCompletions.filter(
    (t) =>
      t.singleWeekStart != null &&
      t.placement?.onHold === true &&
      !t.placement?.doneAt,
  );
  return {
    localDate,
    weekStart,
    weekday,
    tasks: forDay,
    weekTasks: expandWeeklyTaskPlacements(withCompletions),
    onHoldTasks,
    categories,
  };
}

export interface MonthlyTasksDaySummary {
  localDate: string;
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
}

/** Monthly tasks scheduled on the calendar day of `localDate`. */
export async function getMonthlyTasksForDate(
  userId: string,
  localDate: string,
): Promise<MonthlyTasksDaySummary> {
  const monthStart = monthStartFromDate(localDate);
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const [monthSummary, billsWeek] = await Promise.all([
    getMonthTaskSummary(userId, monthStart),
    getMonthlyBillsForWeek(userId, weekStart),
  ]);

  const tasksById = new Map(monthSummary.tasks.map((t) => [t.id, t]));
  for (const task of billsWeek.tasks) {
    if (!tasksById.has(task.id)) tasksById.set(task.id, task);
  }

  const mergedTasks = [...tasksById.values()].map((task) => {
    const all =
      billsWeek.completionsByTaskMonth.get(`${task.id}|${monthStart}`) ??
      task.completions ??
      [];
    return {
      ...task,
      completion:
        all.find((c) => !c.isInstance) ??
        all[0] ??
        task.completion ??
        null,
      completions: all.length > 0 ? all : task.completions,
    };
  });

  const forDay = monthlyTasksOnLocalDate(
    mergedTasks,
    localDate,
    billsWeek.completionsByTaskMonth,
    { includeWhenDone: true },
  );

  return { localDate, monthStart, tasks: forDay, categories: monthSummary.categories };
}

// ----------------------------------------------------------------------------
// Monthly tasks
// ----------------------------------------------------------------------------

interface MonthlyTaskRow {
  id: string;
  category_id: string | null;
  key: string | null;
  title: string;
  notes: string | null;
  day_of_month: number | null;
  icon: string;
  accent: string;
  sort_order: number;
  completion_kind: string;
  single_month_start: string | null;
  default_amount_kr: number | null;
  enabled: boolean;
  is_repeatable: boolean;
}

function rowToMonthly(r: MonthlyTaskRow): MonthlyTask {
  return {
    id: r.id,
    categoryId: r.category_id,
    key: r.key,
    title: r.title,
    notes: r.notes,
    dayOfMonth: r.day_of_month,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    completionKind: r.completion_kind as MonthlyTaskCompletionKind,
    singleMonthStart: r.single_month_start,
    defaultAmountKr:
      r.default_amount_kr != null ? Number(r.default_amount_kr) : null,
    enabled: r.enabled ?? true,
    isRepeatable: r.is_repeatable ?? false,
  };
}

function isActiveMonthlyRow(r: MonthlyTaskRow): boolean {
  return r.single_month_start != null || (r.enabled ?? true);
}

async function ensureDefaultMonthlyFest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("monthly_tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("key", FEST_TASK_KEY)
    .is("archived_at", null)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("monthly_tasks")
      .update({ is_repeatable: true, enabled: true, archived_at: null })
      .eq("id", existing.id)
      .eq("user_id", userId);
    return;
  }

  const { data: life } = await supabase
    .from("task_categories")
    .select("id")
    .eq("user_id", userId)
    .eq("scope", "task")
    .eq("name", "Livet")
    .is("archived_at", null)
    .maybeSingle();

  await supabase.from("monthly_tasks").insert({
    user_id: userId,
    category_id: life?.id ?? null,
    key: FEST_TASK_KEY,
    title: "Fest",
    notes:
      "Dra in hur många fester du vill den här månaden — välj dag och logga efteråt.",
    icon: "🎉",
    accent: "#f472b6",
    sort_order: 40,
    day_of_month: null,
    completion_kind: "simple",
    is_repeatable: true,
  });
}

interface MonthlyCompletionRow {
  id: string;
  task_id: string;
  month_start: string;
  done_at: string | null;
  note: string | null;
  amount: number | null;
  scheduled_day_of_month: number | null;
  scheduled_week_start: string | null;
  is_unscheduled: boolean;
  is_instance: boolean;
  occasion: string | null;
  day_sort_order: number;
}

function rowToCompletion(r: MonthlyCompletionRow): MonthlyCompletion {
  return {
    id: r.id,
    taskId: r.task_id,
    monthStart: r.month_start,
    doneAt: r.done_at,
    note: r.note,
    amount: r.amount != null ? Number(r.amount) : null,
    scheduledDayOfMonth: r.scheduled_day_of_month,
    scheduledWeekStart: r.scheduled_week_start,
    isUnscheduled: r.is_unscheduled,
    isInstance: r.is_instance ?? false,
    occasion: r.occasion?.trim() || null,
    daySortOrder: r.day_sort_order ?? 0,
  };
}

const MONTHLY_TASK_SELECT =
  "id, category_id, key, title, notes, day_of_month, icon, accent, sort_order, completion_kind, single_month_start, default_amount_kr, enabled, is_repeatable";

const MONTHLY_COMPLETION_SELECT =
  "id, task_id, month_start, done_at, note, amount, scheduled_day_of_month, scheduled_week_start, is_unscheduled, is_instance, occasion, day_sort_order";

interface MonthlyTaskDedupeRow {
  id: string;
  title: string;
  key: string | null;
  category_id: string | null;
  single_month_start: string | null;
  sort_order: number;
}

/** Archive duplicate monthly tasks that share the same title (keeps seeded/categorized). */
async function repairDuplicateMonthlyTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("monthly_tasks")
    .select("id, title, key, category_id, single_month_start, sort_order")
    .eq("user_id", userId)
    .is("archived_at", null);

  if (!data?.length) return;

  const toArchive = new Set<string>();

  const byKey = new Map<string, MonthlyTaskDedupeRow[]>();
  for (const row of data) {
    if (!row.key) continue;
    const list = byKey.get(row.key) ?? [];
    list.push(row);
    byKey.set(row.key, list);
  }
  for (const list of byKey.values()) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const scoreA = monthlyTaskKeeperScore({
        key: a.key,
        categoryId: a.category_id,
        singleMonthStart: a.single_month_start,
        sortOrder: a.sort_order,
      });
      const scoreB = monthlyTaskKeeperScore({
        key: b.key,
        categoryId: b.category_id,
        singleMonthStart: b.single_month_start,
        sortOrder: b.sort_order,
      });
      return scoreB - scoreA;
    });
    for (const loser of sorted.slice(1)) {
      toArchive.add(loser.id);
    }
  }

  const groups = new Map<string, MonthlyTaskDedupeRow[]>();
  for (const row of data) {
    if (row.key && toArchive.has(row.id)) continue;
    const norm = row.title.trim().toLowerCase();
    const list = groups.get(norm) ?? [];
    list.push(row);
    groups.set(norm, list);
  }

  for (const list of groups.values()) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => {
      const scoreA = monthlyTaskKeeperScore({
        key: a.key,
        categoryId: a.category_id,
        singleMonthStart: a.single_month_start,
        sortOrder: a.sort_order,
      });
      const scoreB = monthlyTaskKeeperScore({
        key: b.key,
        categoryId: b.category_id,
        singleMonthStart: b.single_month_start,
        sortOrder: b.sort_order,
      });
      return scoreB - scoreA;
    });
    for (const loser of sorted.slice(1)) {
      toArchive.add(loser.id);
    }
  }

  if (toArchive.size === 0) return;

  await supabase
    .from("monthly_tasks")
    .update({ archived_at: new Date().toISOString() })
    .in("id", [...toArchive])
    .eq("user_id", userId);
}

/** Keep seeded savings transfer titles/notes in sync (e.g. SBAB spar rename). */
async function repairMonthlySavingsTaskLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  for (const [key, meta] of Object.entries(SAVINGS_TRANSFER_TASKS)) {
    await supabase
      .from("monthly_tasks")
      .update({ title: meta.title, notes: meta.notes })
      .eq("user_id", userId)
      .eq("key", key);
  }
}

export async function getMonthlyTasks(userId: string): Promise<MonthlyTask[]> {
  const supabase = await createClient();
  await repairDuplicateMonthlyTasks(supabase, userId);
  await repairMonthlySavingsTaskLabels(supabase, userId);
  await ensureDefaultMonthlyFest(supabase, userId);
  const { data } = await supabase
    .from("monthly_tasks")
    .select(MONTHLY_TASK_SELECT)
    .eq("user_id", userId)
    .is("archived_at", null)
    .is("single_month_start", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToMonthly);
}

export interface MonthSummaryTasks {
  monthStart: string;
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
  financeSnapshot: MonthlyFinanceSnapshot | null;
}

interface FinanceSnapshotRow {
  month_start: string;
  langforsakringar: number | null;
  kort: number | null;
  spar: number | null;
  isk: number | null;
  sbab_spar: number | null;
  avanza: number | null;
  krypto: number | null;
  cash: number | null;
  note: string | null;
  done_at: string | null;
}

function rowToFinanceSnapshot(r: FinanceSnapshotRow): MonthlyFinanceSnapshot {
  return {
    monthStart: r.month_start,
    balances: balancesFromSnapshotRow(r),
    note: r.note,
    doneAt: r.done_at,
  };
}

export async function getMonthFinanceSnapshot(
  userId: string,
  monthStart: string,
): Promise<MonthlyFinanceSnapshot | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_finance_snapshots")
    .select(
      "month_start, langforsakringar, kort, spar, isk, sbab_spar, avanza, krypto, cash, note, done_at",
    )
    .eq("user_id", userId)
    .eq("month_start", monthStart)
    .maybeSingle();
  return data ? rowToFinanceSnapshot(data) : null;
}

/**
 * Returns all active monthly tasks merged with their completion row for the
 * given month. Tasks without a row are "untouched" this month.
 */
export async function getMonthTaskSummary(
  userId: string,
  monthStart: string,
): Promise<MonthSummaryTasks> {
  const supabase = await createClient();
  await repairDuplicateMonthlyTasks(supabase, userId);
  await repairMonthlySavingsTaskLabels(supabase, userId);
  await repairAmountCompletionsMissingDone(userId);
  await ensureDefaultMonthlyFest(supabase, userId);
  const [tasksRes, completionsRes, catsRes, financeRes] = await Promise.all([
    supabase
      .from("monthly_tasks")
      .select(MONTHLY_TASK_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      .or(`single_month_start.is.null,single_month_start.eq.${monthStart}`)
      .order("sort_order", { ascending: true }),
    supabase
      .from("monthly_task_completions")
      .select(MONTHLY_COMPLETION_SELECT)
      .eq("user_id", userId)
      .eq("month_start", monthStart),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order, weekly_goal")
      .eq("user_id", userId)
      .eq("scope", "task")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("monthly_finance_snapshots")
      .select(
        "month_start, langforsakringar, kort, spar, isk, sbab_spar, avanza, krypto, cash, note, done_at",
      )
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .maybeSingle(),
  ]);

  const compsByTask = new Map<string, MonthlyCompletion[]>();
  for (const row of completionsRes.data ?? []) {
    const c = rowToCompletion(row);
    const list = compsByTask.get(c.taskId) ?? [];
    list.push(c);
    compsByTask.set(c.taskId, list);
  }

  const tasks: MonthlyTaskForMonth[] = dedupeMonthlyTasks(
    (tasksRes.data ?? [])
      .filter(isActiveMonthlyRow)
      .map((row) => {
        const completions = compsByTask.get(row.id) ?? [];
        return {
          ...rowToMonthly(row),
          completion: completions.find((c) => !c.isInstance) ?? completions[0] ?? null,
          completions,
        };
      }),
  );

  const categories = (catsRes.data ?? []).map(rowToCategory);
  const financeSnapshot = financeRes.data
    ? rowToFinanceSnapshot(financeRes.data)
    : null;
  return { monthStart, tasks, categories, financeSnapshot };
}

export interface MonthlyBillsWeekContext {
  tasks: MonthlyTaskForMonth[];
  categories: TaskCategory[];
  completionsByTaskMonth: Map<string, MonthlyCompletion[]>;
}

/** Monthly bills + completions for all months touched by an ISO week. */
export async function getMonthlyBillsForWeek(
  userId: string,
  weekStart: string,
): Promise<MonthlyBillsWeekContext> {
  const supabase = await createClient();
  await repairDuplicateMonthlyTasks(supabase, userId);
  await repairMonthlySavingsTaskLabels(supabase, userId);
  await repairAmountCompletionsMissingDone(userId);
  await ensureDefaultMonthlyFest(supabase, userId);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const monthStarts = [...new Set(weekDates.map((d) => `${d.slice(0, 7)}-01`))];
  const oneOffFilter = monthStarts.map((m) => `single_month_start.eq.${m}`).join(",");
  const taskOrFilter = oneOffFilter
    ? `single_month_start.is.null,${oneOffFilter}`
    : "single_month_start.is.null";

  const [tasksRes, catsRes, completionsRes] = await Promise.all([
    supabase
      .from("monthly_tasks")
      .select(MONTHLY_TASK_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      .or(taskOrFilter)
      .order("sort_order", { ascending: true }),
    supabase
      .from("task_categories")
      .select("id, scope, name, icon, accent, sort_order, weekly_goal")
      .eq("user_id", userId)
      .eq("scope", "task")
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("monthly_task_completions")
      .select(MONTHLY_COMPLETION_SELECT)
      .eq("user_id", userId)
      .in("month_start", monthStarts),
  ]);

  const completionsByTaskMonth = new Map<string, MonthlyCompletion[]>();
  for (const row of completionsRes.data ?? []) {
    const c = rowToCompletion(row);
    const key = `${c.taskId}|${c.monthStart}`;
    const list = completionsByTaskMonth.get(key) ?? [];
    list.push(c);
    completionsByTaskMonth.set(key, list);
  }

  const categories = (catsRes.data ?? []).map(rowToCategory);
  const tasks: MonthlyTaskForMonth[] = dedupeMonthlyTasks(
    (tasksRes.data ?? [])
      .filter(isActiveMonthlyRow)
      .map((row) => ({
        ...rowToMonthly(row),
        completion: null,
        completions: [],
      })),
  );

  return {
    tasks,
    categories,
    completionsByTaskMonth,
  };
}
