import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  BathingKey,
  BathingPlacement,
  BathingSessionForWeek,
  BathingSessionTemplate,
} from "@/lib/bathing";
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
  water_temp_c: number | null;
  done_at: string | null;
  note: string | null;
}

function rowToTemplate(r: TemplateRow): BathingSessionTemplate {
  return {
    id: r.id,
    key: r.key as BathingKey,
    label: r.label,
    description: r.description,
    icon: r.icon,
    accent: r.accent,
    sortOrder: r.sort_order,
    defaultWeekday: r.default_weekday as Weekday,
  };
}

function rowToPlacement(r: PlacementRow): BathingPlacement {
  return {
    id: r.id,
    templateId: r.template_id,
    weekStart: r.week_start,
    weekday: r.weekday as Weekday | null,
    daySortOrder: r.day_sort_order ?? 0,
    waterTempC: r.water_temp_c != null ? Number(r.water_temp_c) : null,
    doneAt: r.done_at,
    note: r.note,
  };
}

export interface BathingWeekSummary {
  weekStart: string;
  /** Backlog entries not yet placed on a day this week. */
  templates: BathingSessionTemplate[];
  /** Instances placed on weekdays this week. */
  placedSessions: BathingSessionForWeek[];
}

export async function getBathingTemplates(
  userId: string,
): Promise<BathingSessionTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bathing_session_templates")
    .select(
      "id, key, label, description, icon, accent, sort_order, default_weekday",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(rowToTemplate);
}

export async function getBathingWeekSummary(
  userId: string,
  weekStart: string,
): Promise<BathingWeekSummary> {
  const supabase = await createClient();

  const [{ data: templates }, { data: placements }] = await Promise.all([
    supabase
      .from("bathing_session_templates")
      .select(
        "id, key, label, description, icon, accent, sort_order, default_weekday",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("bathing_week_placements")
      .select(
        "id, template_id, week_start, weekday, day_sort_order, water_temp_c, done_at, note",
      )
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .not("weekday", "is", null),
  ]);

  const templateById = new Map(
    (templates ?? []).map((t) => [t.id, rowToTemplate(t)]),
  );

  const placedSessions: BathingSessionForWeek[] = [];
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

  const placedTemplateIds = new Set(
    placedSessions.map((s) => s.placement.templateId),
  );

  return {
    weekStart,
    templates: (templates ?? [])
      .map(rowToTemplate)
      .filter((t) => !placedTemplateIds.has(t.id)),
    placedSessions,
  };
}

export interface BathingDaySummary {
  localDate: string;
  weekStart: string;
  weekday: Weekday;
  sessions: BathingSessionForWeek[];
}

export async function getBathingSessionsForDate(
  userId: string,
  localDate: string,
): Promise<BathingDaySummary> {
  const weekStart = weekStartISO(parseLocalISO(localDate));
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  const { placedSessions } = await getBathingWeekSummary(userId, weekStart);
  const forDay = placedSessions
    .filter(
      (s) => s.placement.weekday != null && s.placement.weekday === weekday,
    )
    .sort((a, b) => a.placement.daySortOrder - b.placement.daySortOrder);
  return { localDate, weekStart, weekday, sessions: forDay };
}

