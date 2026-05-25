import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Utensils, Trash2 } from 'lucide-react-native';
import { formatNum } from '../lib/utils';
import { Meal } from '../types';
import { Theme } from '../theme';

interface MealCardProps {
  meal: Meal;
  onDelete: (meal: Meal) => void;
}

export const MealCard: React.FC<MealCardProps> = ({ meal, onDelete }) => {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        {meal.imageUrl ? (
          <Image 
            source={{ uri: meal.imageUrl }} 
            style={styles.image} 
            contentFit="cover"
            transition={200}
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
          <Text style={styles.time}>
            {new Date(meal.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.calories}>
            {formatNum(meal.macros.calories)} kcal
          </Text>
          <Text style={styles.macros}>
            P: {formatNum(meal.macros.protein)}g  |  C: {formatNum(meal.macros.carbs)}g  |  G: {formatNum(meal.macros.fats)}g
          </Text>
        </View>
        <Pressable onPress={() => onDelete(meal)} style={styles.deleteButton}>
          <Trash2 size={18} color={Theme.colors.error} />
        </Pressable>
      </View>
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
  time: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
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
