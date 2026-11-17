import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Theme } from '../theme';
import type { UserLocation } from '../types';
import { useDetectLocation } from '../hooks/useDetectLocation';
import { snoozeLocationNotice } from '../services/locationProfileService';

/**
 * The one-time location notice (diseno §5), in the style of "¡Completa tu perfil!". The system permission is only
 * asked after tapping "Usar mi ubicación"; "Ahora no" postpones it 30 days. Whether to show it:
 * shouldShowLocationNotice.
 */
export function LocationNotice({ uid, location }: { uid: string; location: UserLocation | undefined }) {
  const { locating, detect } = useDetectLocation(uid);

  const later = () => {
    snoozeLocationNotice(uid, location).catch((err) => console.warn('[Location] Could not postpone the notice:', err));
  };

  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.title}>📍 ¿Dónde estás?</Text>
      <Text style={styles.body}>
        Pive usa tu ubicación principalmente para sugerirte comidas y tiendas de tu zona. Solo guardamos tu ciudad y país.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={detect} disabled={locating} accessibilityRole="button">
          {locating ? (
            <ActivityIndicator size="small" color={Theme.colors.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>Usar mi ubicación</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/profile')} accessibilityRole="button">
          <Text style={styles.secondaryText}>Elegir manualmente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={later} accessibilityRole="button">
          <Text style={styles.laterText}>Ahora no</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Theme.colors.primary + '1a',
    borderColor: Theme.colors.primary + '33',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  title: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.primary,
  },
  body: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 99,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onPrimary,
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  laterText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
});
