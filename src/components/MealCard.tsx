import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Utensils, Trash2, ChevronDown } from 'lucide-react-native';
import { formatNum } from '../lib/utils';
import { Meal, MealSlot } from '../types';
import { Theme } from '../theme';
import { Modal } from './Modal';
import { SlotChips } from './SlotChips';
import { MEAL_SLOT_LABELS } from '../../functions/src/shared/meals/slots';

interface MealCardProps {
  meal: Meal;
  onDelete: (meal: Meal) => void;
  /** Its slot: the saved one, or the inferred one for older meals. Without it the card shows no slot. */
  slot?: MealSlot;
  onChangeSlot?: (meal: Meal, slot: MealSlot) => void;
}

export const MealCard: React.FC<MealCardProps> = ({ meal, onDelete, slot, onChangeSlot }) => {
  // Older meals stored a device-local URI (file:// or blob:) that no longer loads
  const [imageFailed, setImageFailed] = useState(false);
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState(false);
  const time = new Date(meal.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        {meal.imageUrl && !imageFailed ? (
          <Image
            source={{ uri: meal.imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.fallbackIcon}>
            <Utensils size={20} color={Theme.colors.primary} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {meal.name}
          </Text>
          <View style={styles.metaRow}>
            {slot && (
              <Pressable
                onPress={() => setIsSlotPickerOpen(true)}
                disabled={!onChangeSlot}
                style={styles.slotPill}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`${MEAL_SLOT_LABELS[slot]}. Cambiar el tiempo de comida`}
              >
                <Text style={styles.slotPillText}>{MEAL_SLOT_LABELS[slot]}</Text>
                {onChangeSlot && <ChevronDown size={12} color={Theme.colors.primary} />}
              </Pressable>
            )}
            <Text style={styles.time}>{time}</Text>
          </View>
          <Text style={styles.calories}>
            {formatNum(meal.macros.calories)} kcal
          </Text>
          <Text style={styles.macros}>
            P: {formatNum(meal.macros.protein)}g  |  C: {formatNum(meal.macros.carbs)}g  |  G: {formatNum(meal.macros.fats)}g
          </Text>
        </View>
        <Pressable
          onPress={() => onDelete(meal)}
          style={styles.deleteButton}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Borrar ${meal.name}`}
        >
          <Trash2 size={18} color={Theme.colors.error} />
        </Pressable>
      </View>

      {slot && onChangeSlot && (
        <Modal isOpen={isSlotPickerOpen} onClose={() => setIsSlotPickerOpen(false)} title="¿Qué comida fue?">
          <View style={styles.pickerContent}>
            <Text style={styles.pickerMealName} numberOfLines={2}>{meal.name} · {time}</Text>
            <SlotChips
              value={slot}
              onChange={(next) => {
                setIsSlotPickerOpen(false);
                if (next !== slot || meal.slot !== next) onChangeSlot(meal, next);
              }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  fallbackIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary + '1a',
  },
  slotPillText: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  time: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  pickerContent: {
    gap: 16,
  },
  pickerMealName: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  calories: {
    fontFamily: Theme.fonts.label,
    fontSize: 14,
    color: Theme.colors.primary,
    marginTop: 4,
  },
  macros: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
    alignSelf: 'flex-start',
  },
});
