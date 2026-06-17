import "server-only";
import { addDaysISO } from "@/lib/date";
import { monthStartFromDate } from "@/lib/monthly-bills";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/tasks";
import { parseWeekPlanDragId } from "@/lib/week-plan";

/** Next sort index when placing any item on a weekday in the week plan. */
export async function nextWeekDaySortOrder(
  userId: string,
  weekStart: string,
  weekday: Weekday,
): Promise<number> {
  const supabase = await createClient();
  const localDate = addDaysISO(weekStart, weekday - 1);
  const monthStart = monthStartFromDate(localDate);
  const dayOfMonth = Number(localDate.slice(8, 10));

  const [tasks, gym, cardio, bathing, weight, bills] = await Promise.all([
    supabase
      .from("weekly_task_placements")
      .select("day_sort_order")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .eq("weekday", weekday),
    supabase
      .from("gym_week_placements")
      .select("day_sort_order")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .eq("weekday", weekday),
    supabase
      .from("cardio_week_placements")
      .select("day_sort_order")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .eq("weekday", weekday),
    supabase
      .from("bathing_week_placements")
      .select("day_sort_order")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .eq("weekday", weekday),
    supabase
      .from("weight_week_plans")
      .select("day_sort_order")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .eq("weekday", weekday),
    supabase
      .from("monthly_task_completions")
      .select("day_sort_order")
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .eq("scheduled_day_of_month", dayOfMonth)
      .eq("is_unscheduled", false),
  ]);

  const values = [
    ...(tasks.data ?? []).map((r) => r.day_sort_order),
    ...(gym.data ?? []).map((r) => r.day_sort_order),
    ...(cardio.data ?? []).map((r) => r.day_sort_order),
    ...(bathing.data ?? []).map((r) => r.day_sort_order),
    ...(weight.data ?? []).map((r) => r.day_sort_order),
    ...(bills.data ?? []).map((r) => r.day_sort_order),
  ];

  return (values.length > 0 ? Math.max(...values) : -1) + 1;
}

/** Persist drag order for all item kinds on one weekday. */
export async function applyWeekDaySortOrder(
  userId: string,
  weekStart: string,
  weekday: Weekday,
  dragIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const localDate = addDaysISO(weekStart, weekday - 1);
  const monthStart = monthStartFromDate(localDate);
  const dayOfMonth = Number(localDate.slice(8, 10));

  for (let i = 0; i < dragIds.length; i++) {
    const parsed = parseWeekPlanDragId(dragIds[i]);
    if (!parsed) return { ok: false, error: "Ogiltig aktivitet." };

    switch (parsed.kind) {
      case "task": {
        const { error } = await supabase
          .from("weekly_task_placements")
          .update({ day_sort_order: i })
          .eq("user_id", userId)
          .eq("task_id", parsed.entityId)
          .eq("week_start", weekStart);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "gym": {
        const { error } = await supabase
          .from("gym_week_placements")
          .update({ day_sort_order: i })
          .eq("user_id", userId)
          .eq("template_id", parsed.entityId)
          .eq("week_start", weekStart);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "cardio": {
        const { error } = await supabase
          .from("cardio_week_placements")
          .update({ day_sort_order: i })
          .eq("user_id", userId)
          .eq("template_id", parsed.entityId)
          .eq("week_start", weekStart);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "bathing": {
        if (parsed.bathingRole !== "placement") break;
        const { error } = await supabase
          .from("bathing_week_placements")
          .update({ day_sort_order: i })
          .eq("user_id", userId)
          .eq("id", parsed.entityId)
          .eq("week_start", weekStart);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "weight": {
        const { error } = await supabase
          .from("weight_week_plans")
          .update({ day_sort_order: i })
          .eq("user_id", userId)
          .eq("week_start", weekStart);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "monthly_bill": {
        if (!parsed.monthStart) {
          return { ok: false, error: "Ogiltig räkning." };
        }
        const { error } = await supabase
          .from("monthly_task_completions")
          .update({ day_sort_order: i })
          .eq("user_id", userId)
          .eq("task_id", parsed.entityId)
          .eq("month_start", parsed.monthStart)
          .eq("scheduled_day_of_month", dayOfMonth);
        if (error) return { ok: false, error: error.message };
        break;
      }
      default:
        break;
    }
  }

  return { ok: true };
}
