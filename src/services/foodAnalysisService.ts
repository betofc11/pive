import { Platform } from 'react-native';

// URL de la función. En producción apunta a tu Cloud Function desplegada,
// y en desarrollo apunta al emulador local de Firebase.
const CLOUD_FUNCTION_URL = __DEV__
  ? Platform.select({
      // 10.0.2.2 es el alias para acceder al localhost de la máquina anfitriona desde el emulador de Android
      android: 'http://10.0.2.2:5001/purevibe-57dd3/us-central1/analizarComida',
      // localhost funciona en simuladores iOS y en navegadores Web
      default: 'http://localhost:5001/purevibe-57dd3/us-central1/analizarComida',
    })
  : 'https://us-central1-purevibe-57dd3.cloudfunctions.net/analizarComida';

export interface MacroResult {
  comida: string;
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
}

/**
 * Llama a la Cloud Function 'analizarComida' para procesar la descripción de texto de una comida
 * y obtener su estimación nutricional.
 * 
 * @param comidaTexto Descripción en texto de la comida (ej. "3 huevos fritos y un aguacate")
 * @returns Promesa con los macros resultantes
 */
export const analizarComidaAPI = async (comidaTexto: string): Promise<MacroResult> => {
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comidaTexto }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Límite de peticiones excedido en Gemini. Por favor espera un momento e intenta de nuevo.');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error del servidor (${response.status})`);
    }

    const data: MacroResult = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error llamando a la Cloud Function analizarComida:', error);
    throw error;
  }
};
