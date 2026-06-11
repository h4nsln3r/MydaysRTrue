import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  GymPlacement,
  GymSessionForWeek,
  GymSessionTemplate,
  GymWarmup,
} from "@/lib/gym";
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
  warmup: GymWarmup | null;
  done_at: string | null;
  note: string | null;
}

function rowToTemplate(r: TemplateRow): GymSessionTemplate {
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

function rowToPlacement(r: PlacementRow): GymPlacement {
  return {
    id: r.id,
    templateId: r.template_id,
    weekStart: r.week_start,
    weekday: r.weekday as Weekday,
    warmup: r.warmup,
    doneAt: r.done_at,
    note: r.note,
  };
}

export interface GymWeekSummary {
  weekStart: string;
  sessions: GymSessionForWeek[];
}

export async function getGymTemplates(
  userId: string,
): Promise<GymSessionTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_session_templates")
    .select(
      "id, key, label, description, icon, accent, sort_order, default_weekday",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToTemplate);
}

/**
 * Returns the user's gym rotation for a week. Missing placement rows are
 * created from each template's `default_weekday` so Mon–Fri (or whatever
 * defaults the user has) appear automatically every week.
 */
export async function getGymWeekSummary(
  userId: string,
  weekStart: string,
): Promise<GymWeekSummary> {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("gym_session_templates")
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
    .from("gym_week_placements")
    .select("id, template_id, week_start, weekday, warmup, done_at, note")
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  const placementByTemplate = new Map<string, PlacementRow>();
  for (const p of placements ?? []) {
    placementByTemplate.set(p.template_id, p);
  }

  // Seed any missing placements from defaults.
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
      .from("gym_week_placements")
      .insert(toInsert)
      .select("id, template_id, week_start, weekday, warmup, done_at, note");
    for (const p of inserted ?? []) {
      placementByTemplate.set(p.template_id, p);
    }
  }

  const sessions: GymSessionForWeek[] = templates.map((t) => {
    const placement = placementByTemplate.get(t.id);
    if (!placement) {
      throw new Error(`Missing gym placement for template ${t.id}`);
    }
    return {
      ...rowToTemplate(t),
      placement: rowToPlacement(placement),
    };
  });

  sessions.sort((a, b) => a.sortOrder - b.sortOrder);

  return { weekStart, sessions };
}

export interface GymDaySummary {
  localDate: string;
  weekStart: string;
  weekday: Weekday;
  /** Pass scheduled on this calendar day for the current week. */
  sessions: GymSessionForWeek[];
}

/** Gym passes placed on the weekday of `localDate` (within that ISO week). */
export async function getGymSessionsForDate(
  userId: string,
  localDate: string,
): Promise<GymDaySummary> {
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  const { sessions } = await getGymWeekSummary(userId, weekStart);
  const forDay = sessions.filter(
    (s) => s.placement.weekday != null && s.placement.weekday === weekday,
  );
  return { localDate, weekStart, weekday, sessions: forDay };
}
