// Client-safe coding project helpers. Server queries live in `./coding.server`.

export const CODING_PROJECT_STATUSES = ["active", "v1_done", "done"] as const;

export type CodingProjectStatus = (typeof CODING_PROJECT_STATUSES)[number];

export const CODING_PROJECT_STATUS_LABEL: Record<CodingProjectStatus, string> = {
  active: "Pågår",
  v1_done: "Första version klar",
  done: "Klart",
};

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
