export const RING_TASK_KEY = "life_ring";

export const RING_WEEKLY_GOAL = 3;
export const RING_MAMMA_GOAL = 2;
export const RING_OTHER_GOAL = 1;

export const RING_PERSONS = [
  { key: "mamma", label: "Mamma", icon: "👩", group: "mamma" },
  { key: "sanna", label: "Sanna", icon: "💛", group: "other" },
  { key: "farmor", label: "Farmor", icon: "👵", group: "other" },
  { key: "ovrigt", label: "Övrigt", icon: "🤝", group: "other" },
] as const;

export type RingPerson = (typeof RING_PERSONS)[number]["key"];

const PERSON_BY_KEY = new Map(RING_PERSONS.map((p) => [p.key, p]));

export function isRingPerson(
  value: string | null | undefined,
): value is RingPerson {
  return value === "mamma" || value === "sanna" || value === "farmor" || value === "ovrigt";
}

export function parseRingPerson(
  value: string | null | undefined,
): RingPerson | null {
  return isRingPerson(value) ? value : null;
}

export function isRingWeeklyTaskKey(key: string | null | undefined): boolean {
  return (
    key === RING_TASK_KEY ||
    key === "life_ring_mamma" ||
    key === "life_ring_mormor_farmor" ||
    key === "life_ring_van" ||
    (key?.startsWith("life_ring_") ?? false)
  );
}

export function ringPersonFromLegacyKey(
  key: string | null | undefined,
): RingPerson | null {
  if (!key) return null;
  if (key === "life_ring_mamma" || key.startsWith("life_ring_mamma_")) {
    return "mamma";
  }
  if (key === "life_ring_mormor_farmor") return "farmor";
  if (key === "life_ring_van") return "ovrigt";
  return null;
}

export function ringPersonMeta(person: RingPerson | null | undefined) {
  if (!person) return null;
  return PERSON_BY_KEY.get(person) ?? null;
}

export function ringPersonLabel(person: RingPerson): string {
  return PERSON_BY_KEY.get(person)?.label ?? person;
}

export function ringPersonIcon(person: RingPerson): string {
  return PERSON_BY_KEY.get(person)?.icon ?? "📞";
}

export function isRingOtherPerson(person: RingPerson | null | undefined): boolean {
  return person === "sanna" || person === "farmor" || person === "ovrigt";
}

export function ringCallTitle(placement: {
  callPerson?: RingPerson | null;
  callOtherName?: string | null;
}): string | null {
  const person = parseRingPerson(placement.callPerson);
  if (!person) return null;
  const other = placement.callOtherName?.trim();
  if (person === "ovrigt" && other) return other;
  return ringPersonLabel(person);
}
