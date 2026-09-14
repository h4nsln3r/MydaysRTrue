// Client-safe user game catalog helpers.

export const GAME_KINDS = [
  "rpg",
  "board",
  "pc",
  "card",
  "console",
  "other",
] as const;

export type GameKind = (typeof GAME_KINDS)[number];

export const GAME_KIND_LABEL: Record<GameKind, string> = {
  rpg: "Rollspel",
  board: "Brädspel",
  pc: "PC-spel",
  card: "Kortspel",
  console: "Konsol",
  other: "Övrigt",
};

export const GAME_KIND_ICON: Record<GameKind, string> = {
  rpg: "🐉",
  board: "♟️",
  pc: "🖥️",
  card: "🃏",
  console: "🎮",
  other: "🎲",
};

export interface UserGame {
  id: string;
  key: string | null;
  title: string;
  kind: GameKind;
  icon: string;
  sortOrder: number;
}

export function isGameKind(value: string | null | undefined): value is GameKind {
  return value != null && (GAME_KINDS as readonly string[]).includes(value);
}

export function parseGameKind(value: string | null | undefined): GameKind | null {
  return isGameKind(value) ? value : null;
}

export function formatGameLabel(game: {
  title: string;
  kind?: GameKind | null;
  icon?: string | null;
}): string {
  const icon = game.icon?.trim() || (game.kind ? GAME_KIND_ICON[game.kind] : "");
  const kind = game.kind ? GAME_KIND_LABEL[game.kind] : null;
  const name = game.title.trim();
  if (icon && kind) return `${icon} ${name} · ${kind}`;
  if (icon) return `${icon} ${name}`;
  if (kind) return `${name} · ${kind}`;
  return name;
}
