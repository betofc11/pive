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

// ---------------------------------------------------------------------------------------------------------------
// Local clock times as 'HH:mm' (24 h): meal times, slot windows and the user's "now".

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value: unknown): value is string {
  return typeof value === 'string' && CLOCK_RE.test(value);
}

/** Minutes since midnight of a valid 'HH:mm', or null. */
export function clockToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = CLOCK_RE.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 'HH:mm' of a number of minutes, wrapped to the same day (1450 → '00:10', -10 → '23:50'). */
export function minutesToClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

const MIN_UTC_OFFSET = -12 * 60;
const MAX_UTC_OFFSET = 14 * 60;

/**
 * The user's UTC offset in minutes (Costa Rica → -360), deduced from the local date and time their device sent
 * and the server's clock. Rounded to 15 minutes, which every real time zone is a multiple of, so a request that
 * takes a few minutes to arrive still gives the right offset. Null if the values are not valid or the offset
 * doesn't exist (the device clock is off by more than a day).
 */
export function utcOffsetFromLocalClock(localDate: unknown, localTime: unknown, nowMs: number): number | null {
  const dayMs = dateKeyToUtcMs(localDate);
  const minutes = clockToMinutes(localTime);
  if (dayMs === null || minutes === null) return null;
  const localAsUtcMs = dayMs + minutes * 60_000;
  const offset = Math.round((localAsUtcMs - nowMs) / (15 * 60_000)) * 15;
  return offset >= MIN_UTC_OFFSET && offset <= MAX_UTC_OFFSET ? offset + 0 : null;
}

/** Local 'HH:mm' of an ISO timestamp (as stored in Meal.time) for a UTC offset in minutes, or null. */
export function isoToLocalClock(iso: unknown, offsetMinutes: number): string | null {
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const date = new Date(ms + offsetMinutes * 60_000);
  return minutesToClock(date.getUTCHours() * 60 + date.getUTCMinutes());
}
