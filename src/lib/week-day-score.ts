import type { HabitStatus } from "@/lib/habits";
import { habitStatusPoints } from "@/lib/habits";
import { waterDayStatus } from "@/lib/water";

export type WeekDayScoreBand = "good" | "mid" | "low" | "future";

export interface WeekDayScoreResult {
  hit: number;
  total: number;
  pct: number;
  band: WeekDayScoreBand;
}

/** Per-day status for the sticky week jump menu (same bands as week progress %). */
export interface WeekDayJumpDayStatus {
  date: string;
  band: WeekDayScoreBand;
  pct: number;
  hit: number;
  total: number;
}

/** Same scoring as the week progress footer day %. */
export function computeWeekDayScore(input: {
  isFuture: boolean;
  water: { goalMet: boolean; progress: number };
  /** One entry per counted habit; `"yes"` = 1, `"half"` = 0.5. */
  habitStatuses: Array<HabitStatus | null | undefined>;
  /** One entry per training/bathing session on that day; true = done. */
  sessionsDone: boolean[];
  /** `null` = no tasks that day; otherwise whether every task is done. */
  tasksAllDone: boolean | null;
  weightScheduled: boolean;
  weightLogged: boolean;
}): WeekDayScoreResult {
  if (input.isFuture) {
    return { hit: 0, total: 0, pct: 0, band: "future" };
  }

  let hit = 0;
  let total = 0;

  total += 1;
  if (
    waterDayStatus({
      isFuture: false,
      goalMet: input.water.goalMet,
      progress: input.water.progress,
    }) === "good"
  ) {
    hit += 1;
  }

  for (const status of input.habitStatuses) {
    total += 1;
    hit += habitStatusPoints(status);
  }

  for (const done of input.sessionsDone) {
    total += 1;
    if (done) hit += 1;
  }

  if (input.tasksAllDone != null) {
    total += 1;
    if (input.tasksAllDone) hit += 1;
  }

  if (input.weightScheduled) {
    total += 1;
    if (input.weightLogged) hit += 1;
  }

  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;
  const band: WeekDayScoreBand =
    pct >= 80 ? "good" : pct >= 50 ? "mid" : "low";

  return { hit, total, pct, band };
}
