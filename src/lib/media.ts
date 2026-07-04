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
  items: MediaItem[];
  dayLog: MediaDayLog | null;
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
