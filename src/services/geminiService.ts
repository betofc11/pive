import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to determine the model to use
const MODEL_NAME = "gemini-3.1-flash-lite-preview";

export const analyzeNutritionPlan = async (input: { base64Data?: string; mimeType?: string; text?: string }) => {
  if (!ai || !apiKey) {
    return {
      name: "Plan Nutricional de Prueba (IA Desactivada)",
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
      advice: "Para activar el análisis inteligente de tu plan por IA, por favor añade tu GEMINI_API_KEY en tu archivo .env.",
      meals: [
        {
          type: "Desayuno",
          options: [
            {
              title: "Avena con Plátano (Ejemplo)",
              macros: { calories: 380, protein: 12, carbs: 65, fats: 7 },
              ingredients: [
                { name: "Avena en hojuelas", quantity: 60, unit: "g" },
                { name: "Leche descremada", quantity: 200, unit: "ml" },
                { name: "Plátano", quantity: 1, unit: "pza" }
              ]
            }
          ]
        },
        {
          type: "Almuerzo",
          options: [
            {
              title: "Pollo con Arroz y Brócoli (Ejemplo)",
              macros: { calories: 520, protein: 42, carbs: 55, fats: 12 },
              ingredients: [
                { name: "Pechuga de pollo", quantity: 150, unit: "g" },
                { name: "Arroz cocido", quantity: 150, unit: "g" },
                { name: "Brócoli al vapor", quantity: 100, unit: "g" }
              ]
            }
          ]
        }
      ]
    };
  }

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
    model: MODEL_NAME,
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
  if (!ai || !apiKey) {
    return {
      name: "Plato Escaneado (IA Desactivada)",
      macros: { calories: 450, protein: 30, carbs: 45, fats: 15 },
      ingredients: [
        { name: "Ingrediente Estimado 1", quantity: 150, unit: "g" },
        { name: "Ingrediente Estimado 2", quantity: 100, unit: "g" }
      ]
    };
  }

  const prompt = `
    Analiza esta imagen de comida. Identifica el plato, los ingredientes visibles con una cantidad aproximada, y calcula los macronutrientes totales (calorías, proteínas, carbohidratos, grasas).
    Responde en formato JSON.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
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
  if (!ai || !apiKey) {
    // Generate a simple mock calculation based on ingredient names/weights to allow testing
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;
    
    ingredients.forEach(ing => {
      const q = Number(ing.quantity) || 100;
      const name = (ing.name || '').toLowerCase();
      
      if (name.includes('pollo') || name.includes('carne') || name.includes('pescado') || name.includes('pavo') || name.includes('huevo')) {
        protein += Math.round(q * 0.22);
        fats += Math.round(q * 0.05);
        calories += Math.round(q * 1.5);
      } else if (name.includes('arroz') || name.includes('avena') || name.includes('pan') || name.includes('pasta') || name.includes('papa')) {
        carbs += Math.round(q * 0.25);
        protein += Math.round(q * 0.03);
        calories += Math.round(q * 1.2);
      } else if (name.includes('aceite') || name.includes('aguacate') || name.includes('nuez') || name.includes('almendra')) {
        fats += Math.round(q * 0.15);
        calories += Math.round(q * 1.8);
      } else {
        carbs += Math.round(q * 0.08);
        protein += Math.round(q * 0.02);
        calories += Math.round(q * 0.5);
      }
    });

    return { calories, protein, carbs, fats };
  }

  const prompt = `
    Calcula los macronutrientes totales y calorías para la siguiente lista de ingredientes:
    ${JSON.stringify(ingredients)}
    Responde en formato JSON.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
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
  if (!ai || !apiKey) {
    return {
      weight: 75.0,
      bodyFat: 15.0,
      muscleMass: 35.0
    };
  }

  const prompt = `
    Analiza este documento, imagen o texto de composición corporal.
    Extrae el peso, porcentaje de grasa corporal y masa muscular.

    REGLAS ESTRICTAS DE EXTRACCIÓN:
    1. El peso (weight) debe extraerse en kilogramos (kg). Si está en libras, conviértelo a kg (divide entre 2.20462).
    2. El porcentaje de grasa corporal (bodyFat) debe ser un número entre 0 y 100 (ej. 15.4 para 15.4%).
    3. La masa muscular (muscleMass) DEBE SER EXTRAÍDA Y DEVUELTA ESTRICTAMENTE EN KILOGRAMOS (kg).
       - Si el reporte muestra la masa muscular directamente en kg (ej. "Masa músculo-esquelética: 35.2 kg" o "Masa muscular: 35.2 kg"), devuélvela tal cual.
       - Si el reporte muestra la masa muscular únicamente como un porcentaje (ej. "Masa muscular: 45%"), calcula los kilogramos absolutos multiplicando el peso total (weight) por el porcentaje dividido entre 100 (ej. peso * 0.45).
       - NUNCA devuelvas un valor de porcentaje de masa muscular en el campo "muscleMass". Siempre debe representar kilogramos (kg). Por ejemplo, si el peso es 70 kg y el porcentaje de músculo es 40%, el valor de "muscleMass" debe ser 28.0 (y no 40.0).

    Responde únicamente con el formato JSON.
  `;

  const parts: any[] = [{ text: prompt }];

  if (input.text) {
    parts.push({ text: `Texto del reporte: ${input.text}` });
  } else if (input.base64Data && input.mimeType) {
    parts.push({ inlineData: { data: input.base64Data, mimeType: input.mimeType } });
  }

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
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

export const analyzeWorkoutPlan = async (input: { files: { base64Data?: string; mimeType?: string; text?: string }[] }) => {
  if (!ai || !apiKey) {
    return {
      name: "Rutina de Ejemplo (IA Desactivada)",
      days: [
        {
          name: "Día 1: Push (Pecho/Hombro/Tríceps)",
          exercises: [
            {
              name: "Press de Banca Plano",
              sets: "4",
              reps: "8-10",
              description: "Acostado en banco plano, bajar la barra al pecho controladamente y empujar hacia arriba.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+press+de+banca+plano",
              muscleGroups: ["Pecho", "Brazos", "Hombros"]
            },
            {
              name: "Press Militar con Mancuernas",
              sets: "3",
              reps: "10-12",
              description: "Sentado, empujar mancuernas verticalmente sobre la cabeza extendiendo brazos.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+press+militar+con+mancuernas",
              muscleGroups: ["Hombros", "Brazos"]
            },
            {
              name: "Copas de Tríceps tras Nuca",
              sets: "3",
              reps: "12-15",
              description: "Sostener una mancuerna con ambas manos tras la nuca y extender los brazos verticalmente.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+copa+de+triceps",
              muscleGroups: ["Brazos"]
            }
          ]
        },
        {
          name: "Día 2: Pull (Espalda/Bíceps)",
          exercises: [
            {
              name: "Dominadas",
              sets: "4",
              reps: "Fallo (o 6-8)",
              description: "Colgado de barra fija, elevar el torso contrayendo la espalda hasta pasar la barbilla por encima.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+dominadas",
              muscleGroups: ["Espalda", "Brazos", "Core"]
            },
            {
              name: "Remo con Barra",
              sets: "4",
              reps: "10",
              description: "Inclinado hacia adelante, jalar la barra hacia el abdomen contrayendo dorsales.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+remo+con+barra",
              muscleGroups: ["Espalda", "Brazos"]
            },
            {
              name: "Curl de Bíceps con Barra",
              sets: "3",
              reps: "12",
              description: "De pie, flexionar codos llevando la barra al pecho manteniendo los hombros fijos.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+curl+de+biceps+con+barra",
              muscleGroups: ["Brazos"]
            }
          ]
        },
        {
          name: "Día 3: Piernas (Cuádriceps/Isquios/Pantorrillas)",
          exercises: [
            {
              name: "Sentadilla Libre con Barra",
              sets: "4",
              reps: "8-10",
              description: "Colocar barra en trapecios, descender flexionando cadera y rodillas manteniendo espalda recta.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+sentadilla+libre",
              muscleGroups: ["Piernas", "Core"]
            },
            {
              name: "Prensa de Piernas",
              sets: "3",
              reps: "12",
              description: "Empujar la plataforma inclinada de la prensa desbloqueando rodillas sin extenderlas totalmente.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+prensa+de+piernas",
              muscleGroups: ["Piernas"]
            },
            {
              name: "Elevación de Talones de Pie",
              sets: "4",
              reps: "15",
              description: "De pie, elevar talones sobre un escalón contrayendo pantorrillas al máximo.",
              youtubeUrl: "https://www.youtube.com/results?search_query=como+hacer+elevacion+de+pantorrillas+de+pie",
              muscleGroups: ["Piernas"]
            }
          ]
        }
      ]
    };
  }

  const prompt = `
    Analiza esta rutina de entrenamiento (que puede ser una o varias fotos, capturas de pantalla, archivos de texto o PDFs).
    Extrae la rutina dividida en días de entrenamiento de forma estructurada.
    Si algún día no tiene un nombre claro, genera un nombre descriptivo en español (ej: "Día 1: Push", "Día 2: Pull", "Día 3: Piernas").
    Para cada ejercicio, extrae el nombre del ejercicio, número de series (sets), repeticiones (reps), una breve descripción de la técnica o forma en español (máximo 1 frase), y un arreglo de categorías de grupos musculares a los que pertenece (debe ser una o más de: Pecho, Espalda, Piernas, Hombros, Brazos, Core).
    Genera un URL de búsqueda en YouTube para cada ejercicio del tipo: "https://www.youtube.com/results?search_query=como+hacer+[nombre+ejercicio]".
    Responde en formato JSON.
  `;

  const parts: any[] = [{ text: prompt }];

  input.files.forEach(file => {
    if (file.text) {
      parts.push({ text: `Texto de la rutina: ${file.text}` });
    } else if (file.base64Data && file.mimeType) {
      parts.push({ inlineData: { data: file.base64Data, mimeType: file.mimeType } });
    }
  });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Ej. Día 1: Push" },
                exercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Nombre del ejercicio" },
                      sets: { type: Type.STRING, description: "Series" },
                      reps: { type: Type.STRING, description: "Repeticiones" },
                      description: { type: Type.STRING, description: "Breve descripción de técnica" },
                      youtubeUrl: { type: Type.STRING, description: "URL de búsqueda en YouTube" },
                      muscleGroups: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Categorías de grupos musculares asociados. Deben ser uno o más de: Pecho, Espalda, Piernas, Hombros, Brazos, Core."
                      }
                    },
                    required: ["name", "sets", "reps", "description", "youtubeUrl", "muscleGroups"]
                  }
                }
              },
              required: ["name", "exercises"]
            }
          }
        },
        required: ["name", "days"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const getPiveAdvice = async (
  dailyMacros: any,
  goals: any,
  bodyMetrics?: any,
  meals?: any[],
  currentTime?: string
) => {
  if (!ai || !apiKey) {
    return "¡Buen trabajo con tus registros de hoy! Mantén la consistencia y enfócate en tus metas diarias. (Para consejos personalizados de la IA de Gemini, añade tu GEMINI_API_KEY en tu archivo .env)";
  }

  const remaining = {
    protein: Math.max(0, goals.protein - dailyMacros.protein),
    carbs: Math.max(0, goals.carbs - dailyMacros.carbs),
    fats: Math.max(0, goals.fats - dailyMacros.fats),
    calories: Math.max(0, goals.calories - dailyMacros.calories)
  };

  const now = new Date();
  const getFormattedTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} (${displayHours}:${minutes} ${ampm})`;
  };
  const localTime = currentTime || getFormattedTime(now);

  const systemInstruction = `
Eres Pive, un coach de salud y nutrición virtual. Tienes un estilo fresco, directo, energético, un poco rebelde pero muy enfocado y motivador. Hablas de tú en español latinoamericano.

Tu tarea es dar un consejo nutricional diario sumamente corto (máximo 2 frases).

REGLAS DE ORO:
1. Sé extremadamente breve: Máximo 2 frases.
2. Analiza detenidamente la HORA ACTUAL del día y las COMIDAS REGISTRADAS hoy para deducir el contexto del usuario (si ya desayunó, si le toca el almuerzo, la merienda o la cena).
3. Adapta tu recomendación de manera realista:
   - Si es tarde/noche (ej. después de las 19:00 o 20:00) y le faltan muchos macros/calorías, recomiéndale la mejor y más saludable cena o snack nocturno para cerrar el día de forma práctica (priorizando proteína, sin forzar a comer en exceso si es muy tarde).
   - Si es temprano o medio día (ej. mañana o medio día), recomiéndale qué priorizar en su próximo desayuno o almuerzo para mantenerse en el camino correcto.
4. Indica qué alimentos naturales específicos (ej. pechuga de pollo, huevos, avena, aguacate) le ayudarán a completar los macros que le faltan hoy.
5. PROHIBIDO: No menciones NUNCA métricas corporales como porcentaje de grasa, masa muscular o peso en tu consejo. Enfócate únicamente en nutrición, alimentos y energía.
  `;

  const prompt = `
Hora actual del usuario: ${localTime}
Metas diarias del usuario: ${JSON.stringify(goals)}
Macros ya consumidos hoy: ${JSON.stringify(dailyMacros)}
Macros restantes por consumir: ${JSON.stringify(remaining)}
Comidas registradas hoy por el usuario: ${JSON.stringify(meals || [])}
Métricas corporales de fondo: ${JSON.stringify(bodyMetrics || 'No disponibles')}
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
    }
  });

  return response.text;
};
