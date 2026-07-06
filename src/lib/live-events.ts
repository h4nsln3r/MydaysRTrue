// Client-safe live event types and helpers.

import type { HabitStatus } from "@/lib/habits";

export type LiveEventKind = "concert" | "sport" | "race" | "birthday" | "wedding" | "other";

export const LIVE_EVENT_KIND_LABEL: Record<LiveEventKind, string> = {
  concert: "Konsert",
  sport: "Sport",
  race: "Lopp",
  birthday: "Födelsedag",
  wedding: "Bröllop",
  other: "Övrigt",
};

export const LIVE_EVENT_KIND_ICON: Record<LiveEventKind, string> = {
  concert: "🎵",
  sport: "⚽",
  race: "🏃",
  birthday: "🎂",
  wedding: "💒",
  other: "🎉",
};

export const LIVE_RATING_MIN = 1;
export const LIVE_RATING_MAX = 10;

export interface LiveEvent {
  id: string;
  year: number;
  kind: LiveEventKind;
  title: string;
  eventDate: string;
  location: string | null;
  note: string | null;
  rating: number | null;
  attendedAt: string | null;
  sortOrder: number;
}

export interface DailyLiveEventsContext {
  localDate: string;
  year: number;
  /** Due today or overdue, not yet attended. */
  dueEvents: LiveEvent[];
}

export interface YearLiveEventsContext {
  year: number;
  events: LiveEvent[];
}

export interface MonthLiveEventsContext {
  monthStart: string;
  events: LiveEvent[];
}

export function yearFromLocalISO(localDate: string): number {
  return Number(localDate.slice(0, 4));
}

export function liveRatingLabel(rating: number | null): string | null {
  if (rating == null) return null;
  return `${rating}/10`;
}

export function isLiveEventAttended(event: LiveEvent): boolean {
  return event.attendedAt != null;
}

export function isLiveEventDue(event: LiveEvent, localDate: string): boolean {
  if (event.attendedAt) return false;
  return event.eventDate <= localDate;
}

export function liveEventDetail(event: LiveEvent): string {
  const parts = [LIVE_EVENT_KIND_LABEL[event.kind], event.eventDate.slice(5)];
  if (event.location) parts.push(event.location);
  if (liveRatingLabel(event.rating)) parts.push(liveRatingLabel(event.rating)!);
  return parts.join(" · ");
}

export function liveStatusFor(attendedToday: boolean, isFuture: boolean): HabitStatus | null {
  if (isFuture) return null;
  return attendedToday ? "yes" : "no";
}

export function liveYearGroups(events: LiveEvent[]): {
  attended: LiveEvent[];
  planned: LiveEvent[];
} {
  const attended: LiveEvent[] = [];
  const planned: LiveEvent[] = [];
  for (const event of events) {
    if (event.attendedAt) attended.push(event);
    else planned.push(event);
  }
  return { attended, planned };
}
