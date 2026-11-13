import { Platform } from 'react-native';
import { auth } from '../firebase';
import { getLocalDateString, getLocalTimeString } from '../lib/utils';
import type { Macros, Meal } from '../types';
import type {
  AdviceRequest,
  BodyCompositionAnalysis,
  FoodAnalysis,
  IngredientsMacros,
  NutritionPlanAnalysis,
  WorkoutPlanAnalysis,
} from '../../functions/src/shared/api';
import type { IngredientWithMacros } from '../../functions/src/shared/ingredients';

type FileInput = { base64Data?: string; mimeType?: string; text?: string };

const getFunctionUrl = (name: string) => {
  return __DEV__
    ? Platform.select({
        android: `http://10.0.2.2:5001/purevibe-57dd3/us-central1/${name}`,
        default: `http://localhost:5001/purevibe-57dd3/us-central1/${name}`,
      })
    : `https://us-central1-purevibe-57dd3.cloudfunctions.net/${name}`;
};

const callCloudFunction = async <T>(name: string, payload: object): Promise<T> => {
  const url = getFunctionUrl(name);
  const user = auth.currentUser;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (user) {
    try {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.warn(`[Auth] Could not get user ID token for function ${name}:`, err);
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    // Every call carries the user's local date: the server dates the usage log with it
    body: JSON.stringify({ localDate: getLocalDateString(), ...payload }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error calling Cloud Function ${name}:`, errorText);
    throw new Error(errorText || `HTTP error ${response.status}`);
  }

  return await response.json();
};

export const analyzeNutritionPlan = async (input: FileInput) => {
  return await callCloudFunction<NutritionPlanAnalysis>('analizarPlanNutricional', input);
};

export const analyzeFood = async (input: FileInput) => {
  return await callCloudFunction<FoodAnalysis>('analizarImagenComida', input);
};

/** Totals at the top level plus macros per ingredient. Ingredients that already have macros don't go to the AI. */
export const calculateMacrosFromIngredients = async (ingredients: IngredientWithMacros[]) => {
  return await callCloudFunction<IngredientsMacros>('calcularMacrosIngredientes', { ingredients });
};

export const analyzeBodyComposition = async (input: FileInput) => {
  return await callCloudFunction<BodyCompositionAnalysis>('analizarComposicionCorporal', input);
};

export const analyzeWorkoutPlan = async (input: { files: FileInput[] }) => {
  return await callCloudFunction<WorkoutPlanAnalysis>('analizarPlanEntrenamiento', input);
};

export const getPiveAdvice = async (dailyMacros: Macros, goals: Macros, meals: Meal[] = [], currentTime = '') => {
  try {
    const payload: AdviceRequest = {
      dailyMacros,
      goals,
      // Only what the advice needs: meals carry a photo thumbnail that would bloat the Gemini prompt.
      // The time goes as local HH:mm, the same clock as currentTime.
      meals: meals.map(({ name, time, macros }) => ({ name, time: getLocalTimeString(time), macros })),
      currentTime,
      localDate: getLocalDateString(),
    };
    const result = await callCloudFunction<{ advice?: string }>('obtenerConsejoPive', payload);
    return result?.advice || '';
  } catch (error) {
    console.error('Error fetching Pive advice:', error);
    return '¡Buen trabajo con tus registros de hoy! Mantén la consistencia y enfócate en tus metas diarias.';
  }
};
