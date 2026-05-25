import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, Loader2, Plus, Trash2, Bookmark, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { analyzeFoodImage, calculateMacrosFromIngredients } from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query } from 'firebase/firestore';
import { formatNum, getLocalDateString } from '../lib/utils';

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export const FoodDialog: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  initialData?: any;
}> = ({ isOpen, onClose, initialData }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'edit' | 'saving'>('upload');
  
  const [foodName, setFoodName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [macros, setMacros] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [savedMeals, setSavedMeals] = useState<any[]>([]);
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      if (initialData) {
        setFoodName(initialData.name || '');
        setIngredients(initialData.ingredients || []);
        setMacros(initialData.macros || null);
        setStep('edit');
        setPreview(initialData.imageUrl || null);
        setSaveAsFavorite(true);
      } else {
        setStep('upload');
        setFoodName('');
        setIngredients([]);
        setMacros(null);
        setPreview(null);
        setFile(null);
      }

      const fetchSavedMeals = async () => {
        try {
          const q = query(collection(db, `users/${user.uid}/savedMeals`));
          const snap = await getDocs(q);
          setSavedMeals(snap.docs.map(d => d.data()));
        } catch (err) {
          console.error("Error fetching saved meals", err);
        }
      };
      fetchSavedMeals();
    }
  }, [user, isOpen]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    multiple: false,
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined
  } as any);

  const handleAnalyze = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const base64Data = preview.split(',')[1];
      const mimeType = file?.type || 'image/jpeg';
      const result = await analyzeFoodImage(base64Data, mimeType);
      
      setFoodName(result.name || 'Comida Desconocida');
      setIngredients(result.ingredients || []);
      setMacros(result.macros || null);
      setStep('edit');
    } catch (err) {
      console.error("Error analyzing food:", err);
      setError("Error al analizar la imagen. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setFoodName('');
    setIngredients([]);
    setMacros(null);
    setError(null);
    setStep('edit');
  };

  const handleSelectSavedMeal = (meal: any) => {
    setFoodName(meal.name);
    setIngredients(meal.ingredients || []);
    setMacros(meal.macros || null);
    setError(null);
    setStep('edit');
  };

  const handleSave = async () => {
    if (!user) return;
    setStep('saving');
    setError(null);
    try {
      // 1. Calculate macros from ingredients if not already present or if ingredients were manually edited
      // For simplicity, if they edit ingredients, we should ideally recalculate, but let's just recalculate if macros is null
      let finalMacros = macros;
      if (!finalMacros) {
        finalMacros = await calculateMacrosFromIngredients(ingredients);
      }
      
      // 2. Save to savedMeals if requested
      if (saveAsFavorite && foodName.trim()) {
        const mealId = initialData?.id || Date.now().toString();
        await setDoc(doc(db, `users/${user.uid}/savedMeals`, mealId), {
          id: mealId,
          userId: user.uid,
          name: foodName.trim(),
          ingredients: ingredients,
          macros: finalMacros
        });
      }

      // 3. Save to dailyLogs
      const today = getLocalDateString();
      const logId = today; 
      const logRef = doc(db, `users/${user.uid}/dailyLogs`, logId);
      
      const logDoc = await getDoc(logRef);
      
      const newMeal = {
        id: Date.now().toString(),
        name: foodName || 'Comida',
        time: new Date().toISOString(),
        macros: finalMacros,
        imageUrl: preview 
      };

      if (logDoc.exists()) {
        const currentData = logDoc.data();
        const currentMacros = currentData.macros || { protein: 0, carbs: 0, fats: 0, calories: 0 };
        
        await updateDoc(logRef, {
          macros: {
            protein: currentMacros.protein + (finalMacros.protein || 0),
            carbs: currentMacros.carbs + (finalMacros.carbs || 0),
            fats: currentMacros.fats + (finalMacros.fats || 0),
            calories: currentMacros.calories + (finalMacros.calories || 0)
          },
          meals: [...(currentData.meals || []), newMeal]
        });
      } else {
        await setDoc(logRef, {
          id: logId,
          userId: user.uid,
          date: new Date().toISOString(),
          macros: finalMacros,
          meals: [newMeal],
          waterIntake: 0
        });
      }

      onClose();
      // Reset state
      setFile(null);
      setPreview(null);
      setStep('upload');
      setIngredients([]);
      setMacros(null);
      setSaveAsFavorite(false);
      setError(null);
    } catch (err: any) {
      console.error("Error saving meal:", err);
      setError("Hubo un error al registrar la comida. Por favor, intenta de nuevo.");
      setStep('edit');
      if (err?.message?.includes('Missing or insufficient permissions') || err?.message?.includes('permission-denied')) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/dailyLogs`);
      }
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
    setMacros(null); // Force recalculation if ingredients change
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: 0, unit: 'g' }]);
    setMacros(null); // Force recalculation
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
    setMacros(null); // Force recalculation
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Comida">
      {step === 'upload' && (
        <div className="space-y-6">
          {savedMeals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-on-surface-variant mb-3 flex items-center gap-1">
                <Bookmark size={16} className="text-primary" /> Comidas Guardadas
              </h3>
              <div className="flex overflow-x-auto gap-3 pb-2 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {savedMeals.map(meal => (
                  <button
                    key={meal.id}
                    onClick={() => handleSelectSavedMeal(meal)}
                    className="snap-start shrink-0 bg-surface-container-high border border-outline-variant/20 rounded-xl p-3 w-36 text-left hover:bg-surface-container-highest transition-colors"
                  >
                    <p className="font-bold text-sm truncate">{meal.name}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{formatNum(meal.macros?.calories || 0)} kcal</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <div className="space-y-4">
                <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-cover" />
                <p className="text-sm text-primary font-medium">Toca para cambiar la imagen</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto text-primary">
                  <Camera size={32} />
                </div>
                <div>
                  <p className="font-medium">Toma una foto o sube una imagen</p>
                  <p className="text-sm text-on-surface-variant mt-1">Formatos soportados: JPG, PNG</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleManualEntry}
              className="flex-1 bg-surface-container-high text-on-surface py-4 rounded-xl font-bold hover:bg-surface-container-highest transition-colors"
            >
              Entrada Manual
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!preview || loading}
              className="flex-1 bg-primary text-on-primary py-4 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Analizar IA'}
            </button>
          </div>
        </div>
      )}

      {step === 'edit' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <button 
              onClick={() => setStep('upload')} 
              className="text-primary flex items-center gap-1 text-sm font-bold hover:text-primary/80 transition-colors"
            >
              ← Volver
            </button>
          </div>

          {error && (
            <div className="bg-error/10 text-error p-3 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Nombre del Plato</label>
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
              placeholder="Ej. Ensalada César"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-on-surface-variant">Ingredientes</label>
              <button onClick={addIngredient} className="text-primary text-sm font-bold flex items-center gap-1">
                <Plus size={16} /> Añadir
              </button>
            </div>
            
            <div className="space-y-3">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-surface-container-high p-2 rounded-xl">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                    placeholder="Ingrediente"
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2"
                  />
                  <input
                    type="number"
                    value={ing.quantity || ''}
                    onChange={(e) => updateIngredient(idx, 'quantity', parseFloat(e.target.value))}
                    placeholder="Cant."
                    className="w-16 bg-surface-container border border-outline-variant/20 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                    placeholder="Unidad"
                    className="w-16 bg-surface-container border border-outline-variant/20 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                  />
                  <button onClick={() => removeIngredient(idx)} className="text-error p-1 hover:bg-error/10 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {ingredients.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-4">Añade ingredientes para calcular los macros.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-surface-container-high p-4 rounded-xl border border-outline-variant/10">
            <input
              type="checkbox"
              id="saveFavorite"
              checked={saveAsFavorite}
              onChange={(e) => setSaveAsFavorite(e.target.checked)}
              className="w-5 h-5 rounded border-outline-variant/20 text-primary focus:ring-primary bg-surface-container"
            />
            <label htmlFor="saveFavorite" className="text-sm font-medium text-on-surface">
              Guardar en comidas frecuentes
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={ingredients.length === 0 || !foodName}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Calcular Macros y Guardar
          </button>
        </div>
      )}

      {step === 'saving' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={48} className="text-primary animate-spin" />
          <p className="text-lg font-medium">Calculando macros y guardando...</p>
        </div>
      )}
    </Modal>
  );
};
