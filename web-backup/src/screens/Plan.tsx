import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Camera, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { analyzeNutritionPlan, calculateMacrosFromIngredients } from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatNum, getLocalDateString } from '../lib/utils';
import { DailyLog, Meal } from '../types';
import { SavedMealsSection } from '../components/SavedMealsSection';
import { FoodDialog } from '../components/FoodDialog';

import mammoth from 'mammoth';

export const Plan: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});
  const [loggingMeal, setLoggingMeal] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<any | null>(null);
  const [isFoodDialogOpen, setIsFoodDialogOpen] = useState(false);

  const handleRegisterMeal = async (categoryType: string, option: any) => {
    if (!user) return;
    const mealKey = `${categoryType}-${option.title}`;
    setLoggingMeal(mealKey);
    try {
      let macros = option.macros;
      if (!macros) {
        macros = await calculateMacrosFromIngredients(option.ingredients);
      }
      
      const newMeal: Meal = {
        id: Date.now().toString(),
        name: option.title,
        time: new Date().toISOString(),
        macros: {
          protein: macros?.protein || 0,
          carbs: macros?.carbs || 0,
          fats: macros?.fats || 0,
          calories: macros?.calories || 0
        }
      };

      const today = getLocalDateString();
      const logRef = doc(db, `users/${user.uid}/dailyLogs`, today);
      const logSnap = await getDoc(logRef);
      
      if (logSnap.exists()) {
        const currentLog = logSnap.data() as DailyLog;
        await updateDoc(logRef, {
          meals: [...currentLog.meals, newMeal],
          macros: {
            calories: currentLog.macros.calories + newMeal.macros.calories,
            protein: currentLog.macros.protein + newMeal.macros.protein,
            carbs: currentLog.macros.carbs + newMeal.macros.carbs,
            fats: currentLog.macros.fats + newMeal.macros.fats,
          }
        });
      } else {
        await setDoc(logRef, {
          id: today,
          userId: user.uid,
          date: new Date().toISOString(),
          macros: newMeal.macros,
          meals: [newMeal],
          waterIntake: 0
        });
      }
      
      // Show success feedback briefly
      setLoggingMeal(`${mealKey}-success`);
      setTimeout(() => setLoggingMeal(null), 2000);
    } catch (err: any) {
      console.error("Error registering meal:", err);
      setError("Hubo un error al registrar la comida. Por favor, intenta de nuevo.");
      setLoggingMeal(null);
      if (err?.message?.includes('Missing or insufficient permissions') || err?.message?.includes('permission-denied')) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/dailyLogs`);
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let analysisInput: { base64Data?: string; mimeType?: string; text?: string } = {};

      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        analysisInput.text = result.value;
      } else if (file.type === 'text/plain') {
        analysisInput.text = await file.text();
      } else if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        analysisInput.base64Data = await base64Promise;
        analysisInput.mimeType = file.type;
      } else {
        // For other types, try to read as text if it seems like a document
        // or just warn the user. many nutritionist reports are csv/xlsx but let's stick to text for now
        analysisInput.text = await file.text();
      }

      const analysis = await analyzeNutritionPlan(analysisInput);
      setResult(analysis);

      if (user) {
        // Save nutritional plan and goals to profile
        if (analysis.protein && analysis.carbs && analysis.fats) {
          await setDoc(doc(db, 'users', user.uid), {
            macroGoals: {
              protein: analysis.protein,
              carbs: analysis.carbs,
              fats: analysis.fats,
              calories: analysis.calories
            },
            nutritionalPlan: {
              name: analysis.name,
              calories: analysis.calories,
              protein: analysis.protein,
              carbs: analysis.carbs,
              fats: analysis.fats,
              advice: analysis.advice || '',
              meals: analysis.meals || [],
              extractedAt: Date.now()
            }
          }, { merge: true });
        }
      }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError('Error al analizar el archivo. Intenta de nuevo.');
      setLoading(false);
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': [],
      'application/pdf': [],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  } as any);

  const currentPlan = profile?.nutritionalPlan;
  const planData = result || currentPlan;

  return (
    <div className="space-y-8">
      <section className="flex justify-between items-end">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight leading-tight">
            Tu <span className="text-primary">Plan</span>
          </h1>
          <p className="text-on-surface-variant mt-2 font-medium">Nutrición impulsada por Pive AI.</p>
        </div>
        {planData && (
          <div {...getRootProps()} className="cursor-pointer">
            <input {...getInputProps()} />
            <button className="bg-surface-container-high hover:bg-primary/20 text-primary p-3 rounded-full transition-colors flex items-center justify-center">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
            </button>
          </div>
        )}
      </section>

      {!planData && (
        <section {...getRootProps()} className="relative group cursor-pointer">
          <input {...getInputProps()} />
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className={`relative bg-surface-container-low border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 transition-all ${isDragActive ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/50'}`}>
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary shadow-xl">
              {loading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
            </div>
            <div>
              <p className="font-headline text-lg font-bold">Sube tu Plan o Foto</p>
              <p className="text-on-surface-variant text-sm mt-1">Soporta PDF, Word, Excel, Texto o Fotos</p>
            </div>
            <button className="bg-primary text-on-primary font-bold px-8 py-3 rounded-full hover:shadow-[0_0_20px_rgba(166,140,255,0.4)] transition-all">
              Explorar Archivos
            </button>
          </div>
        </section>
      )}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-red-400 bg-red-400/10 p-4 rounded-xl">
          <AlertCircle size={20} />
          <span>{error}</span>
        </motion.div>
      )}

      {planData && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Plan Summary */}
          <div className="bg-surface-container p-4 rounded-xl border border-primary/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 size={20} />
                <h3 className="font-headline font-bold text-lg">
                  {result ? 'Análisis Completado' : 'Plan Actual'}
                </h3>
              </div>
              {!result && currentPlan && (
                <span className="text-[10px] text-on-surface-variant uppercase font-bold">
                  {new Date(currentPlan.extractedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="bg-surface-container-high p-3 rounded-lg flex items-center justify-between sm:flex-col sm:justify-center sm:w-1/3">
                <p className="text-[10px] text-on-surface-variant uppercase font-bold">Calorías</p>
                <p className="font-bold text-xl text-primary">{formatNum(planData.calories)}</p>
              </div>

              <div className="flex-1 grid grid-cols-3 gap-2">
                <div className="bg-tertiary/10 p-2 rounded-lg border-b-2 border-tertiary flex flex-col items-center justify-center">
                  <p className="text-[9px] text-tertiary uppercase font-bold">Prot</p>
                  <p className="font-bold text-sm">{formatNum(planData.protein)}g</p>
                </div>
                <div className="bg-secondary/10 p-2 rounded-lg border-b-2 border-secondary flex flex-col items-center justify-center">
                  <p className="text-[9px] text-secondary uppercase font-bold">Carb</p>
                  <p className="font-bold text-sm">{formatNum(planData.carbs)}g</p>
                </div>
                <div className="bg-primary/10 p-2 rounded-lg border-b-2 border-primary flex flex-col items-center justify-center">
                  <p className="text-[9px] text-primary uppercase font-bold">Grasa</p>
                  <p className="font-bold text-sm">{formatNum(planData.fats)}g</p>
                </div>
              </div>
            </div>

            {planData.advice && (
              <div className="bg-surface-container-low p-3 rounded-lg italic text-on-surface-variant text-xs">
                "{planData.advice}"
              </div>
            )}
          </div>

          {/* Structured Meals */}
          {planData.meals && planData.meals.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-headline font-bold text-xl">Opciones de Comidas</h3>
              {planData.meals.map((mealCategory: any, idx: number) => (
                <div key={idx} className="bg-surface-container rounded-[28px] overflow-hidden border border-outline-variant/10 shadow-sm">
                  <button 
                    onClick={() => setExpandedMeal(expandedMeal === mealCategory.type ? null : mealCategory.type)}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-surface-container-high transition-colors"
                  >
                    <span className="font-bold text-lg">{mealCategory.type}</span>
                    {expandedMeal === mealCategory.type ? <ChevronUp size={20} className="text-primary" /> : <ChevronDown size={20} className="text-on-surface-variant" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedMeal === mealCategory.type && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-2">
                          {mealCategory.options.map((option: any, optIdx: number) => {
                            const optionKey = `${mealCategory.type}-${optIdx}`;
                            const isOptExpanded = expandedOptions[optionKey];
                            const isLogging = loggingMeal === `${mealCategory.type}-${option.title}`;
                            const isSuccess = loggingMeal === `${mealCategory.type}-${option.title}-success`;
                            
                            return (
                              <div key={optIdx} className="bg-surface-container-high rounded-[24px] overflow-hidden border border-outline-variant/5 transition-all">
                                <div className="p-2 flex items-center justify-between gap-2">
                                  <button 
                                    onClick={() => setExpandedOptions(prev => ({...prev, [optionKey]: !prev[optionKey]}))}
                                    className="flex-1 flex items-center gap-3 text-left p-2 rounded-full hover:bg-surface-container-highest transition-colors"
                                  >
                                    <span className="bg-primary/20 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{optIdx + 1}</span>
                                    <span className="font-bold text-sm">{option.title}</span>
                                    {isOptExpanded ? <ChevronUp size={16} className="text-on-surface-variant flex-shrink-0 ml-auto" /> : <ChevronDown size={16} className="text-on-surface-variant flex-shrink-0 ml-auto" />}
                                  </button>
                                  <button 
                                    onClick={() => handleRegisterMeal(mealCategory.type, option)}
                                    disabled={isLogging || isSuccess}
                                    className={`flex items-center gap-1 px-4 py-2.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 flex-shrink-0 mr-1 ${
                                      isSuccess ? 'bg-green-500/20 text-green-500' : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                    }`}
                                  >
                                    {isLogging ? <Loader2 size={14} className="animate-spin" /> : isSuccess ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                                    <span className="hidden sm:inline">{isLogging ? 'Registrando...' : isSuccess ? 'Registrado' : 'Registrar'}</span>
                                  </button>
                                </div>
                                
                                <AnimatePresence>
                                  {isOptExpanded && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-4 pb-4 pt-1">
                                        <div className="bg-surface-container-highest/30 rounded-2xl p-4">
                                          <ul className="space-y-3">
                                            {option.ingredients.map((ing: any, ingIdx: number) => (
                                              <li key={ingIdx} className="flex justify-between text-sm items-center">
                                                <span className="text-on-surface-variant">{ing.name}</span>
                                                <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg text-xs">{ing.quantity} {ing.unit}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <SavedMealsSection 
        onRegister={(option) => handleRegisterMeal('Comida Guardada', option)} 
        onEdit={(meal) => {
          setEditingMeal(meal);
          setIsFoodDialogOpen(true);
        }}
      />

      <FoodDialog 
        isOpen={isFoodDialogOpen} 
        onClose={() => {
          setIsFoodDialogOpen(false);
          setEditingMeal(null);
        }}
        initialData={editingMeal}
      />

      {!planData && (
        <section className="space-y-4">
          <h3 className="font-headline font-bold text-xl">Instrucciones</h3>
          <ul className="space-y-3 text-on-surface-variant text-sm">
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</div>
              <p>Sube un PDF de tu plan nutricional.</p>
            </li>
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</div>
              <p>Pive AI analizará los ingredientes, extraerá los macronutrientes y agrupará tus comidas (funciona con PDF, Word, texto o fotos).</p>
            </li>
            <li className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</div>
              <p>Tus objetivos y opciones de comida se actualizarán automáticamente.</p>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
};
