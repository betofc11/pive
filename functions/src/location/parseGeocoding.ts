// The place in a reverse geocoding answer from the Google Geocoding API. Pure (no SDK imports), so the root Jest
// can test it.
import type { ResolvedPlace } from "../shared/location";

interface AddressComponent {
  long_name?: unknown;
  short_name?: unknown;
  types?: unknown;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** The first component of a type, across every result (the first results are the most precise) */
function findComponent(results: Array<{ address_components?: unknown }>, types: string[]): AddressComponent | undefined {
  for (const type of types) {
    for (const result of results) {
      const components = Array.isArray(result?.address_components) ? (result.address_components as AddressComponent[]) : [];
      const found = components.find((c) => Array.isArray(c?.types) && (c.types as unknown[]).includes(type));
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * City (`locality`, or the closest thing), region (`administrative_area_level_1`) and country, in the language of
 * the request. Null without results or without a country.
 */
export function parseGeocoding(response: unknown): ResolvedPlace | null {
  const data = (response && typeof response === "object" ? response : {}) as { status?: unknown; results?: unknown };
  if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) return null;
  const results = data.results as Array<{ address_components?: unknown }>;

  const country = findComponent(results, ["country"]);
  const countryName = text(country?.long_name);
  if (!countryName) return null;

  const place: ResolvedPlace = { country: countryName };
  const countryCode = text(country?.short_name);
  if (countryCode && /^[A-Z]{2}$/.test(countryCode)) place.countryCode = countryCode;
  const region = text(findComponent(results, ["administrative_area_level_1"])?.long_name);
  if (region) place.region = region;
  // Some countries have no `locality` for an area: the canton or district is the closest thing to a city
  const city = text(findComponent(results, ["locality", "postal_town", "administrative_area_level_2", "sublocality"])?.long_name);
  if (city) place.city = city;
  return place;
}
