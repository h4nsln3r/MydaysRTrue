// Client-safe journal types and helpers.

import { formatTime } from "@/lib/date";

export type JournalEntrySource =
  | "manual"
  | "gym"
  | "cardio"
  | "sport"
  | "bathing"
  | "mood"
  | "task"
  | "weight"
  | "work_start"
  | "work_end"
  | "meal"
  | "snack"
  | "intake"
  | "water"
  | "habit"
  | "activity"
  | "media"
  | "mobile_game";

export const JOURNAL_SOURCE_LABEL: Record<JournalEntrySource, string> = {
  manual: "Anteckning",
  gym: "Gym",
  cardio: "Cardio",
  sport: "Sport",
  bathing: "Bad & bastu",
  mood: "Dagskänsla",
  task: "Uppgift",
  weight: "Vikt",
  work_start: "Jobb start",
  work_end: "Jobb slut",
  meal: "Måltid",
  snack: "Mellanmål",
  intake: "Intake",
  water: "Vatten",
  habit: "Vana",
  activity: "Aktivitet",
  media: "Media",
  mobile_game: "Mobilspel",
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
  narrative: string;
}

export interface WeekJournalDay {
  localDate: string;
  entries: JournalDisplayEntry[];
  narrative: string;
  /** Short preview for week grid. */
  preview: string | null;
  entryCount: number;
}

export interface WeekJournalSummary {
  weekStart: string;
  days: WeekJournalDay[];
}

function lowercaseFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/[.!?…]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function timeOfDayIntro(at: string): string {
  const h = new Date(at).getHours();
  if (h < 10) return "På morgonen";
  if (h < 14) return "På förmiddagen";
  if (h < 18) return "På eftermiddagen";
  return "På kvällen";
}

function phraseGym(entry: JournalDisplayEntry): string {
  const intro = timeOfDayIntro(entry.at);
  const note = entry.body.trim();
  if (note && !note.startsWith("Uppvärmning:")) {
    return ensureSentence(`${intro} tränade jag ${lowercaseFirst(note)}`);
  }
  return ensureSentence(`${intro} tränade jag ${lowercaseFirst(entry.title)}`);
}

function phraseWorkStart(entry: JournalDisplayEntry): string {
  const note = entry.body.trim();
  if (note) {
    return ensureSentence(`Kl. ${formatTime(entry.at)} började jobbet — ${lowercaseFirst(note)}`);
  }
  return ensureSentence(`Kl. ${formatTime(entry.at)} började jobbet`);
}

function phraseWorkEnd(entry: JournalDisplayEntry): string {
  const note = entry.body.trim();
  if (note) {
    return ensureSentence(note.charAt(0).toUpperCase() + note.slice(1));
  }
  return ensureSentence(`Jobbet slutade kl. ${formatTime(entry.at)}`);
}

function mergeWorkPhrases(start: JournalDisplayEntry, end: JournalDisplayEntry): string {
  const startNote = start.body.trim();
  const endNote = end.body.trim();

  if (startNote && endNote) {
    const place = lowercaseFirst(startNote);
    const detail = lowercaseFirst(endNote);
    if (detail.startsWith("det ") || detail.startsWith("det var ")) {
      return ensureSentence(`Jobbade ${place}, ${detail}`);
    }
    return ensureSentence(`Jobbade ${place}. ${endNote.charAt(0).toUpperCase() + endNote.slice(1)}`);
  }
  if (startNote) return ensureSentence(`Jobbade ${lowercaseFirst(startNote)}`);
  if (endNote) return phraseWorkEnd(end);
  return ensureSentence("Jobbade");
}

function phraseEntry(entry: JournalDisplayEntry): string {
  switch (entry.source) {
    case "gym":
      return phraseGym(entry);
    case "work_start":
      return phraseWorkStart(entry);
    case "work_end":
      return phraseWorkEnd(entry);
    case "manual":
      return ensureSentence(entry.body);
    case "cardio": {
      const note = entry.body.trim();
      const intro = timeOfDayIntro(entry.at);
      if (note && note !== "Pass klart.") {
        return ensureSentence(`${intro} ${lowercaseFirst(note)}`);
      }
      return ensureSentence(`${intro} cardio — ${lowercaseFirst(entry.title)}`);
    }
    case "sport": {
      const note = entry.body.trim();
      const intro = timeOfDayIntro(entry.at);
      if (note && note !== "Pass klart.") {
        return ensureSentence(`${intro} ${lowercaseFirst(note)}`);
      }
      return ensureSentence(`${intro} sport — ${lowercaseFirst(entry.title)}`);
    }
    case "task": {
      const note = entry.body.trim();
      if (note && note !== "Klar.") {
        return ensureSentence(note);
      }
      return ensureSentence(`${entry.title} — klart`);
    }
    case "mood":
      return ensureSentence(`Kände mig ${lowercaseFirst(entry.body)}`);
    case "bathing": {
      const note = entry.body.trim();
      if (note && note !== "Klart.") {
        return ensureSentence(`${entry.title}: ${lowercaseFirst(note)}`);
      }
      return ensureSentence(entry.title);
    }
    case "weight":
      return ensureSentence(`Vägde ${entry.body}`);
    case "meal": {
      const note = entry.body.trim();
      const title = entry.title.toLowerCase();
      if (title === "frukost") {
        return ensureSentence(`Till frukost åt jag ${lowercaseFirst(note)}`);
      }
      if (title === "lunch") {
        return ensureSentence(`Till lunch åt jag ${lowercaseFirst(note)}`);
      }
      if (title === "middag") {
        return ensureSentence(`Till middag åt jag ${lowercaseFirst(note)}`);
      }
      return ensureSentence(`${entry.title}: ${note}`);
    }
    case "snack":
      return ensureSentence(`Mellanmål: ${lowercaseFirst(entry.body)}`);
    case "intake": {
      const note = entry.body.trim();
      if (entry.title === "Frukt") {
        return ensureSentence(`Åt ${lowercaseFirst(note)}`);
      }
      if (entry.title === "Kreatin") {
        return ensureSentence("Tog kreatin");
      }
      if (entry.title === "Shake") {
        return ensureSentence("Tog shake");
      }
      return note
        ? ensureSentence(`Tog ${entry.title.toLowerCase()}: ${lowercaseFirst(note)}`)
        : ensureSentence(`Tog ${entry.title.toLowerCase()}`);
    }
    case "water":
      return ensureSentence(entry.body);
    case "habit": {
      const note = entry.body.trim();
      if (note) return ensureSentence(note);
      return ensureSentence(entry.title);
    }
    case "activity":
      return ensureSentence(entry.body);
    case "media":
      return ensureSentence(entry.body);
    case "mobile_game":
      return ensureSentence(`Spelade ${lowercaseFirst(entry.body)}`);
    default:
      return ensureSentence(entry.body || entry.title);
  }
}

export function buildJournalNarrative(entries: JournalDisplayEntry[]): string {
  if (entries.length === 0) return "";

  const sorted = [...entries].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  const sentences: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.source === "work_start" && next?.source === "work_end") {
      sentences.push(mergeWorkPhrases(current, next));
      i += 2;
      continue;
    }

    sentences.push(phraseEntry(current));
    i += 1;
  }

  let text = sentences.join(" ");
  text = text.replace(/\.\s+Sen var det jobb/g, ", sen var det jobb");
  return text;
}

export function truncateJournalPreview(text: string, maxLen = 80): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export function buildJournalPreview(
  entries: JournalDisplayEntry[],
  narrative?: string,
): string | null {
  const flow = narrative ?? buildJournalNarrative(entries);
  if (flow) return truncateJournalPreview(flow, 120);
  if (entries.length === 0) return null;
  return truncateJournalPreview(entries[0].body || entries[0].title, 80);
}
