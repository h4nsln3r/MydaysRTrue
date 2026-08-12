import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isoWeekdayFromLocalISO, parseLocalISO, weekStartISO } from "@/lib/date";
import type {
  SportKey,
  SportPlacement,
  SportSessionForWeek,
  SportSessionTemplate,
} from "@/lib/sport";
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
  plan_sport: string | null;
  actual_sport: string | null;
  note: string | null;
  companions: string | null;
  done_at: string | null;
}

function rowToTemplate(r: TemplateRow): SportSessionTemplate {
  return {
    id: r.id,
    key: r.key as SportKey,
    label: r.label,
    description: r.description,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    defaultWeekday: r.default_weekday as Weekday,
  };
}

function rowToPlacement(r: PlacementRow): SportPlacement {
  return {
    id: r.id,
    templateId: r.template_id,
    weekStart: r.week_start,
    weekday: r.weekday as Weekday | null,
    daySortOrder: r.day_sort_order ?? 0,
    planSport: r.plan_sport,
    actualSport: r.actual_sport,
    note: r.note,
    companions: r.companions,
    doneAt: r.done_at,
  };
}

const PLACEMENT_SELECT =
  "id, template_id, week_start, weekday, day_sort_order, plan_sport, actual_sport, note, companions, done_at";

type SportSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the repeatable "sport" template and archive leftover sport_1/2.
 */
export async function ensureSportTemplate(
  supabase: SportSupabase,
  userId: string,
): Promise<{ id: string } | null> {
  let canonicalId: string | null = null;

  const { data: canonical } = await supabase
    .from("sport_session_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("key", "sport")
    .is("archived_at", null)
    .maybeSingle();
  if (canonical) canonicalId = canonical.id;

  if (!canonicalId) {
    const { data: archived } = await supabase
      .from("sport_session_templates")
      .select("id")
      .eq("user_id", userId)
      .eq("key", "sport")
      .not("archived_at", "is", null)
      .maybeSingle();
    if (archived) {
      const { error } = await supabase
        .from("sport_session_templates")
        .update({
          archived_at: null,
          label: "Sportpass",
          description:
            "Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.",
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
      .from("sport_session_templates")
      .select("id")
      .eq("user_id", userId)
      .like("key", "sport_%")
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (legacy) {
      const { error } = await supabase
        .from("sport_session_templates")
        .update({
          key: "sport",
          label: "Sportpass",
          description:
            "Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.",
          icon: "🏸",
          accent: "#a78bfa",
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
      .from("sport_session_templates")
      .insert({
        user_id: userId,
        key: "sport",
        label: "Sportpass",
        description:
          "Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.",
        icon: "🏸",
        accent: "#a78bfa",
        sort_order: 0,
        default_weekday: 3,
      })
      .select("id")
      .maybeSingle();
    if (error || !created) return null;
    canonicalId = created.id;
  }

  const { data: leftovers } = await supabase
    .from("sport_session_templates")
    .select("id")
    .eq("user_id", userId)
    .like("key", "sport_%")
    .is("archived_at", null);

  for (const leftover of leftovers ?? []) {
    if (leftover.id === canonicalId) continue;
    await supabase
      .from("sport_week_placements")
      .update({ template_id: canonicalId })
      .eq("user_id", userId)
      .eq("template_id", leftover.id);
    await supabase
      .from("sport_session_templates")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", leftover.id)
      .eq("user_id", userId);
  }

  await supabase
    .from("sport_session_templates")
    .update({
      label: "Sportpass",
      description:
        "Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.",
      default_weekday: 3,
    })
    .eq("id", canonicalId)
    .eq("user_id", userId);

  return { id: canonicalId };
}

export interface SportWeekSummary {
  weekStart: string;
  /** Backlog source(s) not consumed by placement. */
  templates: SportSessionTemplate[];
  /** Instances placed on weekdays this week. */
  placedSessions: SportSessionForWeek[];
  /** Alias for placedSessions — kept for older call sites. */
  sessions: SportSessionForWeek[];
}

export async function getSportTemplates(
  userId: string,
): Promise<SportSessionTemplate[]> {
  const supabase = await createClient();
  await ensureSportTemplate(supabase, userId);
  const { data } = await supabase
    .from("sport_session_templates")
    .select(
      "id, key, label, description, icon, accent, sort_order, default_weekday",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToTemplate);
}

export async function getSportWeekSummary(
  userId: string,
  weekStart: string,
): Promise<SportWeekSummary> {
  const supabase = await createClient();
  await ensureSportTemplate(supabase, userId);

  const [{ data: templates }, { data: placements }] = await Promise.all([
    supabase
      .from("sport_session_templates")
      .select(
        "id, key, label, description, icon, accent, sort_order, default_weekday",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sport_week_placements")
      .select(PLACEMENT_SELECT)
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .not("weekday", "is", null),
  ]);

  const templateById = new Map(
    (templates ?? []).map((t) => [t.id, rowToTemplate(t)]),
  );

  const placedSessions: SportSessionForWeek[] = [];
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
    // Sport is always repeatable — keep the source in the backlog.
    templates: (templates ?? []).map(rowToTemplate),
    placedSessions,
    sessions: placedSessions,
  };
}

export interface SportDaySummary {
  localDate: string;
  weekStart: string;
  weekday: Weekday;
  sessions: SportSessionForWeek[];
}

export async function getSportSessionsForDate(
  userId: string,
  localDate: string,
): Promise<SportDaySummary> {
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  const { placedSessions } = await getSportWeekSummary(userId, weekStart);
  const forDay = placedSessions
    .filter(
      (s) => s.placement.weekday != null && s.placement.weekday === weekday,
    )
    .sort((a, b) => a.placement.daySortOrder - b.placement.daySortOrder);
  return { localDate, weekStart, weekday, sessions: forDay };
}
