import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { User } from 'lucide-react-native';
import { handleFirestoreError, OperationType } from '../../firebase';
import { Theme } from '../../theme';
import { formatNum } from '../../lib/utils';
import { UserProfile } from '../../types';
import { saveProfileInfo } from '../../services/profileService';
import { saveMetricsToHealthKit } from '../../services/healthKitService';
import { sectionStyles } from './sectionStyles';

interface PersonalInfoSectionProps {
  uid?: string;
  profile: UserProfile | null;
}

/** Name, bio and body metrics, with an edit mode that saves them. */
export function PersonalInfoSection({ uid, profile }: PersonalInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync state with profile when editing starts or profile changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setBio(profile.bio || '');
      setWeight(profile.bodyMetrics?.weight?.toString() || '');
      setBodyFat(profile.bodyMetrics?.bodyFat?.toString() || '');
      setMuscleMass(profile.bodyMetrics?.muscleMass?.toString() || '');
    }
  }, [profile, isEditing]);

  const handleSave = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const metrics = {
        weight: parseFloat(weight) || 0,
        bodyFat: parseFloat(bodyFat) || 0,
        muscleMass: parseFloat(muscleMass) || 0,
        updatedAt: Date.now()
      };

      await saveProfileInfo(uid, { displayName, bio, bodyMetrics: metrics });

      // Sync to HealthKit
      saveMetricsToHealthKit(metrics.weight, metrics.bodyFat, metrics.muscleMass).catch(err => {
        console.warn('[HealthKit] Error syncing metrics from profile.tsx:', err);
      });

      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.sectionTitleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <User size={20} color={Theme.colors.primary} />
          <Text style={sectionStyles.sectionTitle}>Información Personal</Text>
        </View>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Theme.colors.primary} />
          ) : (
            <>
              <Text style={styles.editButtonText}>{isEditing ? 'Guardar' : 'Editar'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={sectionStyles.card}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nombre</Text>
          {isEditing ? (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholder="Tu nombre..."
              placeholderTextColor={Theme.colors.onSurfaceVariant}
            />
          ) : (
            <Text style={styles.fieldValue}>{profile?.displayName || 'Sin nombre'}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Bio</Text>
          {isEditing ? (
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
              placeholder="Escribe algo sobre ti..."
              placeholderTextColor={Theme.colors.onSurfaceVariant}
            />
          ) : (
            <Text style={styles.bioText}>{profile?.bio || 'Sin biografía'}</Text>
          )}
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.fieldLabel}>Peso (kg)</Text>
            {isEditing ? (
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                style={styles.metricInput}
                placeholder="0"
                placeholderTextColor={Theme.colors.onSurfaceVariant}
              />
            ) : (
              <Text style={styles.metricValue}>{formatNum(profile?.bodyMetrics?.weight)} kg</Text>
            )}
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.fieldLabel}>% Grasa</Text>
            {isEditing ? (
              <TextInput
                value={bodyFat}
                onChangeText={setBodyFat}
                keyboardType="numeric"
                style={styles.metricInput}
                placeholder="0"
                placeholderTextColor={Theme.colors.onSurfaceVariant}
              />
            ) : (
              <Text style={styles.metricValue}>{formatNum(profile?.bodyMetrics?.bodyFat)}%</Text>
            )}
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.fieldLabel}>Músculo (kg)</Text>
            {isEditing ? (
              <TextInput
                value={muscleMass}
                onChangeText={setMuscleMass}
                keyboardType="numeric"
                style={styles.metricInput}
                placeholder="0"
                placeholderTextColor={Theme.colors.onSurfaceVariant}
              />
            ) : (
              <Text style={styles.metricValue}>{formatNum(profile?.bodyMetrics?.muscleMass)} kg</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editButton: {
    backgroundColor: Theme.colors.primary + '1a',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 99,
  },
  editButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    textTransform: 'uppercase',
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  bioText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
  },
  input: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  metricItem: {
    flex: 1,
    gap: 6,
  },
  metricValue: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  metricInput: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
