/** Returns today's date in the user's local timezone as YYYY-MM-DD. */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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
