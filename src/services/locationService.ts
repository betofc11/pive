// Native (iOS and Android): expo-location, low accuracy and "while using the app" only.
// The web version is locationService.web.ts.
import * as Location from 'expo-location';
import { type Coords, roundCoords } from '../lib/location';

export { roundCoords };
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return 'granted';
    if (status === Location.PermissionStatus.DENIED) return 'denied';
    return 'prompt';
  } catch {
    return 'unknown';
  }
}

async function currentCoords(): Promise<Coords | null> {
  try {
    // A recent fix is enough for a city, and much faster
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 });
    const position = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (err) {
    console.warn('[Location] Could not get the position:', err);
    return null;
  }
}

/** May show the system permission: call it only after the user taps something */
export async function requestCoarsePosition(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;
  } catch {
    return null;
  }
  return currentCoords();
}

/** Never asks for the permission */
export async function getCoarsePositionIfGranted(): Promise<Coords | null> {
  return (await getPermissionState()) === 'granted' ? currentCoords() : null;
}
