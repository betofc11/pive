// The user's location as the AI sees it (diseno §4.8). Pure (no SDK imports), so the root Jest can test it.
import { placeLabel, timeAgoLabel, type UserLocation } from "../../shared/location";

/** "UBICACIÓN: Guadalajara, México (automática, hace 2 h)", or empty if it's off or unknown */
export function formatLocationContext(location: UserLocation | null | undefined, now: number): string {
  const place = placeLabel(location);
  if (!place || !location) return "";
  const how = location.mode === "auto" ? "automática" : "elegida por el usuario";
  const age = typeof location.updatedAt === "number" ? `, ${timeAgoLabel(location.updatedAt, now)}` : "";
  return `UBICACIÓN: ${place} (${how}${age})`;
}
