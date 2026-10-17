"use server";

import { addBathingPlacementAction } from "@/app/(app)/bathing-actions";
import { addCardioPlacementAction } from "@/app/(app)/cardio-actions";
import { moveGymSessionAction } from "@/app/(app)/gym-actions";
import { addSportPlacementAction } from "@/app/(app)/sport-actions";
import {
  addWeeklyTaskPlacementAction,
  placeWeeklyTaskAction,
} from "@/app/(app)/tasks-actions";
import type { DayQuickAddPayload } from "@/lib/day-quick-add";
import { addDaysISO } from "@/lib/date";
import {
  isCodingWeeklyTaskKey,
  isGameWeeklyTaskKey,
  isRingWeeklyTaskKey,
  isWeeklyTaskRepeatable,
  parseCodingActivity,
  parseMusicActivity,
  parseRingPerson,
  parseSpendKindFor,
  type Weekday,
  type WeeklyTaskCompletionKind,
} from "@/lib/tasks";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function isMonday(localDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return false;
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getDay() === 1;
}

async function placeShake(input: {
  habitId: string;
  weekStart: string;
  weekday: Weekday;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: habit } = await supabase
    .from("habits")
    .select("id, key, shake_reset_on")
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!habit || habit.key !== "gor_shake") {
    return { ok: false, error: "Hittade inte Gör shake." };
  }

  const localDate = addDaysISO(input.weekStart, input.weekday - 1);
  const { error } = await supabase
    .from("habits")
    .update({
      shake_placed_on: localDate,
      shake_skipped_on: null,
      // A same-day restart drops earlier batches. The plus button only
      // pins the task; stock keeps counting after it is logged.
      ...(habit.shake_reset_on === localDate ? { shake_reset_on: null } : {}),
    })
    .eq("id", habit.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Drop a week-plan standard onto the day, including the chosen variant. */
export async function quickAddDayActivityAction(input: {
  weekStart: string;
  weekday: Weekday;
  payload: DayQuickAddPayload;
}): Promise<ActionResult> {
  if (!isMonday(input.weekStart)) {
    return { ok: false, error: "Veckan måste börja på en måndag." };
  }
  if (input.weekday < 1 || input.weekday > 7) {
    return { ok: false, error: "Ogiltig veckodag." };
  }

  const { payload } = input;

  switch (payload.kind) {
    case "gym":
      return moveGymSessionAction({
        templateId: payload.templateId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "cardio":
      return addCardioPlacementAction({
        templateId: payload.templateId,
        weekStart: input.weekStart,
        weekday: input.weekday,
        planKind: payload.planKind,
      });
    case "sport":
      return addSportPlacementAction({
        templateId: payload.templateId,
        weekStart: input.weekStart,
        weekday: input.weekday,
        sportId: payload.sportId,
      });
    case "bathing":
      return addBathingPlacementAction({
        templateId: payload.templateId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "shake":
      return placeShake({
        habitId: payload.habitId,
        weekStart: input.weekStart,
        weekday: input.weekday,
      });
    case "task":
      return addPlannedWeeklyTask({
        taskId: payload.taskId,
        weekStart: input.weekStart,
        weekday: input.weekday,
        musicActivity: payload.musicActivity,
        band: payload.band,
        spendKind: payload.spendKind,
        gameId: payload.gameId,
        callPerson: payload.callPerson,
        callOtherName: payload.callOtherName,
        codingActivity: payload.codingActivity,
      });
    default:
      return { ok: false, error: "Okänd aktivitet." };
  }
}

async function addPlannedWeeklyTask(input: {
  taskId: string;
  weekStart: string;
  weekday: Weekday;
  musicActivity?: string | null;
  band?: string | null;
  spendKind?: string | null;
  gameId?: string | null;
  callPerson?: string | null;
  callOtherName?: string | null;
  codingActivity?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { data: task } = await supabase
    .from("weekly_tasks")
    .select("id, key, completion_kind, is_repeatable")
    .eq("id", input.taskId)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!task) return { ok: false, error: "Uppgiften hittades inte." };
  if (
    !isWeeklyTaskRepeatable({
      key: task.key,
      isRepeatable: task.is_repeatable,
    })
  ) {
    return placeWeeklyTaskAction({
      taskId: input.taskId,
      weekStart: input.weekStart,
      weekday: input.weekday,
    });
  }

  const kind = task.completion_kind as WeeklyTaskCompletionKind;
  const isGame = isGameWeeklyTaskKey(task.key);
  const isRing = isRingWeeklyTaskKey(task.key);
  const isCoding = isCodingWeeklyTaskKey(task.key);

  if (kind === "music" && !parseMusicActivity(input.musicActivity ?? null)) {
    return { ok: false, error: "Välj vad du ska göra." };
  }
  if (
    (kind === "shop" || kind === "expense") &&
    !parseSpendKindFor(kind, input.spendKind ?? null)
  ) {
    return {
      ok: false,
      error:
        kind === "shop"
          ? "Välj om det är mat, privat eller delat."
          : "Välj om utgiften är privat eller delad.",
    };
  }
  if (isGame && !input.gameId?.trim()) {
    return { ok: false, error: "Välj vad ni ska spela." };
  }
  if (isRing && !parseRingPerson(input.callPerson ?? null)) {
    return { ok: false, error: "Välj vem du ska ringa." };
  }
  if (isCoding && !parseCodingActivity(input.codingActivity ?? null)) {
    return { ok: false, error: "Välj kodning, lära eller friend kod." };
  }

  return addWeeklyTaskPlacementAction({
    taskId: input.taskId,
    weekStart: input.weekStart,
    weekday: input.weekday,
    musicActivity: input.musicActivity,
    band: input.band,
    spendKind: input.spendKind,
    gameId: input.gameId,
    callPerson: input.callPerson,
    callOtherName: input.callOtherName,
    codingActivity: input.codingActivity,
  });
}
