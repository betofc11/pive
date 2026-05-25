import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { getPiveAdvice } from '../services/geminiService';
import { Utensils, Wheat, Droplets, Leaf, Check, Timer, Sparkles, Trash2, ArrowRight } from 'lucide-react';
import { collection, query, where, onSnapshot, limit, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DailyLog, Meal } from '../types';
import { formatNum, getLocalDateString } from '../lib/utils';
import { Link } from 'react-router-dom';
import { MealList } from '../components/MealList';

export const Dashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [advice, setAdvice] = useState<string>('');
  const [generatingAdvice, setGeneratingAdvice] = useState(false);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);

  useEffect(() => {
    if (user) {
      const today = getLocalDateString();
      const logRef = doc(db, `users/${user.uid}/dailyLogs`, today);
      
      const unsubscribe = onSnapshot(logRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as DailyLog;
          setDailyLog(data);
          if (data.aiAdvice) {
            setAdvice(data.aiAdvice);
          }
        } else {
          setDailyLog(null);
          setAdvice('');
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/dailyLogs/${today}`);
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    const updateAdvice = async () => {
      if (!user || !dailyLog || !profile?.macroGoals) return;

      const macrosChanged = !dailyLog.adviceMacros || 
        dailyLog.macros.protein !== dailyLog.adviceMacros.protein ||
        dailyLog.macros.carbs !== dailyLog.adviceMacros.carbs ||
        dailyLog.macros.fats !== dailyLog.adviceMacros.fats;

      if (macrosChanged || !dailyLog.aiAdvice) {
        setGeneratingAdvice(true);
        try {
          const newAdvice = await getPiveAdvice(dailyLog.macros, profile.macroGoals, profile.bodyMetrics);
          if (newAdvice) {
            const today = getLocalDateString();
            const logRef = doc(db, `users/${user.uid}/dailyLogs`, today);
            await updateDoc(logRef, {
              aiAdvice: newAdvice,
              aiAdviceUpdatedAt: Date.now(),
              adviceMacros: dailyLog.macros
            });
            setAdvice(newAdvice);
          }
        } catch (error) {
          console.error("Error generating advice:", error);
        } finally {
          setGeneratingAdvice(false);
        }
      }
    };

    if (dailyLog && profile?.macroGoals) {
      updateAdvice();
    } else if (!dailyLog && profile?.macroGoals) {
      setAdvice('¡Sube tu plan nutricional para recibir consejos personalizados!');
    }
  }, [dailyLog?.macros, profile?.macroGoals, profile?.bodyMetrics, user]);

  const macros = dailyLog?.macros || { protein: 0, carbs: 0, fats: 0, calories: 0 };
  const goals = profile?.macroGoals || { protein: 160, carbs: 210, fats: 65, calories: 2000 };

  const dynamicGoals = useMemo(() => {
    const list = [];
    
    // Protein Goal
    if (macros.protein < goals.protein * 0.5) {
      list.push({
        id: 'protein',
        title: 'Prioridad Proteica',
        desc: `Te faltan ${formatNum(goals.protein - macros.protein)}g de proteína. Prioriza fuentes magras.`,
        icon: <Check size={20} />,
        color: 'primary'
      });
    }

    // Hydration Goal
    if ((dailyLog?.waterIntake || 0) < 2000) {
      list.push({
        id: 'water',
        title: 'Hidratación Crítica',
        desc: 'Aumenta tu consumo de agua. Tu cuerpo necesita hidratación para procesar los nutrientes.',
        icon: <Droplets size={20} />,
        color: 'secondary'
      });
    }

    // Body Composition Goals
    if (profile?.bodyMetrics) {
      const { bodyFat, muscleMass, weight } = profile.bodyMetrics;
      if (bodyFat && bodyFat > 22) {
        list.push({
          id: 'fat-loss',
          title: 'Enfoque Metabólico',
          desc: 'Tu perfil sugiere un enfoque en déficit controlado y cardio ligero para optimizar tu energía.',
          icon: <Leaf size={20} />,
          color: 'tertiary'
        });
      }
      if (muscleMass && muscleMass < weight * 0.4) {
        list.push({
          id: 'muscle',
          title: 'Estímulo Físico',
          desc: 'Asegura entrenamientos de fuerza intensos para fortalecer tu estructura.',
          icon: <Timer size={20} />,
          color: 'secondary'
        });
      }
    }

    // Default if empty
    if (list.length === 0) {
      list.push({
        id: 'default',
        title: 'Mantén el Ritmo',
        desc: 'Vas por buen camino. Sigue cumpliendo con tus macros y entrenamiento.',
        icon: <Sparkles size={20} />,
        color: 'primary'
      });
    }

    return list.slice(0, 3);
  }, [macros, goals, dailyLog?.waterIntake, profile?.bodyMetrics]);

  const remaining = {
    protein: Math.max(0, goals.protein - macros.protein),
    carbs: Math.max(0, goals.carbs - macros.carbs),
    fats: Math.max(0, goals.fats - macros.fats),
    calories: Math.max(0, goals.calories - macros.calories)
  };

  const firstName = profile?.displayName?.split(' ')[0] || 'Piver';
  const needsOnboarding = !profile?.bodyMetrics?.weight || !profile?.macroGoals;

  const ratio = goals.calories > 0 ? macros.calories / goals.calories : 0;
  const greetingCategory = ratio >= 0.95 ? 'done' : ratio >= 0.1 ? 'progress' : 'start';

  const greetingPrefix = useMemo(() => {
    const phrases = {
      start: ["¡Qué buena nota,", "¡A darle con todo,", "¡Hoy es un gran día,", "¡Con toda la actitud,"],
      progress: ["¡Vas súper bien,", "¡Excelente ritmo,", "¡Sigamos sumando,", "¡Buena energía,"],
      done: ["¡Energía a tope,", "¡Día coronado,", "¡Bien alimentado,", "¡Cerrando con fuerza,"]
    };
    const list = phrases[greetingCategory];
    return list[Math.floor(Math.random() * list.length)];
  }, [greetingCategory]);

  const todayDisplay = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  const handleDeleteMeal = async (mealToDelete: Meal) => {
    if (!user || !dailyLog) return;
    
    const today = getLocalDateString();
    const logRef = doc(db, `users/${user.uid}/dailyLogs`, today);
    
    try {
      const updatedMeals = dailyLog.meals.filter(m => m.id !== mealToDelete.id);
      const updatedMacros = {
        calories: Math.max(0, dailyLog.macros.calories - mealToDelete.macros.calories),
        protein: Math.max(0, dailyLog.macros.protein - mealToDelete.macros.protein),
        carbs: Math.max(0, dailyLog.macros.carbs - mealToDelete.macros.carbs),
        fats: Math.max(0, dailyLog.macros.fats - mealToDelete.macros.fats),
      };

      await updateDoc(logRef, {
        meals: updatedMeals,
        macros: updatedMacros
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/dailyLogs/${today}`);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight leading-tight">
              {greetingPrefix} <span className="text-primary">{firstName}</span>!
            </h1>
            <p className="text-on-surface-variant mt-2 font-medium capitalize">{todayDisplay}</p>
          </div>
          <div className="bg-surface-container-high px-3 py-1 rounded-full border border-outline-variant/20">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Hoy</span>
          </div>
        </div>
      </section>

      {/* Onboarding Prompt */}
      {needsOnboarding && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/20 rounded-2xl p-6 flex items-center justify-between gap-4"
        >
          <div className="flex-1">
            <h3 className="font-bold text-primary">¡Completa tu perfil!</h3>
            <p className="text-sm text-on-surface-variant">Necesitamos tu peso y objetivos para darte consejos precisos.</p>
          </div>
          <Link to="/profile" className="bg-primary text-on-primary p-3 rounded-full shadow-lg hover:scale-105 transition-transform">
            <ArrowRight size={20} />
          </Link>
        </motion.div>
      )}

      {/* Pive Graphic (Simplified Ring) */}
      <section className="flex flex-col items-center py-4">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#1f2020" strokeWidth="6" />
            <motion.circle 
              cx="50" cy="50" r="44" fill="none" stroke="#ffb1c1" strokeWidth="8" 
              strokeDasharray="276" 
              initial={{ strokeDashoffset: 276 }}
              animate={{ strokeDashoffset: 276 - (276 * Math.min(1, macros.protein / goals.protein)) }}
              strokeLinecap="round"
            />
            <motion.circle 
              cx="50" cy="50" r="34" fill="none" stroke="#00daf3" strokeWidth="6" 
              strokeDasharray="213" 
              initial={{ strokeDashoffset: 213 }}
              animate={{ strokeDashoffset: 213 - (213 * Math.min(1, macros.carbs / goals.carbs)) }}
              strokeLinecap="round"
            />
            <motion.circle 
              cx="50" cy="50" r="24" fill="none" stroke="#7c4dff" strokeWidth="4" 
              strokeDasharray="150" 
              initial={{ strokeDashoffset: 150 }}
              animate={{ strokeDashoffset: 150 - (150 * Math.min(1, macros.fats / goals.fats)) }}
              strokeLinecap="round"
            />
          </svg>
          <div className="text-center z-10">
            <span className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Restante</span>
            <div className="font-headline font-extrabold text-5xl">
              {formatNum(remaining.calories)}<span className="text-xl text-primary">kcal</span>
            </div>
          </div>
        </div>
      </section>

      {/* AI Advice */}
      <section className="bg-surface-container-high rounded-xl p-6 border border-primary/10 relative overflow-hidden">
        <div className="flex items-start gap-4 relative z-10">
          <div className="bg-primary/20 p-2 rounded-lg text-primary">
            <Sparkles size={20} className={generatingAdvice ? "animate-pulse" : ""} />
          </div>
          {generatingAdvice ? (
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-surface-container-highest rounded animate-pulse w-3/4"></div>
              <div className="h-4 bg-surface-container-highest rounded animate-pulse w-1/2"></div>
            </div>
          ) : (
            <p className="text-on-surface leading-relaxed font-medium italic">
              "{advice || 'Analizando tu vibra...'}"
            </p>
          )}
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -z-0"></div>
      </section>

      {/* Macros Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-tertiary-container/20 rounded-xl p-5 flex flex-col justify-between aspect-square border border-tertiary/20">
          <Utensils className="text-tertiary" size={32} />
          <div>
            <p className="text-on-surface-variant font-label text-[10px] uppercase font-bold tracking-widest">Proteína</p>
            <p className="text-on-surface font-headline text-3xl font-extrabold">{formatNum(macros.protein)}g</p>
            <p className="text-[10px] text-on-surface-variant mt-1">Faltan: {formatNum(remaining.protein)}g</p>
          </div>
        </div>
        <div className="bg-secondary/10 rounded-xl p-5 flex flex-col justify-between aspect-square border border-secondary/20">
          <Wheat className="text-secondary" size={32} />
          <div>
            <p className="text-on-surface-variant font-label text-[10px] uppercase font-bold tracking-widest">Carbos</p>
            <p className="text-on-surface font-headline text-3xl font-extrabold">{formatNum(macros.carbs)}g</p>
            <p className="text-[10px] text-on-surface-variant mt-1">Faltan: {formatNum(remaining.carbs)}g</p>
          </div>
        </div>
        <div className="bg-primary/10 rounded-xl p-5 flex flex-col justify-between aspect-square border border-primary/20">
          <Droplets className="text-primary" size={32} />
          <div>
            <p className="text-on-surface-variant font-label text-[10px] uppercase font-bold tracking-widest">Grasas</p>
            <p className="text-on-surface font-headline text-3xl font-extrabold">{formatNum(macros.fats)}g</p>
            <p className="text-[10px] text-on-surface-variant mt-1">Faltan: {formatNum(remaining.fats)}g</p>
          </div>
        </div>
        <div className="bg-surface-container-highest rounded-xl p-5 flex flex-col justify-between aspect-square border border-outline-variant/20">
          <Droplets className="text-secondary fill-secondary/20" size={32} />
          <div>
            <p className="text-on-surface-variant font-label text-[10px] uppercase font-bold tracking-widest">Agua</p>
            <p className="text-on-surface font-headline text-3xl font-extrabold">{formatNum(dailyLog?.waterIntake || 0)}<span className="text-lg text-on-surface-variant ml-1">ml</span></p>
          </div>
        </div>
      </section>

      {/* Meals List */}
      <section className="space-y-4">
        <h3 className="font-headline font-bold text-xl">Comidas de Hoy</h3>
        <MealList meals={dailyLog?.meals || []} onDeleteMeal={handleDeleteMeal} />
      </section>

      {/* Daily Goals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline font-bold text-xl">Objetivos del Día</h3>
          <span className="text-on-surface-variant text-xs">Personalizados</span>
        </div>
        <div className="space-y-3">
          {dynamicGoals.map((goal) => (
            <div key={goal.id} className="flex items-center gap-4 bg-surface-container p-4 rounded-xl group hover:bg-surface-container-high transition-all">
              <div className={`w-10 h-10 rounded-full border-2 border-${goal.color} flex items-center justify-center text-${goal.color}`}>
                {goal.icon}
              </div>
              <div className="flex-1">
                <p className="font-bold">{goal.title}</p>
                <p className="text-xs text-on-surface-variant">{goal.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
