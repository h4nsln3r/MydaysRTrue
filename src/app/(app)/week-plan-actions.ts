"use server";

import { revalidatePath } from "next/cache";
import { resetCardioWeekToDefaultsAction } from "@/app/(app)/cardio-actions";
import { resetGymWeekToDefaultsAction } from "@/app/(app)/gym-actions";
import {
  placeWeeklyTaskAction,
  unplaceWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import {
  placeWeightWeekAction,
  setWeightWeekEnabledAction,
  unplaceWeightWeekAction,
} from "@/app/(app)/weight-actions";
import { createClient } from "@/lib/supabase/server";
import type { Weekday } from "@/lib/tasks";
import { getWeightDefaultWeekday } from "@/lib/weight.server";
import { parseWeekPlanDragId } from "@/lib/week-plan";
import {
  moveCardioSessionAction,
  unplaceCardioSessionAction,
} from "./cardio-actions";
import {
  moveGymSessionAction,
  unplaceGymSessionAction,
} from "./gym-actions";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isMonday(localDate: string): boolean {
  if (!ISO_DATE_RE.test(localDate)) return false;
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getDay() === 1;
}

/** Place any weekly activity onto a weekday. */
export async function placeWeekPlanItemAction(input: {
  dragId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  const parsed = parseWeekPlanDragId(input.dragId);
  if (!parsed) return { ok: false, error: "Ogiltig aktivitet." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  switch (parsed.kind) {
    case "task":
      return placeWeeklyTaskAction({
        taskId: parsed.entityId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "gym":
      return moveGymSessionAction({
        templateId: parsed.entityId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "cardio":
      return moveCardioSessionAction({
        templateId: parsed.entityId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "weight":
      return placeWeightWeekAction({
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    default:
      return { ok: false, error: "Okänd aktivitetstyp." };
  }
}

/** Move an activity back to the left backlog for this week. */
export async function unplaceWeekPlanItemAction(input: {
  dragId: string;
  weekStart: string;
}): Promise<ActionResult> {
  const parsed = parseWeekPlanDragId(input.dragId);
  if (!parsed) return { ok: false, error: "Ogiltig aktivitet." };
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  switch (parsed.kind) {
    case "task":
      return unplaceWeeklyTaskAction({
        taskId: parsed.entityId,
        weekStart: input.weekStart,
      });
    case "gym":
      return unplaceGymSessionAction({
        templateId: parsed.entityId,
        weekStart: input.weekStart,
      });
    case "cardio":
      return unplaceCardioSessionAction({
        templateId: parsed.entityId,
        weekStart: input.weekStart,
      });
    case "weight":
      return unplaceWeightWeekAction(input.weekStart);
    default:
      return { ok: false, error: "Okänd aktivitetstyp." };
  }
}

/** Reset this week's placements to each template's default weekday. */
export async function resetWeekPlanToDefaultsAction(
  weekStart: string,
): Promise<ActionResult> {
  if (!isMonday(weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const gymRes = await resetGymWeekToDefaultsAction(weekStart);
  if (!gymRes.ok) return gymRes;

  const cardioRes = await resetCardioWeekToDefaultsAction(weekStart);
  if (!cardioRes.ok) return cardioRes;

  const { data: tasks } = await supabase
    .from("weekly_tasks")
    .select("id, default_weekday")
    .eq("user_id", user.id)
    .is("archived_at", null);

  for (const t of tasks ?? []) {
    if (t.default_weekday == null) {
      await supabase
        .from("weekly_task_placements")
        .update({ weekday: null })
        .eq("user_id", user.id)
        .eq("task_id", t.id)
        .eq("week_start", weekStart);
      continue;
    }

    const { data: existing } = await supabase
      .from("weekly_task_placements")
      .select("id")
      .eq("user_id", user.id)
      .eq("task_id", t.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("weekly_task_placements")
        .update({ weekday: t.default_weekday })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("weekly_task_placements").insert({
        user_id: user.id,
        task_id: t.id,
        week_start: weekStart,
        weekday: t.default_weekday,
      });
    }
  }

  const defaultWeightDay = await getWeightDefaultWeekday(user.id);
  const { data: weightPlan } = await supabase
    .from("weight_week_plans")
    .select("enabled")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (weightPlan?.enabled) {
    await supabase
      .from("weight_week_plans")
      .update({ weekday: defaultWeightDay })
      .eq("user_id", user.id)
      .eq("week_start", weekStart);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Enable weight tracking for this week (shows in the unified board). */
export async function enableWeightWeekAction(
  weekStart: string,
): Promise<ActionResult> {
  const res = await setWeightWeekEnabledAction({ weekStart, enabled: true });
  if (!res.ok) return res;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const defaultWeekday = await getWeightDefaultWeekday(user.id);
  if (defaultWeekday != null) {
    await supabase
      .from("weight_week_plans")
      .update({ weekday: defaultWeekday })
      .eq("user_id", user.id)
      .eq("week_start", weekStart);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
