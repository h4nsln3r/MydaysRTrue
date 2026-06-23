import { addDaysISO } from "@/lib/date";
import type { PeriodView } from "@/lib/period-view";

export function weekNavHref(weekStart: string, view: PeriodView): string {
  return view === "plan"
    ? `/week?start=${weekStart}&view=plan`
    : `/week?start=${weekStart}`;
}

export function weekNavKicker(
  weekStart: string,
  currentWeekStart: string,
): string {
  const nextWeekStart = addDaysISO(currentWeekStart, 7);
  if (weekStart === currentWeekStart) return "Den här veckan";
  if (weekStart === nextWeekStart) return "Nästa vecka";
  return "Tidigare vecka";
}

export function weekNavState(
  weekStart: string,
  currentWeekStart: string,
): {
  prevStart: string;
  nextStart: string;
  canGoForward: boolean;
} {
  const nextWeekStart = addDaysISO(currentWeekStart, 7);
  return {
    prevStart: addDaysISO(weekStart, -7),
    nextStart: addDaysISO(weekStart, 7),
    canGoForward: weekStart < nextWeekStart,
  };
}

/** Preserve ?start= (and plan view) when re-tapping Week in the bottom nav. */
export function weekTabHref(
  pathname: string,
  searchParams: URLSearchParams,
): string {
  if (!pathname.startsWith("/week")) return "/week";
  const start = searchParams.get("start");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return "/week";
  const view = searchParams.get("view");
  return view === "plan" ? `/week?start=${start}&view=plan` : `/week?start=${start}`;
}
