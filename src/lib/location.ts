// Pure decisions about the user's location (diseno §5), shared by both platform services and the UI.
import type { UserLocation } from '../types';

export type Coords = { lat: number; lng: number };

/** Automatic location is refreshed when it's older than this */
export const AUTO_REFRESH_MS = 6 * 60 * 60 * 1000;
/** "Ahora no" postpones the notice this long */
export const NOTICE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/** 2 decimals by default (~1 km): what leaves the device. Never more precise than that */
export function roundCoords(p: Coords, decimals = 2): Coords {
  const factor = 10 ** Math.min(Math.max(0, Math.floor(decimals)), 2);
  const round = (n: number) => Math.round(n * factor) / factor + 0;
  return { lat: round(p.lat), lng: round(p.lng) };
}

export const sameCoords = (a: Coords | null | undefined, b: Coords | null | undefined) =>
  Boolean(a && b && a.lat === b.lat && a.lng === b.lng);

/** The notice on the dashboard: no known country, not off, and not answered in the last 30 days */
export function shouldShowLocationNotice(location: UserLocation | null | undefined, now: number): boolean {
  if (location?.mode === 'off') return false;
  if (location?.country) return false;
  return !location?.askedAt || now - location.askedAt > NOTICE_SNOOZE_MS;
}

/** Automatic mode with a place older than 6 h (or none yet) */
export function isAutoLocationStale(location: UserLocation | null | undefined, now: number): boolean {
  if (location?.mode !== 'auto') return false;
  return !location.updatedAt || now - location.updatedAt > AUTO_REFRESH_MS;
}
