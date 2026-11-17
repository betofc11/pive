import { useState } from 'react';
import { Alert } from '../lib/alert';
import { fallBackToManualLocation, refreshAutoLocation } from '../services/locationProfileService';

/**
 * "Usar mi ubicación" / "Actualizar ahora": asks for the position (the system may show its permission, so only
 * after a tap). If it can't, the location goes to manual with a soft notice.
 */
export function useDetectLocation(uid: string | undefined) {
  const [locating, setLocating] = useState(false);

  const detect = async (): Promise<boolean> => {
    if (!uid || locating) return false;
    setLocating(true);
    try {
      const location = await refreshAutoLocation(uid, { allowPrompt: true }).catch((err) => {
        console.warn('[Location] Could not detect the location:', err);
        return null;
      });
      if (location) return true;
      await fallBackToManualLocation(uid).catch(() => {});
      Alert.alert(
        'No pudimos detectar tu ubicación',
        'Puedes elegir tu país y ciudad en tu perfil, en "Ubicación". Si quieres usar la automática, revisa el permiso de ubicación.',
      );
      return false;
    } finally {
      setLocating(false);
    }
  };

  return { locating, detect };
}
