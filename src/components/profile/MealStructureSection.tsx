import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { handleFirestoreError, OperationType } from '../../firebase';
import { Theme } from '../../theme';
import type { UserProfile } from '../../types';
import { clearDayStructure, saveDayStructure } from '../../services/profileService';
import { normalizeClockInput, structureOf } from '../../lib/mealSlots';
import { sectionStyles } from './sectionStyles';
import { buildDayStructure, DEFAULT_WEIGHTS, DEFAULT_WINDOWS, type DayStructure } from '../../../functions/src/shared/meals/dayStructure';
import { clockToMinutes } from '../../../functions/src/shared/dates';
import { MEAL_SLOT_LABELS, PLANNED_SLOTS, type PlannedSlot } from '../../../functions/src/shared/meals/slots';

const SOURCE_LABELS: Record<DayStructure['source'], string> = {
  plan: 'Según tu plan',
  user: 'Personalizada',
  default: 'Por defecto',
};

interface DraftSlot {
  enabled: boolean;
  start: string;
  end: string;
}
type Draft = Record<PlannedSlot, DraftSlot>;

const draftFrom = (structure: DayStructure): Draft =>
  Object.fromEntries(
    PLANNED_SLOTS.map((slot) => {
      const current = structure.slots.find((s) => s.slot === slot);
      const window = current?.window ?? DEFAULT_WINDOWS[slot];
      return [slot, { enabled: Boolean(current), start: window.start, end: window.end }];
    }),
  ) as Draft;

/** The draft as a structure, or the message of what's wrong with it. Weights stay as they were (default for new slots). */
function structureFromDraft(draft: Draft, current: DayStructure): DayStructure | string {
  const slots = [];
  for (const slot of PLANNED_SLOTS) {
    const d = draft[slot];
    if (!d.enabled) continue;
    const start = normalizeClockInput(d.start);
    const end = normalizeClockInput(d.end);
    if (!start || !end) return `Revisa los horarios de ${MEAL_SLOT_LABELS[slot]}: usa el formato HH:mm (por ejemplo, 07:30).`;
    if ((clockToMinutes(start) as number) >= (clockToMinutes(end) as number)) {
      return `En ${MEAL_SLOT_LABELS[slot]}, la hora de inicio tiene que ser antes que la de fin.`;
    }
    const weight = current.slots.find((s) => s.slot === slot)?.weight ?? DEFAULT_WEIGHTS[slot];
    slots.push({ slot, weight, window: { start, end } });
  }
  if (slots.length === 0) return 'Activa al menos un tiempo de comida.';
  return buildDayStructure('user', slots);
}

/** "Mis comidas del día": the slots Pive splits the day into, where they come from, and editing them. */
export function MealStructureSection({ uid, profile }: { uid?: string; profile: UserProfile | null }) {
  const structure = structureOf(profile);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEditing = draft !== null;

  const startEditing = () => {
    setDraft(draftFrom(structure));
    setError(null);
  };

  const updateDraft = (slot: PlannedSlot, patch: Partial<DraftSlot>) => {
    setDraft((prev) => (prev ? { ...prev, [slot]: { ...prev[slot], ...patch } } : prev));
  };

  const handleSave = async () => {
    if (!uid || !draft) return;
    const result = structureFromDraft(draft, structure);
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setLoading(true);
    try {
      await saveDayStructure(uid, result);
      setDraft(null);
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      await clearDayStructure(uid);
      setDraft(null);
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.sectionTitleRow}>
        <View style={styles.titleLeft}>
          <Clock size={20} color={Theme.colors.primary} />
          <Text style={sectionStyles.sectionTitle}>Mis comidas del día</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => (isEditing ? handleSave() : startEditing())}
          disabled={loading || !uid}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color={Theme.colors.primary} />
          ) : (
            <Text style={styles.editButtonText}>{isEditing ? 'Guardar' : 'Editar'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={sectionStyles.card}>
        <Text style={styles.sourceText}>
          {SOURCE_LABELS[structure.source]}. Pive reparte lo que te queda del día entre los tiempos que te faltan.
        </Text>

        {!isEditing &&
          structure.slots.map((s) => (
            <View key={s.slot} style={styles.slotRow}>
              <Text style={styles.slotName}>{MEAL_SLOT_LABELS[s.slot]}</Text>
              <Text style={styles.slotWindow}>
                {s.window.start}–{s.window.end}
              </Text>
              <Text style={styles.slotWeight}>{s.weight}%</Text>
            </View>
          ))}

        {isEditing &&
          PLANNED_SLOTS.map((slot) => {
            const d = draft[slot];
            const label = MEAL_SLOT_LABELS[slot];
            return (
              <View key={slot} style={styles.editRow}>
                <Switch
                  value={d.enabled}
                  onValueChange={(enabled) => updateDraft(slot, { enabled })}
                  trackColor={{ true: Theme.colors.primary, false: Theme.colors.outlineVariant }}
                  accessibilityLabel={`${label}: ${d.enabled ? 'activado' : 'desactivado'}`}
                />
                <Text style={[styles.slotName, !d.enabled ? styles.disabledText : null]}>{label}</Text>
                <TextInput
                  value={d.start}
                  onChangeText={(start) => updateDraft(slot, { start })}
                  editable={d.enabled}
                  style={[styles.timeInput, !d.enabled ? styles.disabledText : null]}
                  placeholder="HH:mm"
                  placeholderTextColor={Theme.colors.onSurfaceVariant}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  accessibilityLabel={`${label}, desde`}
                />
                <Text style={styles.dash}>–</Text>
                <TextInput
                  value={d.end}
                  onChangeText={(end) => updateDraft(slot, { end })}
                  editable={d.enabled}
                  style={[styles.timeInput, !d.enabled ? styles.disabledText : null]}
                  placeholder="HH:mm"
                  placeholderTextColor={Theme.colors.onSurfaceVariant}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  accessibilityLabel={`${label}, hasta`}
                />
              </View>
            );
          })}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {isEditing && (
          <TouchableOpacity onPress={() => setDraft(null)} style={styles.linkButton} accessibilityRole="button">
            <Text style={styles.linkText}>Cancelar</Text>
          </TouchableOpacity>
        )}

        {structure.source === 'user' && !isEditing && (
          <TouchableOpacity onPress={handleReset} disabled={loading} style={styles.linkButton} accessibilityRole="button">
            <Text style={styles.linkText}>
              {profile?.nutritionalPlan ? 'Volver a los tiempos de mi plan' : 'Volver a los tiempos por defecto'}
            </Text>
          </TouchableOpacity>
        )}
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
  editButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.primary,
  },
  sourceText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 17,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slotName: {
    flex: 1,
    fontFamily: Theme.fonts.label,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  slotWindow: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  slotWeight: {
    width: 40,
    textAlign: 'right',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  timeInput: {
    width: 62,
    minHeight: 40,
    textAlign: 'center',
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
  },
  dash: {
    color: Theme.colors.onSurfaceVariant,
  },
  disabledText: {
    opacity: 0.4,
  },
  errorText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.error,
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
});
