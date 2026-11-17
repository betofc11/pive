import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserLocation } from '../types';
import type { ResolvedPlace } from '../../functions/src/shared/location';
import { type Coords, roundCoords, sameCoords } from '../lib/location';
import { getCoarsePositionIfGranted, requestCoarsePosition } from './locationService';
import { resolveLocation } from './geminiService';

// The user's location in users/{uid}.location: only city, region and country (diseno §5). Coordinates are rounded
// on the device and only kept in a local cache, so the same spot isn't sent to Geocoding twice.

const userRef = (uid: string) => doc(db, 'users', uid);
const cacheKey = (uid: string) => `pive.location.${uid}`;

interface CachedPlace {
  coords: Coords;
  place: ResolvedPlace;
}

async function readCache(uid: string): Promise<CachedPlace | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as CachedPlace) : null;
  } catch {
    return null;
  }
}

const writeCache = (uid: string, value: CachedPlace) => AsyncStorage.setItem(cacheKey(uid), JSON.stringify(value)).catch(() => {});

/** Optional text fields: set, or deleted if missing */
const placeFields = (place: Partial<ResolvedPlace>) => ({
  'location.city': place.city?.trim() || deleteField(),
  'location.region': place.region?.trim() || deleteField(),
  'location.country': place.country?.trim() || deleteField(),
  'location.countryCode': place.countryCode?.trim() || deleteField(),
});

/**
 * Automatic mode: coordinates → rounding → local cache → resolverUbicacion if they changed → the profile.
 * With `allowPrompt` it may ask for the permission (only after a tap). Null if there's no permission, no position
 * or no place there; then the last saved place stays as it is.
 */
export async function refreshAutoLocation(uid: string, opts: { allowPrompt: boolean }): Promise<UserLocation | null> {
  const raw = opts.allowPrompt ? await requestCoarsePosition() : await getCoarsePositionIfGranted();
  if (!raw) return null;
  const coords = roundCoords(raw);

  const cached = await readCache(uid);
  let place = cached && sameCoords(cached.coords, coords) ? cached.place : null;
  if (!place) {
    place = await resolveLocation(coords);
    if (!place) return null;
    await writeCache(uid, { coords, place });
  }

  const updatedAt = Date.now();
  await updateDoc(userRef(uid), {
    'location.mode': 'auto',
    'location.source': 'gps',
    'location.updatedAt': updatedAt,
    // A tap is an answer to the notice
    ...(opts.allowPrompt ? { 'location.askedAt': updatedAt } : {}),
    ...placeFields(place),
  });
  return { mode: 'auto', source: 'gps', updatedAt, ...place };
}

/** The country and city the user picked in the profile */
export const saveManualLocation = (uid: string, place: { country: string; countryCode?: string; city?: string }) =>
  updateDoc(userRef(uid), {
    'location.mode': 'manual',
    'location.source': 'manual',
    'location.updatedAt': Date.now(),
    ...placeFields({ ...place, region: undefined }),
  });

/** When the automatic location can't be had (no permission, no place): manual, with a soft notice in the UI */
export const fallBackToManualLocation = (uid: string) =>
  updateDoc(userRef(uid), { 'location.mode': 'manual', 'location.askedAt': Date.now() });

/** Off: Pive doesn't use it, and the place is deleted */
export async function turnOffLocation(uid: string) {
  await updateDoc(userRef(uid), {
    'location.mode': 'off',
    'location.source': deleteField(),
    'location.updatedAt': deleteField(),
    ...placeFields({}),
  });
  await AsyncStorage.removeItem(cacheKey(uid)).catch(() => {});
}

/** "Ahora no" on the notice: it comes back in 30 days. Doesn't change the mode if there is one */
export const snoozeLocationNotice = (uid: string, current: UserLocation | undefined) =>
  updateDoc(userRef(uid), {
    'location.askedAt': Date.now(),
    ...(current?.mode ? {} : { 'location.mode': 'manual' }),
  });

/** The device's time zone, if it changed */
export const saveTimeZone = (uid: string, timeZone: string) => updateDoc(userRef(uid), { timeZone });
