// Client-safe media types and helpers.

import type { HabitStatus } from "@/lib/habits";

export type MediaKind = "book" | "series" | "movie";

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  book: "Bok",
  series: "Serie",
  movie: "Film",
};

export const MEDIA_KIND_ICON: Record<MediaKind, string> = {
  book: "📖",
  series: "📺",
  movie: "🎬",
};

export interface MediaItem {
  id: string;
  year: number;
  kind: MediaKind;
  title: string;
  /** Book author. */
  author: string | null;
  /** Movie director. */
  director: string | null;
  /** Movie cast (free text). */
  actors: string | null;
  /** Optional comment when the item was added (films & series). */
  note: string | null;
  /** Optional 1–10 rating. */
  rating: number | null;
  /** Which season is being watched (series only). */
  season: number | null;
  totalLength: number | null;
  sortOrder: number;
  /** Highest logged position this year for this item. */
  bestPosition: number;
  completed: boolean;
  lastActivityDate: string | null;
  /** Local calendar date when finished (nullable until set). */
  completedOn: string | null;
}

export interface MediaDayLog {
  mediaItemId: string;
  position: number;
  didConsume: boolean;
}

export interface MediaDayLogEntry {
  log: MediaDayLog;
  item: MediaItem;
}

export interface DailyMediaContext {
  localDate: string;
  year: number;
  /** Incomplete titles not yet logged today. */
  items: MediaItem[];
  /** All logs for this day. */
  dayLogs: MediaDayLog[];
  /** Titles logged today (including completed), with their log. */
  loggedToday: MediaDayLogEntry[];
  /** True when every title for the year is finished. */
  allCompleted: boolean;
}

export interface MonthMediaEntry {
  localDate: string;
  item: MediaItem;
  position: number;
  didConsume: boolean;
}

export interface MonthMediaContext {
  monthStart: string;
  entries: MonthMediaEntry[];
}

export interface YearMediaContext {
  year: number;
  items: MediaItem[];
}

export function yearFromLocalISO(localDate: string): number {
  return Number(localDate.slice(0, 4));
}

export const MEDIA_RATING_MIN = 1;
export const MEDIA_RATING_MAX = 10;
export const MEDIA_SEASON_MIN = 1;
export const MEDIA_SEASON_MAX = 100;

export function mediaRatingLabel(rating: number | null): string | null {
  if (rating == null) return null;
  return `${rating}/10`;
}

/** Author or director/actors line for subtitles. */
export function mediaCreditsLabel(item: MediaItem): string | null {
  if (item.kind === "book" && item.author) return item.author;
  if (item.kind === "movie") {
    const parts: string[] = [];
    if (item.director) parts.push(item.director);
    if (item.actors) parts.push(item.actors);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return null;
}

export function mediaSeasonLabel(season: number | null | undefined): string | null {
  if (season == null) return null;
  return `Säsong ${season}`;
}

export function mediaDisplayTitle(
  item: Pick<MediaItem, "title" | "kind" | "season">,
): string {
  const season = item.kind === "series" ? mediaSeasonLabel(item.season) : null;
  return season ? `${item.title} · ${season}` : item.title;
}

export function nextMediaSeason(season: number | null | undefined): number {
  return (season ?? 0) + 1;
}

export function mediaCompletionPrompt(kind: MediaKind): string {
  if (kind === "book") return "Klart! Vad tyckte du om boken?";
  if (kind === "series") return "Klart! Vad tyckte du om säsongen?";
  return "Klart! Vad tyckte du om filmen?";
}

/** Series on the last episode, or a movie that has been logged as watched. */
export function isMediaAtEnd(
  item: Pick<MediaItem, "kind" | "bestPosition" | "totalLength">,
): boolean {
  if (item.kind === "movie") return item.bestPosition > 0;
  if (item.kind === "series" && item.totalLength && item.totalLength > 0) {
    return item.bestPosition >= item.totalLength;
  }
  return false;
}

/**
 * Last episode or a movie watch, while the title still has no rating.
 * Series and movies stay in progress until they are rated.
 */
export function isMediaFinaleLog(
  item: Pick<MediaItem, "kind" | "totalLength" | "rating">,
  position: number,
  didConsume: boolean,
): boolean {
  if (item.rating != null) return false;
  if (item.kind === "movie") return didConsume;
  if (item.kind === "series" && item.totalLength && item.totalLength > 0) {
    return position === item.totalLength;
  }
  return false;
}

export function mediaDayLogDetail(
  item: MediaItem,
  position: number,
  didConsume: boolean,
): string {
  const title = mediaDisplayTitle(item);
  if (item.kind === "movie") {
    return didConsume ? `${title} · Sedd` : title;
  }
  if (position > 0) {
    const unit = item.kind === "book" ? "sida" : "avsnitt";
    const progress =
      item.totalLength && item.totalLength > 0
        ? `${position}/${item.totalLength} ${unit}`
        : `${unit} ${position}`;
    return `${title} · ${progress}`;
  }
  return title;
}

export function isMediaDayLogDone(log: MediaDayLog): boolean {
  return log.didConsume || log.position > 0;
}

export function hasMediaDayActivity(dayLogs: MediaDayLog[]): boolean {
  return dayLogs.some(isMediaDayLogDone);
}

export function mediaDaySummary(entries: MediaDayLogEntry[]): string | null {
  const parts = entries
    .filter(({ log }) => isMediaDayLogDone(log))
    .map(({ log, item }) => mediaDayLogDetail(item, log.position, log.didConsume));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Whether logging this position marks the item as newly complete. */
export function willCompleteMediaItem(
  item: MediaItem,
  position: number,
  _didConsume: boolean,
): boolean {
  if (item.completed) return false;
  // Series and movies finish when a rating is saved, not when the last
  // episode (or the movie) is logged.
  if (item.kind === "series" || item.kind === "movie") return false;
  if (item.totalLength && item.totalLength > 0) {
    return position >= item.totalLength;
  }
  return false;
}

export function mediaPositionLabel(kind: MediaKind): string {
  if (kind === "book") return "Sida du är på";
  if (kind === "series") return "Avsnitt du är på";
  return "Tittade";
}

export function mediaProgressLabel(item: MediaItem): string | null {
  if (item.kind === "movie") {
    if (item.completed) return "Sedd";
    if (item.bestPosition > 0) return "Sedd · inget betyg";
    return null;
  }
  if (item.totalLength && item.bestPosition > 0) {
    const unit = item.kind === "book" ? "sida" : "avsnitt";
    const base = `${item.bestPosition} / ${item.totalLength} ${unit}`;
    if (
      item.kind === "series" &&
      item.rating == null &&
      item.bestPosition >= item.totalLength
    ) {
      return `${base} · inget betyg`;
    }
    return base;
  }
  if (item.bestPosition > 0) {
    return item.kind === "book"
      ? `Sida ${item.bestPosition}`
      : `Avsnitt ${item.bestPosition}`;
  }
  return null;
}

export function mediaStatusFor(
  dayLogs: MediaDayLog[],
  isFuture: boolean,
): HabitStatus | null {
  if (isFuture || dayLogs.length === 0) return null;
  if (hasMediaDayActivity(dayLogs)) return "yes";
  return "no";
}

export function mediaProgressPct(item: MediaItem): number {
  if (!item.totalLength || item.totalLength <= 0) return 0;
  return Math.min(100, Math.round((item.bestPosition / item.totalLength) * 100));
}

export function isMediaCompleted(item: MediaItem): boolean {
  if (item.kind === "series" || item.kind === "movie") {
    if (item.rating == null) return false;
    return isMediaAtEnd(item) || item.completedOn != null;
  }
  if (item.totalLength && item.totalLength > 0) {
    return item.bestPosition >= item.totalLength;
  }
  return false;
}

export function mediaYearGroups(items: MediaItem[]): {
  completed: MediaItem[];
  inProgress: MediaItem[];
  notStarted: MediaItem[];
} {
  const completed: MediaItem[] = [];
  const inProgress: MediaItem[] = [];
  const notStarted: MediaItem[] = [];

  for (const item of items) {
    if (item.completed) completed.push(item);
    else if (item.bestPosition > 0 || item.lastActivityDate) inProgress.push(item);
    else notStarted.push(item);
  }

  return { completed, inProgress, notStarted };
}
