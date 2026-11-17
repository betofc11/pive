import { useEffect, useRef } from 'react';
import type { UserProfile } from '../types';
import { isAutoLocationStale } from '../lib/location';
import { getPermissionState } from '../services/locationService';
import { refreshAutoLocation, saveTimeZone } from '../services/locationProfileService';

const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

/**
 * When the app opens (once per session): saves the device's time zone if it changed, and refreshes the automatic
 * location if it's older than 6 h and the permission is already granted. It never asks for the permission.
 */
export function useLocationSync(uid: string | undefined, profile: UserProfile | null) {
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || !profile || done.current === uid) return;
    done.current = uid;

    const timeZone = deviceTimeZone();
    if (timeZone && timeZone !== profile.timeZone) {
      saveTimeZone(uid, timeZone).catch((err) => console.warn('[Location] Could not save the time zone:', err));
    }

    if (isAutoLocationStale(profile.location, Date.now())) {
      getPermissionState()
        .then((state) => (state === 'granted' ? refreshAutoLocation(uid, { allowPrompt: false }) : null))
        .catch((err) => console.warn('[Location] Could not refresh the location:', err));
    }
  }, [uid, profile]);
}
