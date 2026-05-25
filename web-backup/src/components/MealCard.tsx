import React from 'react';
import { Utensils, Trash2 } from 'lucide-react';
import { formatNum } from '../lib/utils';
import { Meal } from '../types';

interface MealCardProps {
  meal: Meal;
  onDelete: (meal: Meal) => void;
}

export const MealCard: React.FC<MealCardProps> = ({ meal, onDelete }) => {
  return (
    <div className="bg-surface-container p-4 rounded-xl flex flex-col gap-3 border border-outline-variant/10">
      <div className="flex items-center gap-4">
        {meal.imageUrl ? (
          <img src={meal.imageUrl} alt={meal.name} className="w-12 h-12 rounded-lg object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
            <Utensils size={20} />
          </div>
        )}
        <div className="grow">
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate text-[15px]">{meal.name}</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {new Date(meal.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">

            <div className="flex-1">
              <p className="font-bold text-primary">{formatNum(meal.macros.calories)} kcal</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                P: {formatNum(meal.macros.protein)}g | C: {formatNum(meal.macros.carbs)}g | G: {formatNum(meal.macros.fats)}g
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDelete(meal)}
          className="p-1.5 text-on-surface-variant/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors -mt-1 -mr-1"
          aria-label="Eliminar comida"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>

  );
};
