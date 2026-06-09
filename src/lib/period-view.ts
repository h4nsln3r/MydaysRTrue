export type PeriodView = "progress" | "plan";

export function parsePeriodView(raw: string | undefined): PeriodView {
  return raw === "plan" ? "plan" : "progress";
}

export function withViewParam(href: string, view: PeriodView): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}view=${view}`;
}
