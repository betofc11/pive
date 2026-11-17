import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown, MapPin } from 'lucide-react-native';
import { Alert } from '../../lib/alert';
import { Theme } from '../../theme';
import type { UserLocation, UserProfile } from '../../types';
import { sectionStyles } from './sectionStyles';
import { Modal } from '../Modal';
import { COUNTRIES, OTHER_COUNTRY } from '../../lib/countries';
import { useDetectLocation } from '../../hooks/useDetectLocation';
import { saveManualLocation, turnOffLocation } from '../../services/locationProfileService';
import { placeLabel, timeAgoLabel } from '../../../functions/src/shared/location';

type Mode = UserLocation['mode'];

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'auto', label: 'Automática' },
  { mode: 'manual', label: 'Manual' },
  { mode: 'off', label: 'Desactivada' },
];

const showError = (err: unknown) => {
  console.error('[Location] Could not save:', err);
  Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
};

function ManualForm({ uid, location, onSaved }: { uid: string; location: UserLocation | undefined; onSaved: () => void }) {
  const known = COUNTRIES.find((c) => c.code === location?.countryCode || c.name === location?.country);
  const [country, setCountry] = useState<string | null>(known?.name ?? (location?.country ? OTHER_COUNTRY : null));
  const [otherCountry, setOtherCountry] = useState(known ? '' : (location?.country ?? ''));
  const [city, setCity] = useState(location?.mode === 'manual' ? (location.city ?? '') : '');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const countryName = country === OTHER_COUNTRY ? otherCountry.trim() : country;
  const canSave = Boolean(countryName) && !saving;

  const save = async () => {
    if (!countryName) return;
    setSaving(true);
    try {
      const code = COUNTRIES.find((c) => c.name === countryName)?.code;
      await saveManualLocation(uid, { country: countryName, ...(code ? { countryCode: code } : {}), city: city.trim() || undefined });
      onSaved();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <TouchableOpacity style={styles.select} onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel="Elegir país">
        <Text style={country ? styles.inputText : styles.placeholder}>{country ?? 'Elige tu país'}</Text>
        <ChevronDown size={18} color={Theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
      {country === OTHER_COUNTRY && (
        <TextInput
          value={otherCountry}
          onChangeText={setOtherCountry}
          style={styles.input}
          placeholder="¿En qué país estás?"
          placeholderTextColor={Theme.colors.onSurfaceVariant}
          accessibilityLabel="País"
          maxLength={60}
        />
      )}
      <TextInput
        value={city}
        onChangeText={setCity}
        style={styles.input}
        placeholder="Ciudad (opcional)"
        placeholderTextColor={Theme.colors.onSurfaceVariant}
        accessibilityLabel="Ciudad"
        maxLength={60}
      />
      <TouchableOpacity style={[styles.primaryButton, !canSave ? styles.disabled : null]} onPress={save} disabled={!canSave} accessibilityRole="button">
        {saving ? <ActivityIndicator size="small" color={Theme.colors.onPrimary} /> : <Text style={styles.primaryText}>Guardar</Text>}
      </TouchableOpacity>

      <Modal isOpen={picking} onClose={() => setPicking(false)} title="Tu país">
        {[...COUNTRIES.map((c) => c.name), OTHER_COUNTRY].map((name) => (
          <TouchableOpacity
            key={name}
            style={styles.countryRow}
            onPress={() => {
              setCountry(name);
              setPicking(false);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: name === country }}
          >
            <Text style={styles.inputText}>{name}</Text>
            {name === country && <Check size={18} color={Theme.colors.primary} />}
          </TouchableOpacity>
        ))}
      </Modal>
    </View>
  );
}

/** "Ubicación": automatic, manual (country + city) or off. Only city and country are saved. */
export function LocationSection({ uid, profile }: { uid?: string; profile: UserProfile | null }) {
  const location = profile?.location;
  const [selected, setSelected] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const { locating, detect } = useDetectLocation(uid);
  const mode: Mode | null = selected ?? location?.mode ?? null;
  const place = placeLabel(location);

  const choose = async (next: Mode) => {
    if (!uid) return;
    setSelected(next);
    if (next === 'auto') {
      // On failure it falls back to manual: follow the profile again
      if (!(await detect())) setSelected(null);
    } else if (next === 'off' && location?.mode !== 'off') {
      setBusy(true);
      try {
        await turnOffLocation(uid);
      } catch (err) {
        showError(err);
      } finally {
        setBusy(false);
        setSelected(null);
      }
    }
  };

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.sectionTitleRow}>
        <View style={styles.titleLeft}>
          <MapPin size={20} color={Theme.colors.primary} />
          <Text style={sectionStyles.sectionTitle} accessibilityRole="header">
            Ubicación
          </Text>
        </View>
      </View>

      <View style={sectionStyles.card}>
        <View style={styles.segmented} accessibilityRole="radiogroup">
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.mode}
              style={[styles.segment, mode === m.mode ? styles.segmentActive : null]}
              onPress={() => choose(m.mode)}
              disabled={!uid || busy || locating}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === m.mode }}
            >
              <Text style={[styles.segmentText, mode === m.mode ? styles.segmentTextActive : null]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {(busy || locating) && <ActivityIndicator size="small" color={Theme.colors.primary} />}

        {mode === null && (
          <Text style={styles.helpText}>Pive usa tu ubicación para sugerirte comidas y tiendas de tu zona. Solo guardamos tu ciudad y país.</Text>
        )}

        {mode === 'auto' && !locating && (
          <>
            <Text style={styles.helpText}>
              {place && location?.updatedAt
                ? `Detectada: ${place} · ${timeAgoLabel(location.updatedAt, Date.now())}`
                : 'Todavía no la hemos detectado.'}
            </Text>
            <TouchableOpacity onPress={detect} style={styles.linkButton} accessibilityRole="button" disabled={!uid}>
              <Text style={styles.linkText}>Actualizar ahora</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'manual' && uid && (
          <>
            {location?.mode === 'manual' && place && <Text style={styles.helpText}>Ahora: {place}</Text>}
            <ManualForm key={`${location?.country ?? ''}-${location?.city ?? ''}`} uid={uid} location={location} onSaved={() => setSelected(null)} />
          </>
        )}

        {mode === 'off' && !busy && <Text style={styles.helpText}>Pive no usa tu ubicación. Te sugiere opciones generales.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: Theme.colors.primary + '33',
  },
  segmentText: {
    fontFamily: Theme.fonts.label,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  segmentTextActive: {
    color: Theme.colors.primary,
  },
  helpText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  linkButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  form: {
    gap: 10,
  },
  select: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: {
    minHeight: 44,
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  placeholder: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 99,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  disabled: {
    opacity: 0.5,
  },
  countryRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});
