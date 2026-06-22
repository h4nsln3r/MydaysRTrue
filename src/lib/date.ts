/** Returns the YYYY-MM-DD for the Sunday of the ISO week containing `localDate`. */
export function weekEndISO(localDate: string | Date = new Date()): string {
  const start =
    typeof localDate === "string"
      ? weekStartISO(parseLocalISO(localDate))
      : weekStartISO(localDate);
  return addDaysISO(start, 6);
}

/** True when `localDate` is today or later this ISO week (Mon–Sun). */
export function isUpcomingWeekDay(
  localDate: string,
  today: string = todayLocalISO(),
): boolean {
  return localDate > today && localDate <= weekEndISO(today);
}

/** Returns today's date in the user's local timezone as YYYY-MM-DD. */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  // Fixed 24h format — avoids SSR/client locale mismatch (e.g. "06:17" vs "06:17 AM").
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDateLong(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Parses YYYY-MM-DD into a local Date at midnight (no timezone shifts). */
export function parseLocalISO(localDate: string): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** ISO weekday from YYYY-MM-DD: 1 = Mon … 7 = Sun. */
export function isoWeekdayFromLocalISO(localDate: string): number {
  const dt = parseLocalISO(localDate);
  const jsDow = dt.getDay(); // 0 = Sun
  return ((jsDow + 6) % 7) + 1;
}

/** Returns the YYYY-MM-DD for the Monday of the ISO week containing `date`. */
export function weekStartISO(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return todayLocalISO(d);
}

/** Returns YYYY-MM-DD that is `days` away from `localDate` (can be negative). */
export function addDaysISO(localDate: string, days: number): string {
  const dt = parseLocalISO(localDate);
  dt.setDate(dt.getDate() + days);
  return todayLocalISO(dt);
}

/** ISO 8601 week number (1–53). */
export function isoWeekNumber(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Shift to Thursday in current ISO week; that determines week-year.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const daysFromWeek1 = (d.getTime() - week1.getTime()) / 86_400_000;
  return 1 + Math.round((daysFromWeek1 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** e.g. "Week 22 · May 25–31" — collapses month suffix when range stays in one month. */
export function formatWeekLabel(weekStart: string): string {
  const start = parseLocalISO(weekStart);
  const end = parseLocalISO(addDaysISO(weekStart, 6));
  const sameMonth = start.getMonth() === end.getMonth();
  const startFmt = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endFmt = sameMonth
    ? end.toLocaleDateString(undefined, { day: "numeric" })
    : end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week ${isoWeekNumber(start)} · ${startFmt}–${endFmt}`;
}

/** Short weekday for a YYYY-MM-DD — e.g. "Mon". */
export function formatWeekdayShort(localDate: string): string {
  return parseLocalISO(localDate).toLocaleDateString(undefined, { weekday: "short" });
}

/** Short day-of-month for a YYYY-MM-DD — e.g. "May 25". */
export function formatDayShort(localDate: string): string {
  return parseLocalISO(localDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Full long format for a YYYY-MM-DD — e.g. "Tuesday, May 26". */
export function formatDayLong(localDate: string): string {
  return parseLocalISO(localDate).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Bottom nav badge — e.g. "22/06". */
export function formatNavDayBadge(localDate: string = todayLocalISO()): string {
  const [, m, d] = localDate.split("-");
  return `${d}/${m}`;
}

/** Bottom nav badge — e.g. "v.25". */
export function formatNavWeekBadge(localDate: string = todayLocalISO()): string {
  return `v.${isoWeekNumber(parseLocalISO(localDate))}`;
}

/** Bottom nav badge — e.g. "Juni". */
export function formatNavMonthBadge(localDate: string = todayLocalISO()): string {
  const name = parseLocalISO(localDate).toLocaleDateString("sv-SE", {
    month: "long",
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Bottom nav badge — e.g. "2026". */
export function formatNavYearBadge(localDate: string = todayLocalISO()): string {
  return localDate.slice(0, 4);
}
