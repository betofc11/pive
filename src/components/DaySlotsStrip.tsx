import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Theme } from '../theme';
import { formatNum } from '../lib/utils';
import type { SlotStatus } from '../../functions/src/shared/meals/budget';
import { MEAL_SLOT_LABELS } from '../../functions/src/shared/meals/slots';

const detailOf = (s: SlotStatus): string => {
  switch (s.state) {
    case 'logged':
      return `${formatNum(s.consumed.calories)} kcal`;
    case 'missed':
      return 'Sin registrar';
    default:
      if (s.light) return 'Ligera';
      return `~${formatNum(s.budget?.calories ?? 0)} kcal`;
  }
};

const a11yStateOf = (s: SlotStatus): string => {
  switch (s.state) {
    case 'logged':
      return 'registrada';
    case 'missed':
      return 'sin registrar, ya pasó su horario';
    case 'next':
      return 'la próxima';
    default:
      return 'pendiente';
  }
};

/** The day's slots with what each one took or has left: the same numbers Pive's advice uses. */
export function DaySlotsStrip({ slots }: { slots: SlotStatus[] }) {
  if (slots.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {slots.map((s) => {
        const isNext = s.state === 'next';
        const detail = detailOf(s);
        return (
          <View
            key={s.slot}
            style={[styles.pill, isNext ? styles.pillNext : null, s.state === 'missed' ? styles.pillMissed : null]}
            accessible
            accessibilityLabel={`${MEAL_SLOT_LABELS[s.slot]}, ${a11yStateOf(s)}, ${detail}${s.isLastOfDay ? ', la última del día' : ''}`}
          >
            <View style={styles.labelRow}>
              {s.state === 'logged' && <Check size={12} color={Theme.colors.primary} />}
              <Text style={[styles.label, isNext ? styles.labelNext : null]}>{MEAL_SLOT_LABELS[s.slot]}</Text>
            </View>
            <Text style={styles.detail}>{isNext ? `Próxima · ${detail}` : detail}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surfaceContainer,
    gap: 2,
  },
  pillNext: {
    borderColor: Theme.colors.primary + '66',
    backgroundColor: Theme.colors.primary + '14',
  },
  pillMissed: {
    opacity: 0.6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: Theme.fonts.label,
    fontSize: 12,
    color: Theme.colors.onSurface,
  },
  labelNext: {
    color: Theme.colors.primary,
  },
  detail: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
});
