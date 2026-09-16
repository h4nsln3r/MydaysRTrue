import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isCardioKind,
  type CardioKind,
  type CardioPlacement,
  type CardioSessionForWeek,
  type CardioSessionTemplate,
} from "@/lib/cardio";
import { isoWeekdayFromLocalISO, parseLocalISO, weekStartISO } from "@/lib/date";
import type { Weekday } from "@/lib/tasks";

interface TemplateRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string;
  accent: string;
  sort_order: number;
  default_weekday: number;
}

interface PlacementRow {
  id: string;
  template_id: string;
  week_start: string;
  weekday: number | null;
  day_sort_order: number;
  plan_kind: string | null;
  actual_kind: string | null;
  done_at: string | null;
  note: string | null;
}

const CARDIO_DESCRIPTION =
  "Dra in hur många cardiopass du vill — minst 3 per vecka. Gärna en löpning, en cykel och en simning.";

function parseKind(value: string | null | undefined): CardioKind | null {
  return isCardioKind(value) ? value : null;
}

function kindFromLegacyKey(key: string): CardioKind | null {
  return isCardioKind(key) ? key : null;
}

function rowToTemplate(r: TemplateRow): CardioSessionTemplate {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    defaultWeekday: r.default_weekday as Weekday,
  };
}

function rowToPlacement(r: PlacementRow): CardioPlacement {
  return {
    id: r.id,
    templateId: r.template_id,
    weekStart: r.week_start,
    weekday: r.weekday as Weekday | null,
    daySortOrder: r.day_sort_order ?? 0,
    planKind: parseKind(r.plan_kind),
    actualKind: parseKind(r.actual_kind),
    doneAt: r.done_at,
    note: r.note,
  };
}

const PLACEMENT_SELECT =
  "id, template_id, week_start, weekday, day_sort_order, plan_kind, actual_kind, done_at, note";

type CardioSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the repeatable "cardio" template and archive leftover run/cycle/swim slots.
 */
export async function ensureCardioTemplate(
  supabase: CardioSupabase,
  userId: string,
): Promise<{ id: string } | null> {
  let canonicalId: string | null = null;

  const { data: canonical } = await supabase
    .from("cardio_session_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("key", "cardio")
    .is("archived_at", null)
    .maybeSingle();
  if (canonical) canonicalId = canonical.id;

  if (!canonicalId) {
    const { data: archived } = await supabase
      .from("cardio_session_templates")
      .select("id")
      .eq("user_id", userId)
      .eq("key", "cardio")
      .not("archived_at", "is", null)
      .maybeSingle();
    if (archived) {
      const { error } = await supabase
        .from("cardio_session_templates")
        .update({
          archived_at: null,
          label: "Cardiopass",
          description: CARDIO_DESCRIPTION,
          icon: "🏃",
          accent: "#5fb6ff",
          sort_order: 0,
          default_weekday: 3,
        })
        .eq("id", archived.id)
        .eq("user_id", userId);
      if (!error) canonicalId = archived.id;
    }
  }

  if (!canonicalId) {
    const { data: legacy } = await supabase
      .from("cardio_session_templates")
      .select("id")
      .eq("user_id", userId)
      .in("key", ["running", "cycling", "swimming"])
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (legacy) {
      const { error } = await supabase
        .from("cardio_session_templates")
        .update({
          key: "cardio",
          label: "Cardiopass",
          description: CARDIO_DESCRIPTION,
          icon: "🏃",
          accent: "#5fb6ff",
          sort_order: 0,
          default_weekday: 3,
        })
        .eq("id", legacy.id)
        .eq("user_id", userId);
      if (error) return null;
      canonicalId = legacy.id;
    }
  }

  if (!canonicalId) {
    const { data: created, error } = await supabase
      .from("cardio_session_templates")
      .insert({
        user_id: userId,
        key: "cardio",
        label: "Cardiopass",
        description: CARDIO_DESCRIPTION,
        icon: "🏃",
        accent: "#5fb6ff",
        sort_order: 0,
        default_weekday: 3,
      })
      .select("id")
      .maybeSingle();
    if (error || !created) return null;
    canonicalId = created.id;
  }

  const { data: leftovers } = await supabase
    .from("cardio_session_templates")
    .select("id, key")
    .eq("user_id", userId)
    .in("key", ["running", "cycling", "swimming"])
    .is("archived_at", null);

  for (const leftover of leftovers ?? []) {
    if (leftover.id === canonicalId) continue;
    const kind = kindFromLegacyKey(leftover.key);
    const { data: leftoverPlacements } = await supabase
      .from("cardio_week_placements")
      .select("id, plan_kind, actual_kind, done_at")
      .eq("user_id", userId)
      .eq("template_id", leftover.id);

    for (const p of leftoverPlacements ?? []) {
      await supabase
        .from("cardio_week_placements")
        .update({
          template_id: canonicalId,
          plan_kind: p.plan_kind || kind,
          actual_kind: p.done_at ? p.actual_kind || kind : p.actual_kind,
        })
        .eq("id", p.id)
        .eq("user_id", userId);
    }

    await supabase
      .from("cardio_session_templates")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", leftover.id)
      .eq("user_id", userId);
  }

  await supabase
    .from("cardio_session_templates")
    .update({
      label: "Cardiopass",
      description: CARDIO_DESCRIPTION,
      default_weekday: 3,
    })
    .eq("id", canonicalId)
    .eq("user_id", userId);

  await supabase
    .from("cardio_week_placements")
    .delete()
    .eq("user_id", userId)
    .is("weekday", null);

  return { id: canonicalId };
}

export interface CardioWeekSummary {
  weekStart: string;
  /** Backlog source(s) not consumed by placement. */
  templates: CardioSessionTemplate[];
  /** Instances placed on weekdays this week. */
  placedSessions: CardioSessionForWeek[];
  /** Alias for placedSessions — kept for older call sites. */
  sessions: CardioSessionForWeek[];
}

export async function getCardioTemplates(
  userId: string,
): Promise<CardioSessionTemplate[]> {
  const supabase = await createClient();
  await ensureCardioTemplate(supabase, userId);
  const { data } = await supabase
    .from("cardio_session_templates")
    .select(
      "id, key, label, description, icon, accent, sort_order, default_weekday",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToTemplate);
}

export async function getCardioWeekSummary(
  userId: string,
  weekStart: string,
): Promise<CardioWeekSummary> {
  const supabase = await createClient();
  await ensureCardioTemplate(supabase, userId);

  const [{ data: templates }, { data: placements }] = await Promise.all([
    supabase
      .from("cardio_session_templates")
      .select(
        "id, key, label, description, icon, accent, sort_order, default_weekday",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("cardio_week_placements")
      .select(PLACEMENT_SELECT)
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .not("weekday", "is", null),
  ]);

  const templateById = new Map(
    (templates ?? []).map((t) => [t.id, rowToTemplate(t)]),
  );

  const placedSessions: CardioSessionForWeek[] = [];
  for (const p of placements ?? []) {
    const template = templateById.get(p.template_id);
    if (!template) continue;
    placedSessions.push({
      ...template,
      placement: rowToPlacement(p),
    });
  }

  placedSessions.sort((a, b) => {
    const wd = (a.placement.weekday ?? 0) - (b.placement.weekday ?? 0);
    if (wd !== 0) return wd;
    return a.placement.daySortOrder - b.placement.daySortOrder;
  });

  return {
    weekStart,
    templates: (templates ?? []).map(rowToTemplate),
    placedSessions,
    sessions: placedSessions,
  };
}

export interface CardioDaySummary {
  localDate: string;
  weekStart: string;
  weekday: Weekday;
  sessions: CardioSessionForWeek[];
}

export async function getCardioSessionsForDate(
  userId: string,
  localDate: string,
): Promise<CardioDaySummary> {
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  const { placedSessions } = await getCardioWeekSummary(userId, weekStart);
  const forDay = placedSessions
    .filter(
      (s) => s.placement.weekday != null && s.placement.weekday === weekday,
    )
    .sort((a, b) => a.placement.daySortOrder - b.placement.daySortOrder);
  return { localDate, weekStart, weekday, sessions: forDay };
}
