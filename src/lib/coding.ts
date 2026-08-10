// Client-safe coding project helpers. Server queries live in `./coding.server`.

export const CODING_PROJECT_STATUSES = ["active", "done"] as const;

export type CodingProjectStatus = (typeof CODING_PROJECT_STATUSES)[number];

export const CODING_PROJECT_STATUS_LABEL: Record<CodingProjectStatus, string> = {
  active: "Pågår",
  done: "Klart",
};

export interface CodingProjectVersion {
  id: string;
  versionNumber: number;
  /** Local calendar date YYYY-MM-DD when this version shipped. */
  completedOn: string;
  /** Optional comment when the version shipped. */
  note: string | null;
}

export interface CodingProject {
  id: string;
  title: string;
  /** Optional longer blurb — edited on the year view. */
  description: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  /** Whether the live site is currently up. */
  isLive: boolean;
  status: CodingProjectStatus;
  versions: CodingProjectVersion[];
  sortOrder: number;
}

export function isCodingProjectStatus(
  value: string | null | undefined,
): value is CodingProjectStatus {
  return (
    value != null &&
    (CODING_PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

export function codingProjectVersionLabel(versionNumber: number): string {
  if (versionNumber === 1) return "Första versionen";
  if (versionNumber === 2) return "Andra versionen";
  if (versionNumber === 3) return "Tredje versionen";
  return `Version ${versionNumber}`;
}

export function formatCodingProjectDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Soft URL normalize — empty → null, adds https:// if missing scheme. */
export function normalizeOptionalUrl(raw: string | null | undefined): {
  ok: true;
  url: string | null;
} | {
  ok: false;
  error: string;
} {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, url: null };

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "URL måste börja med http:// eller https://." };
    }
    if (!parsed.hostname.includes(".")) {
      return { ok: false, error: "Ogiltig URL." };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: "Ogiltig URL." };
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCodingProjectDate(raw: string | null | undefined): {
  ok: true;
  date: string;
} | {
  ok: false;
  error: string;
} {
  const trimmed = (raw ?? "").trim();
  if (!ISO_DATE_RE.test(trimmed)) {
    return { ok: false, error: "Ange ett giltigt datum." };
  }
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return { ok: false, error: "Ange ett giltigt datum." };
  }
  if (y < 1970 || y > 2100) {
    return { ok: false, error: "Datumet känns orimligt." };
  }
  return { ok: true, date: trimmed };
}
