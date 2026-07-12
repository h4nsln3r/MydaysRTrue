// Client-safe gig types and helpers.

import { MUSIC_BANDS, type MusicBand } from "@/lib/tasks";

export type { MusicBand };
export { MUSIC_BANDS };

export const GIG_RATING_MIN = 1;
export const GIG_RATING_MAX = 10;

export interface Gig {
  id: string;
  year: number;
  band: MusicBand;
  title: string;
  eventDate: string;
  venue: string | null;
  note: string | null;
  rating: number | null;
  playedAt: string | null;
  sortOrder: number;
}

export interface YearGigsContext {
  year: number;
  gigs: Gig[];
}

export interface MonthGigsContext {
  monthStart: string;
  gigs: Gig[];
}

export function yearFromLocalISO(localDate: string): number {
  return Number(localDate.slice(0, 4));
}

export function gigRatingLabel(rating: number | null): string | null {
  if (rating == null) return null;
  return `${rating}/10`;
}

export function isGigPlayed(gig: Gig): boolean {
  return gig.playedAt != null;
}

export function gigDetail(gig: Gig): string {
  const parts = [gig.band, gig.eventDate.slice(5)];
  if (gig.venue) parts.push(gig.venue);
  if (gigRatingLabel(gig.rating)) parts.push(gigRatingLabel(gig.rating)!);
  return parts.join(" · ");
}

export function gigYearGroups(gigs: Gig[]): {
  played: Gig[];
  planned: Gig[];
} {
  const played: Gig[] = [];
  const planned: Gig[] = [];
  for (const gig of gigs) {
    if (gig.playedAt) played.push(gig);
    else planned.push(gig);
  }
  return { played, planned };
}

export function gigBandCounts(gigs: Gig[]): Record<MusicBand, number> {
  const counts: Record<MusicBand, number> = { Totes: 0, Bojeng: 0 };
  for (const gig of gigs) {
    if (gig.playedAt) counts[gig.band]++;
  }
  return counts;
}
