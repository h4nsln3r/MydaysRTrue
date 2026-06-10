/** Fixed locale so server and browser render the same numbers (avoids hydration mismatch). */
export const APP_LOCALE = "sv-SE";

export function formatInteger(n: number): string {
  return n.toLocaleString(APP_LOCALE);
}
