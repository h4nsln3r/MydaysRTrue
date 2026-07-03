import { parseLocalISO, todayLocalISO, weekStartISO } from "@/lib/date";
import type { PeriodView } from "@/lib/period-view";

/** How many calendar months ahead can be opened in plan view. */
export const PLAN_MONTHS_AHEAD = 12;

export function monthStartFromYm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function shiftMonthStartISO(monthStart: string, deltaMonths: number): string {
  const [y, m] = monthStart.slice(0, 7).split("-").map(Number);
  const m0 = m - 1 + deltaMonths;
  const year = y + Math.floor(m0 / 12);
  const month = ((m0 % 12) + 12) % 12 + 1;
  return monthStartFromYm(year, month);
}

export function todayYearMonth(today: string = todayLocalISO()): {
  year: number;
  month: number;
} {
  return {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  };
}

export function maxPlanMonthStart(today: string = todayLocalISO()): string {
  const todayMonth = `${today.slice(0, 7)}-01`;
  return shiftMonthStartISO(todayMonth, PLAN_MONTHS_AHEAD);
}

export function isFutureMonth(
  monthStart: string,
  today: string = todayLocalISO(),
): boolean {
  return monthStart > `${today.slice(0, 7)}-01`;
}

export function isWithinPlanHorizon(
  monthStart: string,
  today: string = todayLocalISO(),
): boolean {
  const todayMonth = `${today.slice(0, 7)}-01`;
  return monthStart >= todayMonth && monthStart <= maxPlanMonthStart(today);
}

/** Clamp navigation target for month page (progress = past/current only). */
export function clampMonthNavigation(
  year: number,
  month: number,
  view: PeriodView,
  today: string = todayLocalISO(),
): { year: number; month: number } {
  if (view === "plan") {
    const max = maxPlanMonthStart(today);
    const maxYear = Number(max.slice(0, 4));
    const maxMonth = Number(max.slice(5, 7));
    if (
      year > maxYear ||
      (year === maxYear && month > maxMonth)
    ) {
      return { year: maxYear, month: maxMonth };
    }
    return { year, month };
  }

  const { year: ty, month: tm } = todayYearMonth(today);
  if (year > ty || (year === ty && month > tm)) {
    return { year: ty, month: tm };
  }
  return { year, month };
}

/** Last ISO week start that still overlaps the plan horizon. */
export function maxPlanWeekStart(today: string = todayLocalISO()): string {
  const maxMonth = maxPlanMonthStart(today);
  const [y, m] = maxMonth.slice(0, 7).split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${maxMonth.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  return weekStartISO(parseLocalISO(monthEnd));
}
