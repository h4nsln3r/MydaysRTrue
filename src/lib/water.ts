// Client-safe water constants and types.
// Server-only helpers live in `./water.server`.

export interface WaterLog {
  id: string;
  amount_ml: number;
  logged_at: string;
  note: string | null;
}

export interface WaterSummary {
  date: string;
  goalMl: number;
  totalMl: number;
  progress: number;
  goalMet: boolean;
  logs: WaterLog[];
}

/** Quick-add presets in millilitres. */
export const QUICK_ADDS = [
  { ml: 200, label: "Glass", icon: "🥛" },
  { ml: 330, label: "Can", icon: "🥤" },
  { ml: 500, label: "Bottle", icon: "🍶" },
  { ml: 750, label: "Big", icon: "💧" },
] as const;

export function formatMl(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2)} L`;
  return `${ml} ml`;
}
