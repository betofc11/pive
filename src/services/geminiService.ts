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
    throw new Error(errorText || `HTTP error ${response.status}`);
  }

  return await response.json();
};

export const analyzeNutritionPlan = async (input: { base64Data?: string; mimeType?: string; text?: string }) => {
  return await callCloudFunction('analizarPlanNutricional', input);
};

export const analyzeFoodImage = async (base64Data: string, mimeType: string) => {
  return await callCloudFunction('analizarImagenComida', { base64Data, mimeType });
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
  try {
    const result = await callCloudFunction('obtenerConsejoPive', {
      dailyMacros,
      goals,
      bodyMetrics,
      meals,
      currentTime
    });
    return result?.advice || '';
  } catch (error) {
    console.error('Error fetching Pive advice:', error);
    return '¡Buen trabajo con tus registros de hoy! Mantén la consistencia y enfócate en tus metas diarias.';
  }
};
