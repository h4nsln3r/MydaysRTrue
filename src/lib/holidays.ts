// Swedish public holidays and the eves people normally have off.
// Client-safe: no database, just the calendar.

import { addDaysISO, isoWeekdayFromLocalISO } from "@/lib/date";

export interface PublicHoliday {
  date: string;
  name: string;
  /** Fits the month-view job cell. Full name is the tooltip. */
  short: string;
}

const byYear = new Map<number, Map<string, PublicHoliday>>();

/** Anonymous Gregorian computus. Returns påskdagen as YYYY-MM-DD. */
function easterSundayISO(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** First ISO weekday (1=Mon … 7=Sun) on or between the two YYYY-MM-DD dates. */
function firstWeekdayBetween(
  start: string,
  end: string,
  isoWeekday: number,
): string {
  let cursor = start;
  while (cursor <= end) {
    if (isoWeekdayFromLocalISO(cursor) === isoWeekday) return cursor;
    cursor = addDaysISO(cursor, 1);
  }
  throw new Error(`No weekday ${isoWeekday} between ${start} and ${end}`);
}

function buildYear(year: number): Map<string, PublicHoliday> {
  const easter = easterSundayISO(year);
  const midsummer = firstWeekdayBetween(
    `${year}-06-20`,
    `${year}-06-26`,
    6,
  );
  const allSaints = firstWeekdayBetween(
    `${year}-10-31`,
    `${year}-11-06`,
    6,
  );
  const dated: Array<[string, string, string]> = [
    [`${year}-01-01`, "Nyårsdagen", "Nyår"],
    [`${year}-01-06`, "Trettondedag jul", "6 jan"],
    [addDaysISO(easter, -2), "Långfredagen", "Lång\nfre"],
    [addDaysISO(easter, -1), "Påskafton", "Påsk\naft"],
    [easter, "Påskdagen", "Påsk"],
    [addDaysISO(easter, 1), "Annandag påsk", "Påsk\n+1"],
    [`${year}-05-01`, "Första maj", "1 maj"],
    [addDaysISO(easter, 39), "Kristi himmelsfärdsdag", "Him\nfärd"],
    [addDaysISO(easter, 49), "Pingstdagen", "Ping\ndag"],
    [`${year}-06-06`, "Sveriges nationaldag", "6 jun"],
    [addDaysISO(midsummer, -1), "Midsommarafton", "Mids\naft"],
    [midsummer, "Midsommardagen", "Mids"],
    [allSaints, "Alla helgons dag", "Alla\nhelg"],
    [`${year}-12-24`, "Julafton", "Jul\naft"],
    [`${year}-12-25`, "Juldagen", "Jul"],
    [`${year}-12-26`, "Annandag jul", "Jul\n+1"],
    [`${year}-12-31`, "Nyårsafton", "Nyår\naft"],
  ];
  const map = new Map<string, PublicHoliday>();
  for (const [date, name, short] of dated) {
    map.set(date, { date, name, short });
  }
  return map;
}

export function publicHolidayMap(year: number): Map<string, PublicHoliday> {
  const cached = byYear.get(year);
  if (cached) return cached;
  const map = buildYear(year);
  byYear.set(year, map);
  return map;
}

export function publicHolidayOn(localDate: string): PublicHoliday | null {
  const year = Number(localDate.slice(0, 4));
  if (!Number.isInteger(year)) return null;
  return publicHolidayMap(year).get(localDate) ?? null;
}
