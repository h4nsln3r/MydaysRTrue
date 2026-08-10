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

type BathingSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the repeatable "bad" template and archive leftover bad_1/2/3.
 * Handles DBs that never fully applied migration 0016.
 */
export async function ensureBadTemplate(
  supabase: BathingSupabase,
  userId: string,
): Promise<{ id: string } | null> {
  let canonicalId: string | null = null;

  const { data: canonical } = await supabase
    .from("bathing_session_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("key", "bad")
    .is("archived_at", null)
    .maybeSingle();
  if (canonical) {
    canonicalId = canonical.id;
  }

  if (!canonicalId) {
    // Reactivate an archived "bad" if present (unique on user_id+key).
    const { data: archived } = await supabase
      .from("bathing_session_templates")
      .select("id")
      .eq("user_id", userId)
      .eq("key", "bad")
      .not("archived_at", "is", null)
      .maybeSingle();
    if (archived) {
      const { error } = await supabase
        .from("bathing_session_templates")
        .update({
          archived_at: null,
          label: "Bad",
          description: "Dra in hur många bad du vill den här veckan.",
          sort_order: 0,
        })
        .eq("id", archived.id)
        .eq("user_id", userId);
      if (!error) canonicalId = archived.id;
    }
  }

  if (!canonicalId) {
    // Legacy seed: bad_1 / bad_2 / bad_3 — promote the first active one.
    const { data: legacy } = await supabase
      .from("bathing_session_templates")
      .select("id")
      .eq("user_id", userId)
      .like("key", "bad_%")
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (legacy) {
      const { error } = await supabase
        .from("bathing_session_templates")
        .update({
          key: "bad",
          label: "Bad",
          description: "Dra in hur många bad du vill den här veckan.",
          sort_order: 0,
        })
        .eq("id", legacy.id)
        .eq("user_id", userId);
      if (error) return null;
      canonicalId = legacy.id;
    }
  }

  if (!canonicalId) {
    const { data: created, error } = await supabase
      .from("bathing_session_templates")
      .insert({
        user_id: userId,
        key: "bad",
        label: "Bad",
        description: "Dra in hur många bad du vill den här veckan.",
        icon: "🛁",
        accent: "#38bdf8",
        sort_order: 0,
        default_weekday: 1,
      })
      .select("id")
      .maybeSingle();
    if (error || !created) return null;
    canonicalId = created.id;
  }

  // Archive any remaining numbered bad passes and keep their placements on "bad".
  const { data: leftovers } = await supabase
    .from("bathing_session_templates")
    .select("id")
    .eq("user_id", userId)
    .like("key", "bad_%")
    .is("archived_at", null);

  for (const leftover of leftovers ?? []) {
    if (leftover.id === canonicalId) continue;
    await supabase
      .from("bathing_week_placements")
      .update({ template_id: canonicalId })
      .eq("user_id", userId)
      .eq("template_id", leftover.id);
    await supabase
      .from("bathing_session_templates")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", leftover.id)
      .eq("user_id", userId);
  }

  return { id: canonicalId };
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
  await ensureBadTemplate(supabase, userId);
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
  await ensureBadTemplate(supabase, userId);

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
    // "bad" is repeatable, so keep its source in the backlog even once placed;
    // other templates (bastu) disappear from the backlog after placement.
    templates: (templates ?? [])
      .map(rowToTemplate)
      .filter((t) => t.key === "bad" || t.key === "bastu")
      .filter((t) => t.key === "bad" || !placedTemplateIds.has(t.id)),
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

