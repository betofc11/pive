import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Utensils } from 'lucide-react-native';
import { Meal } from '../types';
import { MealCard } from './MealCard';
import { Theme } from '../theme';

interface MealListProps {
  meals: Meal[];
  onDeleteMeal: (meal: Meal) => void;
}

export const MealList: React.FC<MealListProps> = ({ meals, onDeleteMeal }) => {
  if (!meals || meals.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Utensils size={32} color={Theme.colors.onSurfaceVariant} style={styles.emptyIcon} />
        <Text style={styles.emptyText}>Aún no has registrado comidas hoy.</Text>
        <Text style={styles.emptySubtext}>Toca el botón + para empezar</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} onDelete={onDeleteMeal} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  emptyContainer: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderStyle: 'dashed',
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    opacity: 0.3,
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  emptySubtext: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Theme.colors.primary,
    marginTop: 4,
    opacity: 0.8,
  },
});
