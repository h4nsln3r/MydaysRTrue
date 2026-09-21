import { addDaysISO, isoWeekdayFromLocalISO, todayLocalISO } from "@/lib/date";
import { WEEKDAY_LONG, WEEKDAY_SHORT, type Weekday } from "@/lib/tasks";

export type ShakeDrinkRule = {
  weekdays: Weekday[];
  /** Ignore stock made before this date (week-plan drag reset). */
  shakeResetOn?: string | null;
  /** Hide Gör shake on this calendar day (skipped from the day plan). */
  shakeSkippedOn?: string | null;
};

export const GOR_SHAKE_HABIT_KEY = "gor_shake";
export const SHAKE_QUANTITY_MIN = 1;
export const SHAKE_QUANTITY_MAX = 14;
/** Drink days when the habit has no weekday chips selected. Matches weekday-only shake intake. */
export const SHAKE_DRINK_WEEKDAYS_DEFAULT: Weekday[] = [1, 2, 3, 4, 5];

export interface ShakeBatch {
  madeOn: string;
  quantity: number;
}

export function isGorShakeHabit(habit: { key?: string }): boolean {
  return habit.key === GOR_SHAKE_HABIT_KEY;
}

export function parseShakeQuantity(raw: unknown): number | null {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < SHAKE_QUANTITY_MIN || n > SHAKE_QUANTITY_MAX) {
    return null;
  }
  return n;
}

export function shakeDrinkWeekdays(habit: ShakeDrinkRule): Weekday[] {
  return habit.weekdays.length > 0
    ? habit.weekdays
    : SHAKE_DRINK_WEEKDAYS_DEFAULT;
}

export function isShakeDrinkDay(
  habit: ShakeDrinkRule,
  localDate: string,
): boolean {
  const weekday = isoWeekdayFromLocalISO(localDate) as Weekday;
  return shakeDrinkWeekdays(habit).includes(weekday);
}

export function nextShakeDrinkDayOnOrAfter(
  habit: ShakeDrinkRule,
  localDate: string,
): string {
  let date = localDate;
  for (let i = 0; i < 21; i++) {
    if (isShakeDrinkDay(habit, date)) return date;
    date = addDaysISO(date, 1);
  }
  return localDate;
}

export function nextShakeDrinkDayAfter(
  habit: ShakeDrinkRule,
  localDate: string,
): string {
  return nextShakeDrinkDayOnOrAfter(habit, addDaysISO(localDate, 1));
}

function batchesAfterReset(
  habit: ShakeDrinkRule,
  batches: ShakeBatch[],
): ShakeBatch[] {
  const resetOn = habit.shakeResetOn ?? null;
  if (!resetOn) return batches;
  return batches.filter((b) => b.madeOn >= resetOn);
}

function sortedBatches(batches: ShakeBatch[]): ShakeBatch[] {
  return [...batches]
    .filter((b) => parseShakeQuantity(b.quantity) != null)
    .sort((a, b) => a.madeOn.localeCompare(b.madeOn));
}

/** Last drink day covered by a batch, given leftover stock ending `previousCoversUntil`. */
export function shakeCoversUntil(
  habit: ShakeDrinkRule,
  madeOn: string,
  quantity: number,
  previousCoversUntil: string | null,
): string {
  const count = parseShakeQuantity(quantity);
  if (count == null) return previousCoversUntil ?? madeOn;

  const includeMadeOn =
    isShakeDrinkDay(habit, madeOn) &&
    (previousCoversUntil == null || previousCoversUntil < madeOn);

  let covered = 0;
  let last = previousCoversUntil ?? madeOn;
  let date = includeMadeOn ? madeOn : addDaysISO(madeOn, 1);
  for (let i = 0; i < 60 && covered < count; i++) {
    if (isShakeDrinkDay(habit, date)) {
      covered += 1;
      last = date;
    }
    if (covered >= count) break;
    date = addDaysISO(date, 1);
  }
  return last;
}

export function shakeCoversUntilFromBatches(
  habit: ShakeDrinkRule,
  batches: ShakeBatch[],
  beforeDate: string,
): string | null {
  let prev: string | null = null;
  for (const batch of sortedBatches(batchesAfterReset(habit, batches))) {
    if (batch.madeOn >= beforeDate) break;
    prev = shakeCoversUntil(habit, batch.madeOn, batch.quantity, prev);
  }
  return prev;
}

/** Calendar day before the next uncovered drink day. */
export function shakeMakeDueOn(
  habit: ShakeDrinkRule,
  coversUntil: string | null,
  asOfDate: string,
): string {
  const nextUncovered =
    coversUntil == null
      ? nextShakeDrinkDayOnOrAfter(habit, asOfDate)
      : nextShakeDrinkDayAfter(habit, coversUntil);
  return addDaysISO(nextUncovered, -1);
}

export function gorShakeOccursOnDate(
  habit: ShakeDrinkRule,
  localDate: string,
  options: {
    completedOnDate?: boolean;
    batches?: ShakeBatch[];
    today?: string;
  } = {},
): boolean {
  if (options.completedOnDate) return true;
  if (habit.shakeSkippedOn && habit.shakeSkippedOn === localDate) return false;
  const resetOn = habit.shakeResetOn ?? null;
  const relevant = batchesAfterReset(habit, options.batches ?? []);
  if (resetOn && relevant.length === 0) {
    if (localDate < resetOn) return false;
    if (localDate === resetOn) return true;
    const today = options.today ?? todayLocalISO();
    return localDate <= today;
  }
  const coversUntil = shakeCoversUntilFromBatches(habit, relevant, localDate);
  const due = shakeMakeDueOn(habit, coversUntil, localDate);
  if (localDate < due) return false;
  if (localDate === due) return true;
  const today = options.today ?? todayLocalISO();
  return localDate <= today;
}

export function shakeDrinkDaysCoveredByBatch(
  habit: ShakeDrinkRule,
  madeOn: string,
  quantity: number,
  previousCoversUntil: string | null,
): string[] {
  const count = parseShakeQuantity(quantity);
  if (count == null) return [];

  const includeMadeOn =
    isShakeDrinkDay(habit, madeOn) &&
    (previousCoversUntil == null || previousCoversUntil < madeOn);

  const days: string[] = [];
  let date = includeMadeOn ? madeOn : addDaysISO(madeOn, 1);
  for (let i = 0; i < 60 && days.length < count; i++) {
    if (isShakeDrinkDay(habit, date)) days.push(date);
    date = addDaysISO(date, 1);
  }
  return days;
}

export function shakeSchedulePreview(
  habit: ShakeDrinkRule,
  madeOn: string,
  quantity: number,
  existingBatches: ShakeBatch[] = [],
): {
  drinkDays: string[];
  coversUntil: string;
  nextMakeOn: string;
} | null {
  const count = parseShakeQuantity(quantity);
  if (count == null) return null;
  const previous = shakeCoversUntilFromBatches(habit, existingBatches, madeOn);
  const drinkDays = shakeDrinkDaysCoveredByBatch(
    habit,
    madeOn,
    count,
    previous,
  );
  if (drinkDays.length === 0) return null;
  const coversUntil = drinkDays[drinkDays.length - 1];
  const nextMakeOn = shakeMakeDueOn(habit, coversUntil, madeOn);
  return { drinkDays, coversUntil, nextMakeOn };
}

function weekdayLabel(localDate: string, long: boolean): string {
  const wd = isoWeekdayFromLocalISO(localDate) as Weekday;
  return long ? WEEKDAY_LONG[wd].toLowerCase() : WEEKDAY_SHORT[wd].toLowerCase();
}

export function shakeScheduleHint(
  habit: ShakeDrinkRule,
  madeOn: string,
  quantity: number,
  existingBatches: ShakeBatch[] = [],
): string | null {
  const preview = shakeSchedulePreview(
    habit,
    madeOn,
    quantity,
    existingBatches,
  );
  if (!preview) return null;
  const { drinkDays, nextMakeOn } = preview;
  const first = weekdayLabel(drinkDays[0], false);
  const last = weekdayLabel(drinkDays[drinkDays.length - 1], false);
  const drinkRange =
    drinkDays.length === 1 ? first : `${first}–${last}`;
  return `Räcker ${drinkRange} · nästa gång ${weekdayLabel(nextMakeOn, true)}`;
}
