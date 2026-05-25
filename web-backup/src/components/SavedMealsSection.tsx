import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, ChevronDown, ChevronUp, Plus, Trash2, Loader2, CheckCircle2, Utensils, Edit2 } from 'lucide-react';
import { collection, query, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { formatNum } from '../lib/utils';

interface SavedMeal {
  id: string;
  name: string;
  ingredients: any[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  imageUrl?: string;
}

interface SavedMealsSectionProps {
  onRegister: (meal: any) => Promise<void>;
  onEdit: (meal: SavedMeal) => void;
}

export const SavedMealsSection: React.FC<SavedMealsSectionProps> = ({ onRegister, onEdit }) => {
  const { user } = useAuth();
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, `users/${user.uid}/savedMeals`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meals = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SavedMeal[];
      setSavedMeals(meals);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, mealId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta comida guardada?')) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/savedMeals`, mealId));
    } catch (err) {
      console.error("Error deleting saved meal:", err);
    }
  };

  const handleRegister = async (meal: SavedMeal) => {
    setLoadingId(meal.id);
    try {
      // Adapt SavedMeal to the format handleRegisterMeal expects
      const option = {
        title: meal.name,
        ingredients: meal.ingredients,
        macros: meal.macros
      };
      await onRegister(option);
      setSuccessId(meal.id);
      setTimeout(() => setSuccessId(null), 2000);
    } catch (err) {
      console.error("Error registering saved meal:", err);
    } finally {
      setLoadingId(null);
    }
  };

  if (savedMeals.length === 0) return null;

  return (
    <section className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
            <Bookmark size={18} />
          </div>
          <h3 className="font-headline font-bold text-xl">Comidas Guardadas</h3>
          <span className="bg-surface-container-high px-2 py-0.5 rounded-full text-[10px] font-bold text-on-surface-variant">
            {savedMeals.length}
          </span>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary text-sm font-bold flex items-center gap-1 hover:bg-primary/10 px-3 py-1.5 rounded-full transition-colors"
        >
          {isExpanded ? 'Ver menos' : 'Ver más'}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3"
          >
            {savedMeals.map((meal) => {
              const isMealExpanded = expandedMealId === meal.id;
              const isLogging = loadingId === meal.id;
              const isSuccess = successId === meal.id;

              return (
                <div key={meal.id} className="bg-surface-container rounded-[24px] overflow-hidden border border-outline-variant/10 shadow-sm">
                  <div className="p-2 flex items-center justify-between gap-2">
                    <button 
                      onClick={() => setExpandedMealId(isMealExpanded ? null : meal.id)}
                      className="flex-1 flex items-center gap-3 text-left p-2 rounded-full hover:bg-surface-container-high transition-colors min-w-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0">
                        <Utensils size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{meal.name}</p>
                        <p className="text-[10px] text-on-surface-variant">
                          {formatNum(meal.macros.calories)} kcal | P: {formatNum(meal.macros.protein)}g
                        </p>
                      </div>
                      {isMealExpanded ? <ChevronUp size={16} className="text-on-surface-variant flex-shrink-0 ml-auto" /> : <ChevronDown size={16} className="text-on-surface-variant flex-shrink-0 ml-auto" />}
                    </button>
                    
                    <div className="flex items-center gap-1 pr-1">
                      <button 
                        onClick={() => handleRegister(meal)}
                        disabled={isLogging || isSuccess}
                        className={`flex items-center gap-1 px-4 py-2.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 flex-shrink-0 ${
                          isSuccess ? 'bg-green-500/20 text-green-500' : 'bg-primary/10 hover:bg-primary/20 text-primary'
                        }`}
                      >
                        {isLogging ? <Loader2 size={14} className="animate-spin" /> : isSuccess ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                        <span className="hidden sm:inline">{isLogging ? 'Registrando...' : isSuccess ? 'Registrado' : 'Registrar'}</span>
                      </button>
                      
                      <button 
                        onClick={() => onEdit(meal)}
                        className="p-2.5 text-on-surface-variant/40 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                        aria-label="Editar comida guardada"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button 
                        onClick={(e) => handleDelete(e, meal.id)}
                        className="p-2.5 text-on-surface-variant/40 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                        aria-label="Eliminar comida guardada"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isMealExpanded && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1">
                          <div className="bg-surface-container-highest/30 rounded-2xl p-4 space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-tertiary/5 p-2 rounded-lg flex flex-col items-center">
                                <span className="text-[9px] text-tertiary uppercase font-bold">Carbs</span>
                                <span className="text-xs font-bold">{formatNum(meal.macros.carbs)}g</span>
                              </div>
                              <div className="bg-secondary/5 p-2 rounded-lg flex flex-col items-center">
                                <span className="text-[9px] text-secondary uppercase font-bold">Grasas</span>
                                <span className="text-xs font-bold">{formatNum(meal.macros.fats)}g</span>
                              </div>
                              <div className="bg-primary/5 p-2 rounded-lg flex flex-col items-center">
                                <span className="text-[9px] text-primary uppercase font-bold">Prot</span>
                                <span className="text-xs font-bold">{formatNum(meal.macros.protein)}g</span>
                              </div>
                            </div>
                            
                            <div className="border-t border-outline-variant/10 pt-3">
                              <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2">Ingredientes</p>
                              <ul className="space-y-2">
                                {meal.ingredients.map((ing, ingIdx) => (
                                  <li key={ingIdx} className="flex justify-between text-xs items-center">
                                    <span className="text-on-surface-variant">{ing.name}</span>
                                    <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">{ing.quantity} {ing.unit}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
