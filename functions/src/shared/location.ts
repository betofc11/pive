// The user's location: only city, region and country, never coordinates (diseno §5). Saved in users/{uid}.location.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.

export interface UserLocation {
  /** auto: from the device (rounded coordinates → city on the server). manual: chosen in the profile. off: not used */
  mode: 'auto' | 'manual' | 'off';
  city?: string;
  region?: string;
  country?: string;
  /** ISO 3166-1 alpha-2 */
  countryCode?: string;
  source?: 'gps' | 'manual';
  updatedAt?: number;
  /** When the user answered the location notice ("Ahora no" postpones it 30 days) */
  askedAt?: number;
}

/** What resolverUbicacion answers */
export interface ResolvedPlace {
  city?: string;
  region?: string;
  country: string;
  countryCode?: string;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/** "Guadalajara, México", "Jalisco, México" or "México"; null if there's no usable place or the mode is off */
export function placeLabel(location: UserLocation | null | undefined): string | null {
  if (!location || location.mode === 'off') return null;
  const country = text(location.country);
  if (!country) return null;
  const local = text(location.city) ?? text(location.region);
  return local ? `${local}, ${country}` : country;
}

/** "hace 5 min", "hace 2 h", "hace 3 días"; "hace un momento" under a minute */
export function timeAgoLabel(ms: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - ms) / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
