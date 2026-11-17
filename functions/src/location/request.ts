// Validating the coordinates resolverUbicacion receives. Pure (no SDK imports), so the root Jest can test it.

const round2 = (n: number) => Math.round(n * 100) / 100 + 0;

/** { lat, lng } in range, rounded again to 2 decimals (~1 km) whatever the client sent; null otherwise */
export function parseLatLng(body: unknown): { lat: number; lng: number } | null {
  const { lat, lng } = (body && typeof body === "object" ? body : {}) as { lat?: unknown; lng?: unknown };
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: round2(lat), lng: round2(lng) };
}

/** The Geocoding request. Holds the coordinates and the key: never log it */
export const geocodingUrl = (coords: { lat: number; lng: number }, apiKey: string) =>
  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&language=es&key=${encodeURIComponent(apiKey)}`;
