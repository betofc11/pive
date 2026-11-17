// Web and the iPhone PWA: navigator.geolocation without high accuracy.
// On iOS as a PWA the Permissions API can say 'prompt' even when the permission was granted, and the permission
// can be asked again: that's why the refresh is tied to a tap (opening the chat), not to this state.
import { type Coords, roundCoords } from '../lib/location';

export { roundCoords };
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'unknown';
  }
}

function currentCoords(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => {
        console.warn('[Location] Could not get the position:', error.message);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 3600000, timeout: 10000 },
    );
  });
}

/** May show the browser's permission prompt: call it only after the user taps something */
export const requestCoarsePosition = (): Promise<Coords | null> => currentCoords();

/** Never asks for the permission */
export async function getCoarsePositionIfGranted(): Promise<Coords | null> {
  return (await getPermissionState()) === 'granted' ? currentCoords() : null;
}
