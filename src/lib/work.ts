// Client-safe work / jobb types and helpers.

import { isoWeekdayFromLocalISO } from "@/lib/date";

export type WorkKind = "home" | "office" | "off" | "sick";

export const WORK_KINDS: WorkKind[] = ["home", "office", "off", "sick"];

export const WORK_KIND_LABEL: Record<WorkKind, string> = {
  home: "Hemma",
  office: "Kontor",
  off: "Ledig",
  sick: "Sjuk",
};

export const WORK_KIND_FULL_LABEL: Record<WorkKind, string> = {
  home: "Jobbar hemma",
  office: "Jobbar på kontoret",
  off: "Är ledig",
  sick: "Är sjuk",
};

export const WORK_KIND_ICON: Record<WorkKind, string> = {
  home: "🏠",
  office: "🏢",
  off: "🏖",
  sick: "🤒",
};

export interface WorkDailyLog {
  localDate: string;
  startedAt: string | null;
  startNote: string | null;
  endedAt: string | null;
  endNote: string | null;
  kind: WorkKind | null;
}

export function isWorkKind(value: string | null | undefined): value is WorkKind {
  return (
    value === "home" ||
    value === "office" ||
    value === "off" ||
    value === "sick"
  );
}

export function isWorkday(localDate: string): boolean {
  const weekday = isoWeekdayFromLocalISO(localDate);
  return weekday >= 1 && weekday <= 5;
}

/** Weekday and not marked as leave (semester/ledig). */
export function shouldShowWork(
  localDate: string,
  onLeave = false,
): boolean {
  return isWorkday(localDate) && !onLeave;
}

/** Ledig/sjuk complete the day at start — no Jobb slut. */
export function workNeedsEnd(work: Pick<WorkDailyLog, "kind">): boolean {
  return work.kind !== "off" && work.kind !== "sick";
}

export function emptyWorkLog(localDate: string): WorkDailyLog {
  return {
    localDate,
    startedAt: null,
    startNote: null,
    endedAt: null,
    endNote: null,
    kind: null,
  };
}

export type WorkKindCounts = Record<WorkKind, number>;

export function emptyWorkKindCounts(): WorkKindCounts {
  return { home: 0, office: 0, off: 0, sick: 0 };
}

export function summarizeWorkLogs(logs: Iterable<WorkDailyLog>): WorkKindCounts {
  const counts = emptyWorkKindCounts();
  for (const log of logs) {
    if (log.kind && log.startedAt) counts[log.kind] += 1;
  }
  return counts;
}

export function workKindCountTotal(counts: WorkKindCounts): number {
  return counts.home + counts.office + counts.off + counts.sick;
}
