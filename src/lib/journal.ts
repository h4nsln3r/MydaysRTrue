// Client-safe journal types and helpers.

export type JournalEntrySource =
  | "manual"
  | "gym"
  | "cardio"
  | "bathing"
  | "mood"
  | "task"
  | "weight";

export const JOURNAL_SOURCE_LABEL: Record<JournalEntrySource, string> = {
  manual: "Anteckning",
  gym: "Gym",
  cardio: "Cardio",
  bathing: "Bad & bastu",
  mood: "Dagskänsla",
  task: "Uppgift",
  weight: "Vikt",
};

export interface ManualJournalEntry {
  id: string;
  localDate: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalDisplayEntry {
  id: string;
  source: JournalEntrySource;
  icon: string;
  title: string;
  body: string;
  at: string;
  editable: boolean;
}

export interface DailyJournal {
  localDate: string;
  entries: JournalDisplayEntry[];
}

export interface WeekJournalDay {
  localDate: string;
  entries: JournalDisplayEntry[];
  /** Short preview for week grid (first lines combined). */
  preview: string | null;
  entryCount: number;
}

export interface WeekJournalSummary {
  weekStart: string;
  days: WeekJournalDay[];
}

export function truncateJournalPreview(text: string, maxLen = 80): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export function buildJournalPreview(entries: JournalDisplayEntry[]): string | null {
  if (entries.length === 0) return null;
  const parts = entries.slice(0, 3).map((e) => {
    const text = e.body.trim() || e.title;
    return truncateJournalPreview(text, 40);
  });
  return parts.join(" · ");
}
