import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from '../theme';
import { MEAL_SLOT_LABELS, MEAL_SLOTS, type MealSlot } from '../../functions/src/shared/meals/slots';

interface SlotChipsProps {
  value: MealSlot;
  onChange: (slot: MealSlot) => void;
  /** Slots to offer; all of them by default */
  slots?: readonly MealSlot[];
  disabled?: boolean;
}

/** One chip per meal slot ("Desayuno", "Almuerzo"…), with one selected. */
export function SlotChips({ value, onChange, slots = MEAL_SLOTS, disabled }: SlotChipsProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {slots.map((slot) => {
        const selected = slot === value;
        return (
          <Pressable
            key={slot}
            onPress={() => onChange(slot)}
            disabled={disabled}
            style={[styles.chip, selected ? styles.chipSelected : null]}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={MEAL_SLOT_LABELS[slot]}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{MEAL_SLOT_LABELS[slot]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Theme.colors.primary + '26',
    borderColor: Theme.colors.primary,
  },
  chipText: {
    fontFamily: Theme.fonts.label,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  chipTextSelected: {
    color: Theme.colors.primary,
  },
});
