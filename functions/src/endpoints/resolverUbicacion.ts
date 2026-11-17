import { authedEndpoint } from "../http";
import { recordUsage } from "../usage";
import { parseGeocoding } from "../location/parseGeocoding";
import { geocodingUrl, parseLatLng } from "../location/request";

// Rounded coordinates → city, region and country (Google Geocoding API). Request: { lat, lng }.
// Response: ResolvedPlace, or 404 if there's no place there. NEVER log the coordinates or the request URL.
export const resolverUbicacion = authedEndpoint("resolverUbicacion", "Error resolving the location", ["GEOCODING_API_KEY"], async ({ req, res, uid }) => {
  const coords = parseLatLng(req.body);
  if (!coords) {
    res.status(400).json({ error: "lat (-90..90) and lng (-180..180) are required" });
    return;
  }
  const apiKey = process.env.GEOCODING_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Geocoding API Key is not configured." });
    return;
  }

  let data: unknown;
  try {
    const response = await fetch(geocodingUrl(coords, apiKey));
    data = await response.json();
  } catch {
    // The error could carry the URL: only say that it failed
    throw new Error("Geocoding request failed");
  }
  await recordUsage(uid, "location", undefined, undefined, req.body?.localDate);

  const status = (data as { status?: unknown })?.status;
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    console.error(`resolverUbicacion: Geocoding answered ${String(status)}`);
    res.status(502).json({ error: "The geocoding service failed" });
    return;
  }
  const place = parseGeocoding(data);
  if (!place) {
    res.status(404).json({ error: "No place found" });
    return;
  }
  res.status(200).json(place);
});
