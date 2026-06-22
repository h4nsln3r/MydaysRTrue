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

export interface SportWeekSummary {
  weekStart: string;
  sessions: SportSessionForWeek[];
}

export async function getSportTemplates(
  userId: string,
): Promise<SportSessionTemplate[]> {
  const supabase = await createClient();
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

  const { data: templates } = await supabase
    .from("sport_session_templates")
    .select(
      "id, key, label, description, icon, accent, sort_order, default_weekday",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });

  if (!templates?.length) {
    return { weekStart, sessions: [] };
  }

  const { data: placements } = await supabase
    .from("sport_week_placements")
    .select(PLACEMENT_SELECT)
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  const placementByTemplate = new Map<string, PlacementRow>();
  for (const p of placements ?? []) {
    placementByTemplate.set(p.template_id, p);
  }

  const toInsert: {
    user_id: string;
    template_id: string;
    week_start: string;
    weekday: number | null;
  }[] = [];

  for (const t of templates) {
    if (!placementByTemplate.has(t.id)) {
      toInsert.push({
        user_id: userId,
        template_id: t.id,
        week_start: weekStart,
        weekday: t.default_weekday,
      });
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("sport_week_placements")
      .insert(toInsert)
      .select(PLACEMENT_SELECT);
    for (const p of inserted ?? []) {
      placementByTemplate.set(p.template_id, p);
    }
  }

  const sessions: SportSessionForWeek[] = templates.map((t) => {
    const placement = placementByTemplate.get(t.id);
    if (!placement) {
      throw new Error(`Missing sport placement for template ${t.id}`);
    }
    return {
      ...rowToTemplate(t),
      placement: rowToPlacement(placement),
    };
  });

  return { weekStart, sessions };
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
  const { sessions } = await getSportWeekSummary(userId, weekStart);
  const forDay = sessions
    .filter(
      (s) => s.placement.weekday != null && s.placement.weekday === weekday,
    )
    .sort((a, b) => a.placement.daySortOrder - b.placement.daySortOrder);
  return { localDate, weekStart, weekday, sessions: forDay };
}
