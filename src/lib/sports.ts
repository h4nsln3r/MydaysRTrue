export interface UserSport {
  id: string;
  key: string | null;
  title: string;
  icon: string;
  sortOrder: number;
}

export const DEFAULT_USER_SPORTS = [
  { key: "discgolf", title: "Discgolf", icon: "🥏", sortOrder: 0 },
  { key: "badminton", title: "Badminton", icon: "🏸", sortOrder: 1 },
  { key: "pingis", title: "Pingis", icon: "🏓", sortOrder: 2 },
] as const;

export function formatSportLabel(sport: {
  title: string;
  icon?: string | null;
}): string {
  const icon = sport.icon?.trim();
  const name = sport.title.trim();
  return icon ? `${icon} ${name}` : name;
}

export function matchSportId(
  sports: UserSport[],
  placement: {
    sportId?: string | null;
    planSport?: string | null;
    actualSport?: string | null;
  },
): string | null {
  if (placement.sportId && sports.some((s) => s.id === placement.sportId)) {
    return placement.sportId;
  }
  const name = (
    placement.actualSport ??
    placement.planSport ??
    ""
  )
    .trim()
    .toLowerCase();
  if (!name) return null;
  return sports.find((s) => s.title.trim().toLowerCase() === name)?.id ?? null;
}
