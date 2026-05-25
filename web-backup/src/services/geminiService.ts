import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeNutritionPlan = async (input: { base64Data?: string; mimeType?: string; text?: string }) => {
  const prompt = `
    Analiza este plan nutricional (ya sea una imagen, un PDF o texto extraído). 
    Extrae los macronutrientes (proteínas, carbohidratos, grasas) y las calorías totales.
    Si es un plan nutricional, extrae los objetivos diarios y agrupa las comidas por tipo (ej. Desayuno, Almuerzo, Cena, Snack).
    Para cada tipo de comida, extrae las diferentes opciones disponibles.
    Para cada opción, dale un título descriptivo, lista los ingredientes con sus cantidades y unidades, y calcula sus macronutrientes (calorías, proteínas, carbohidratos, grasas).
    Responde en formato JSON.
  `;

  const parts: any[] = [{ text: prompt }];
  
  if (input.text) {
    parts.push({ text: `Texto del plan: ${input.text}` });
  } else if (input.base64Data && input.mimeType) {
    parts.push({ inlineData: { data: input.base64Data, mimeType: input.mimeType } });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
          advice: { type: Type.STRING },
          meals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "Ej. Desayuno, Almuerzo, Cena" },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "Título de la opción, ej. Avena con frutas" },
                      macros: {
                        type: Type.OBJECT,
                        properties: {
                          calories: { type: Type.NUMBER },
                          protein: { type: Type.NUMBER },
                          carbs: { type: Type.NUMBER },
                          fats: { type: Type.NUMBER }
                        },
                        required: ["calories", "protein", "carbs", "fats"]
                      },
                      ingredients: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            quantity: { type: Type.NUMBER },
                            unit: { type: Type.STRING }
                          },
                          required: ["name", "quantity", "unit"]
                        }
                      }
                    },
                    required: ["title", "ingredients"]
                  }
                }
              },
              required: ["type", "options"]
            }
          }
        },
        required: ["name", "calories", "protein", "carbs", "fats"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const analyzeFoodImage = async (base64Data: string, mimeType: string) => {
  const prompt = `
    Analiza esta imagen de comida. Identifica el plato, los ingredientes visibles con una cantidad aproximada, y calcula los macronutrientes totales (calorías, proteínas, carbohidratos, grasas).
    Responde en formato JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          macros: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fats: { type: Type.NUMBER }
            },
            required: ["calories", "protein", "carbs", "fats"]
          },
          ingredients: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit: { type: Type.STRING }
              },
              required: ["name", "quantity", "unit"]
            } 
          }
        },
        required: ["name", "ingredients", "macros"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const calculateMacrosFromIngredients = async (ingredients: any[]) => {
  const prompt = `
    Calcula los macronutrientes totales y calorías para la siguiente lista de ingredientes:
    ${JSON.stringify(ingredients)}
    Responde en formato JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER }
        },
        required: ["calories", "protein", "carbs", "fats"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const analyzeBodyComposition = async (input: { base64Data?: string; mimeType?: string; text?: string }) => {
  const prompt = `
    Analiza este documento, imagen o texto de composición corporal.
    Extrae el peso, porcentaje de grasa corporal y masa muscular.
    Responde en formato JSON.
  `;

  const parts: any[] = [{ text: prompt }];

  if (input.text) {
    parts.push({ text: `Texto del reporte: ${input.text}` });
  } else if (input.base64Data && input.mimeType) {
    parts.push({ inlineData: { data: input.base64Data, mimeType: input.mimeType } });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          weight: { type: Type.NUMBER },
          bodyFat: { type: Type.NUMBER },
          muscleMass: { type: Type.NUMBER }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const getPiveAdvice = async (dailyMacros: any, goals: any, bodyMetrics?: any) => {
  const remaining = {
    protein: Math.max(0, goals.protein - dailyMacros.protein),
    carbs: Math.max(0, goals.carbs - dailyMacros.carbs),
    fats: Math.max(0, goals.fats - dailyMacros.fats),
    calories: Math.max(0, goals.calories - dailyMacros.calories)
  };

  const prompt = `
    Basado en los macros de hoy: ${JSON.stringify(dailyMacros)}
    Objetivos diarios: ${JSON.stringify(goals)}
    Macros restantes: ${JSON.stringify(remaining)}
    Métricas corporales: ${JSON.stringify(bodyMetrics || 'No disponibles')}
    
    Proporciona un consejo corto (máximo 2 frases) y motivador al estilo "Pive" (fresco, directo, energético, un poco rebelde pero enfocado).
    Dile exactamente qué le falta consumir para llegar a su meta de hoy de forma natural.
    IMPORTANTE: No menciones nunca métricas de composición corporal como porcentaje de grasa, masa muscular o peso en el consejo. Enfócate únicamente en la nutrición y la energía.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
};
