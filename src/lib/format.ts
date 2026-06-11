/** Fixed locale so server and browser render the same numbers (avoids hydration mismatch). */
export const APP_LOCALE = "sv-SE";

export function formatInteger(n: number): string {
  return n.toLocaleString(APP_LOCALE);
}

export function formatWeightKg(kg: number): string {
  return `${kg.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`;
}
