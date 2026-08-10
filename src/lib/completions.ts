// Client-safe completion markers for year calendar + week list.
// Domains: media (bok/film/serie), spelningar, kodningsversioner.

import {
  codingProjectVersionLabel,
  type CodingProject,
} from "@/lib/coding";
import type { Gig } from "@/lib/gigs";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  type MediaItem,
} from "@/lib/media";

export type CompletionDomain = "media" | "gig" | "coding";

export const COMPLETION_DOMAIN_LABEL: Record<CompletionDomain, string> = {
  media: "Läsa & titta",
  gig: "Spelning",
  coding: "Kodning",
};

export interface DayCompletion {
  /** Stable list key, e.g. media:<uuid>. */
  id: string;
  /** DB row id for updates. */
  entityId: string;
  domain: CompletionDomain;
  date: string;
  title: string;
  subtitle: string;
  note: string | null;
}

/** Date shown in calendars: explicit completed_on, else last activity. */
export function mediaCompletionDate(item: MediaItem): string | null {
  if (!item.completed) return null;
  return item.completedOn ?? item.lastActivityDate;
}

export function buildMediaCompletions(items: MediaItem[]): DayCompletion[] {
  const out: DayCompletion[] = [];
  for (const item of items) {
    const date = mediaCompletionDate(item);
    if (!date) continue;
    out.push({
      id: `media:${item.id}`,
      entityId: item.id,
      domain: "media",
      date,
      title: item.title,
      subtitle: `${MEDIA_KIND_ICON[item.kind]} ${MEDIA_KIND_LABEL[item.kind]}`,
      note: item.note,
    });
  }
  return out;
}

export function buildGigCompletions(gigs: Gig[]): DayCompletion[] {
  const out: DayCompletion[] = [];
  for (const gig of gigs) {
    if (!gig.playedAt) continue;
    out.push({
      id: `gig:${gig.id}`,
      entityId: gig.id,
      domain: "gig",
      date: gig.eventDate,
      title: gig.title,
      subtitle: `🎸 Spelning · ${gig.band}`,
      note: gig.note,
    });
  }
  return out;
}

export function buildCodingCompletions(
  projects: CodingProject[],
): DayCompletion[] {
  const out: DayCompletion[] = [];
  for (const project of projects) {
    for (const version of project.versions) {
      out.push({
        id: `coding:${version.id}`,
        entityId: version.id,
        domain: "coding",
        date: version.completedOn,
        title: project.title,
        subtitle: `💻 ${codingProjectVersionLabel(version.versionNumber)}`,
        note: version.note,
      });
    }
  }
  return out;
}

export function buildYearCompletions(input: {
  media: MediaItem[];
  gigs: Gig[];
  projects: CodingProject[];
}): DayCompletion[] {
  return [
    ...buildMediaCompletions(input.media),
    ...buildGigCompletions(input.gigs),
    ...buildCodingCompletions(input.projects),
  ].sort((a, b) =>
    a.date === b.date
      ? a.title.localeCompare(b.title, "sv")
      : a.date.localeCompare(b.date),
  );
}

export function completionsByDate(
  items: DayCompletion[],
): Map<string, DayCompletion[]> {
  const map = new Map<string, DayCompletion[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return map;
}

export function completionsInDateRange(
  items: DayCompletion[],
  start: string,
  end: string,
): DayCompletion[] {
  return items.filter((item) => item.date >= start && item.date <= end);
}

export function filterCompletionsForYear(
  items: DayCompletion[],
  year: number,
): DayCompletion[] {
  const prefix = `${year}-`;
  return items.filter((item) => item.date.startsWith(prefix));
}

/** Manual journal line when a completion comment is written. */
export function completionJournalBody(item: {
  title: string;
  subtitle: string;
  note: string;
}): string {
  const note = item.note.trim();
  return `${item.title} (${item.subtitle}): ${note}`;
}
