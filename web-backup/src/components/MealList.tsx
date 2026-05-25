import React from 'react';
import { Utensils } from 'lucide-react';
import { Meal } from '../types';
import { MealCard } from './MealCard';

interface MealListProps {
  meals: Meal[];
  onDeleteMeal: (meal: Meal) => void;
}

export const MealList: React.FC<MealListProps> = ({ meals, onDeleteMeal }) => {
  if (!meals || meals.length === 0) {
    return (
      <div className="bg-surface-container/50 border border-dashed border-outline-variant/30 rounded-xl p-8 text-center">
        <Utensils className="mx-auto text-on-surface-variant/30 mb-3" size={32} />
        <p className="text-on-surface-variant text-sm">Aún no has registrado comidas hoy.</p>
        <p className="text-[10px] text-on-surface-variant/60 mt-1 uppercase tracking-widest font-bold">Toca el botón + para empezar</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} onDelete={onDeleteMeal} />
      ))}
    </div>
  );
};
