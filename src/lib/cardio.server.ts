import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CardioKey,
  CardioPlacement,
  CardioSessionForWeek,
  CardioSessionTemplate,
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
  weekday: number;
  done_at: string | null;
  note: string | null;
}

function rowToTemplate(r: TemplateRow): CardioSessionTemplate {
  return {
    id: r.id,
    key: r.key as CardioKey,
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
    weekday: r.weekday as Weekday,
    doneAt: r.done_at,
    note: r.note,
  };
}

export interface CardioWeekSummary {
  weekStart: string;
  sessions: CardioSessionForWeek[];
}

export async function getCardioWeekSummary(
  userId: string,
  weekStart: string,
): Promise<CardioWeekSummary> {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("cardio_session_templates")
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
    .from("cardio_week_placements")
    .select("id, template_id, week_start, weekday, done_at, note")
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
    weekday: number;
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
      .from("cardio_week_placements")
      .insert(toInsert)
      .select("id, template_id, week_start, weekday, done_at, note");
    for (const p of inserted ?? []) {
      placementByTemplate.set(p.template_id, p);
    }
  }

  const sessions: CardioSessionForWeek[] = templates.map((t) => {
    const placement = placementByTemplate.get(t.id);
    if (!placement) {
      throw new Error(`Missing cardio placement for template ${t.id}`);
    }
    return {
      ...rowToTemplate(t),
      placement: rowToPlacement(placement),
    };
  });

  return { weekStart, sessions };
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
  const { sessions } = await getCardioWeekSummary(userId, weekStart);
  const forDay = sessions
    .filter((s) => s.placement.weekday === weekday)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { localDate, weekStart, weekday, sessions: forDay };
}
