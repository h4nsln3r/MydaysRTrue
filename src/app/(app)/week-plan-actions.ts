"use server";

import { revalidatePath } from "next/cache";
import { resetBathingWeekToDefaultsAction } from "@/app/(app)/bathing-actions";
import { resetCardioWeekToDefaultsAction } from "@/app/(app)/cardio-actions";
import { resetSportWeekToDefaultsAction } from "@/app/(app)/sport-actions";
import { resetGymWeekToDefaultsAction } from "@/app/(app)/gym-actions";
import {
  placeWeeklyTaskAction,
  unplaceWeeklyTaskAction,
  placeMonthlyBillFromWeekAction,
  unplaceMonthlyBillFromWeekAction,
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
  applyWeekDaySortOrder,
} from "@/lib/week-plan-order.server";
import {
  addBathingPlacementAction,
  deleteBathingPlacementAction,
  moveBathingPlacementAction,
} from "./bathing-actions";
import {
  moveCardioSessionAction,
  unplaceCardioSessionAction,
} from "./cardio-actions";
import {
  moveSportSessionAction,
  unplaceSportSessionAction,
} from "./sport-actions";
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
    case "sport":
      return moveSportSessionAction({
        templateId: parsed.entityId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "bathing":
      if (parsed.bathingRole === "source") {
        return addBathingPlacementAction({
          templateId: parsed.entityId,
          weekStart: input.weekStart,
          weekday: input.weekday,
        });
      }
      return moveBathingPlacementAction({
        placementId: parsed.entityId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "weight":
      return placeWeightWeekAction({
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "monthly_bill":
      return placeMonthlyBillFromWeekAction({
        taskId: parsed.entityId,
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
    case "sport":
      return unplaceSportSessionAction({
        templateId: parsed.entityId,
        weekStart: input.weekStart,
      });
    case "bathing":
      if (parsed.bathingRole === "source") {
        return { ok: true };
      }
      return deleteBathingPlacementAction({
        placementId: parsed.entityId,
        weekStart: input.weekStart,
      });
    case "weight":
      return unplaceWeightWeekAction(input.weekStart);
    case "monthly_bill":
      if (!parsed.monthStart) {
        return { ok: false, error: "Ogiltig räkning." };
      }
      return unplaceMonthlyBillFromWeekAction({
        taskId: parsed.entityId,
        monthStart: parsed.monthStart,
        weekStart: input.weekStart,
      });
    default:
      return { ok: false, error: "Okänd aktivitetstyp." };
  }
}

/** Reorder all placed activities on one weekday (tasks, training, weight, bills). */
export async function reorderWeekPlanDayAction(input: {
  weekStart: string;
  weekday: Weekday;
  dragIds: string[];
}): Promise<ActionResult> {
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }
  if (input.weekday < 1 || input.weekday > 7) {
    return { ok: false, error: "Ogiltig veckodag." };
  }
  if (input.dragIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const result = await applyWeekDaySortOrder(
    user.id,
    input.weekStart,
    input.weekday,
    input.dragIds,
  );
  if (!result.ok) return result;

  revalidatePath("/", "layout");
  return { ok: true };
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

  const sportRes = await resetSportWeekToDefaultsAction(weekStart);
  if (!sportRes.ok) return sportRes;

  const bathingRes = await resetBathingWeekToDefaultsAction(weekStart);
  if (!bathingRes.ok) return bathingRes;

  const { data: tasks } = await supabase
    .from("weekly_tasks")
    .select("id, default_weekday")
    .eq("user_id", user.id)
    .is("archived_at", null);

  const dayOrderCursor = new Map<number, number>();
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

    const daySortOrder = dayOrderCursor.get(t.default_weekday) ?? 0;
    dayOrderCursor.set(t.default_weekday, daySortOrder + 1);

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
        .update({
          weekday: t.default_weekday,
          day_sort_order: daySortOrder,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("weekly_task_placements").insert({
        user_id: user.id,
        task_id: t.id,
        week_start: weekStart,
        weekday: t.default_weekday,
        day_sort_order: daySortOrder,
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
