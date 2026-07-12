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
  totalLength: number | null;
  sortOrder: number;
  /** Highest logged position this year for this item. */
  bestPosition: number;
  completed: boolean;
  lastActivityDate: string | null;
}

export interface MediaDayLog {
  mediaItemId: string;
  position: number;
  didConsume: boolean;
}

export interface DailyMediaContext {
  localDate: string;
  year: number;
  /** Incomplete titles only — completed ones are hidden in the day view. */
  items: MediaItem[];
  dayLog: MediaDayLog | null;
  /** Item logged today, even if now marked complete. */
  loggedItem: MediaItem | null;
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

export function mediaCompletionPrompt(kind: MediaKind): string {
  if (kind === "book") return "Klart! Vad tyckte du om boken?";
  if (kind === "series") return "Klart! Vad tyckte du om serien?";
  return "Klart! Vad tyckte du om filmen?";
}

/** Whether logging this position marks the item as newly complete. */
export function mediaDayLogDetail(
  item: MediaItem,
  position: number,
  didConsume: boolean,
): string {
  if (item.kind === "movie") {
    return didConsume ? `${item.title} · Sedd` : item.title;
  }
  if (position > 0) {
    const unit = item.kind === "book" ? "sida" : "avsnitt";
    const progress =
      item.totalLength && item.totalLength > 0
        ? `${position}/${item.totalLength} ${unit}`
        : `${unit} ${position}`;
    return `${item.title} · ${progress}`;
  }
  return item.title;
}

export function isMediaDayLogDone(
  dayLog: MediaDayLog | null,
): boolean {
  if (!dayLog) return false;
  return dayLog.didConsume || dayLog.position > 0;
}

/** Whether logging this position marks the item as newly complete. */
export function willCompleteMediaItem(
  item: MediaItem,
  position: number,
  didConsume: boolean,
): boolean {
  if (item.completed) return false;
  if (item.kind === "movie") return didConsume;
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
    return item.completed ? "Sedd" : null;
  }
  if (item.totalLength && item.bestPosition > 0) {
    const unit = item.kind === "book" ? "sida" : "avsnitt";
    return `${item.bestPosition} / ${item.totalLength} ${unit}`;
  }
  if (item.bestPosition > 0) {
    return item.kind === "book"
      ? `Sida ${item.bestPosition}`
      : `Avsnitt ${item.bestPosition}`;
  }
  return null;
}

export function mediaStatusFor(
  dayLog: MediaDayLog | null,
  isFuture: boolean,
): HabitStatus | null {
  if (isFuture || !dayLog) return null;
  if (dayLog.didConsume || dayLog.position > 0) return "yes";
  return "no";
}

export function mediaProgressPct(item: MediaItem): number {
  if (!item.totalLength || item.totalLength <= 0) return 0;
  return Math.min(100, Math.round((item.bestPosition / item.totalLength) * 100));
}

export function isMediaCompleted(item: MediaItem): boolean {
  if (item.kind === "movie") return item.bestPosition > 0;
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
