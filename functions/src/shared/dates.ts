// Calendar dates as 'YYYY-MM-DD' keys (the id of daily logs and usage documents).
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Milliseconds at 00:00 UTC of a valid 'YYYY-MM-DD' key, or null (wrong format or a day that doesn't exist). */
export function dateKeyToUtcMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = DATE_KEY_RE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  // Date.UTC rolls 2026-02-30 over to March 2nd: a real date maps back to the same key
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

export function isDateKey(value: unknown): value is string {
  return dateKeyToUtcMs(value) !== null;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Day of the week in Spanish ("viernes") of a 'YYYY-MM-DD' key, or null if the key is not valid. */
export function weekdayLabel(dateKey: string): string | null {
  const ms = dateKeyToUtcMs(dateKey);
  return ms === null ? null : WEEKDAYS[new Date(ms).getUTCDay()];
}
