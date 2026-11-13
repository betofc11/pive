import { Platform } from 'react-native';
import { auth } from '../firebase';

const getFunctionUrl = (name: string) => {
  return __DEV__
    ? Platform.select({
        android: `http://10.0.2.2:5001/purevibe-57dd3/us-central1/${name}`,
        default: `http://localhost:5001/purevibe-57dd3/us-central1/${name}`,
      })
    : `https://us-central1-purevibe-57dd3.cloudfunctions.net/${name}`;
};

// What to tell the user for each code the Cloud Functions send when Gemini refuses a request
const AI_ERROR_MESSAGES: Record<string, string> = {
  AI_CREDITS_DEPLETED: 'Se acabaron los créditos de IA. Vuelve a funcionar en cuanto se recarguen.',
  AI_RATE_LIMITED: 'La IA alcanzó su límite de uso. Intenta de nuevo en unos minutos.',
  AI_UNAVAILABLE: 'La IA está saturada. Intenta de nuevo en unos minutos.',
};

const parseErrorCode = (errorText: string): string | undefined => {
  try {
    const code = JSON.parse(errorText)?.code;
    return typeof code === 'string' ? code : undefined;
  } catch {
    return undefined;
  }
};

// The message for a failed AI call: the reason when the server gave a known one, the fallback otherwise
export const getAiErrorMessage = (error: unknown, fallback: string): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return (typeof code === 'string' && AI_ERROR_MESSAGES[code]) || fallback;
};

const callCloudFunction = async (name: string, payload: any) => {
  const url = getFunctionUrl(name);
  const user = auth.currentUser;
  const headers: any = {
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
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error calling Cloud Function ${name}:`, errorText);
    throw Object.assign(new Error(errorText || `HTTP error ${response.status}`), { code: parseErrorCode(errorText) });
  }

  return await response.json();
};

export const analyzeNutritionPlan = async (input: { base64Data?: string; mimeType?: string; text?: string }) => {
  return await callCloudFunction('analizarPlanNutricional', input);
};

export const analyzeFood = async (input: { base64Data?: string; mimeType?: string; text?: string }) => {
  return await callCloudFunction('analizarImagenComida', input);
};

export const calculateMacrosFromIngredients = async (ingredients: any[]) => {
  return await callCloudFunction('calcularMacrosIngredientes', { ingredients });
};

export const analyzeBodyComposition = async (input: { base64Data?: string; mimeType?: string; text?: string }) => {
  return await callCloudFunction('analizarComposicionCorporal', input);
};

export const analyzeWorkoutPlan = async (input: { files: { base64Data?: string; mimeType?: string; text?: string }[] }) => {
  return await callCloudFunction('analizarPlanEntrenamiento', input);
};

export const getPiveAdvice = async (
  dailyMacros: any,
  goals: any,
  bodyMetrics?: any,
  meals?: any[],
  currentTime?: string
) => {
  // Errors reach the caller: a fallback returned here would be saved as the day's advice
  const result = await callCloudFunction('obtenerConsejoPive', {
    dailyMacros,
    goals,
    bodyMetrics,
    // Only what the advice needs: meals carry a photo thumbnail that would bloat the Gemini prompt
    meals: meals?.map(({ name, time, macros }) => ({ name, time, macros })),
    currentTime
  });
  return result?.advice || '';
};
