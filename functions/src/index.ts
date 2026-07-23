import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";

admin.initializeApp();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const FLASH_MODEL = "gemini-2.5-flash";
const PRO_MODEL = "gemini-2.5-pro";

// Helper to verify Firebase ID Token in requests
const verifyAuthToken = async (req: any, res: any): Promise<string | null> => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.status(204).send("");
    return null;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed. Use POST." });
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing authorization header" });
    return null;
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
    return null;
  }
};

const getApiKey = (): string | null => {
  return process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
};

// 1. Existing function (Preserved)
export const analizarComida = onRequest(
  {
    cors: true,
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req: any, res: any) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "POST");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed. Use POST." });
        return;
      }

      const { comidaTexto } = req.body;
      if (!comidaTexto || typeof comidaTexto !== "string") {
        res.status(400).json({ error: "Missing or invalid parameter: comidaTexto" });
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        Analiza el siguiente texto que describe una comida y estima sus ingredientes: "${comidaTexto}".
        Calcula los macronutrientes totales (calorías, proteínas, carbohidratos, grasas).
        Responde exclusivamente con un objeto JSON plano que contenga los campos:
        - comida (string): Un nombre resumido de la comida analizada. ¡DEBE ESTAR EN ESPAÑOL! (ej. "Huevos con aguacate" en vez de "Eggs with avocado").
        - calorias (number): Las calorías totales calculadas.
        - proteinas (number): Los gramos de proteína calculados.
        - carbohidratos (number): Los gramos de carbohidratos calculados.
        - grasas (number): Los gramos de grasa calculados.

        No agregues bloques de código markdown del tipo \`\`\`json ni texto introductorio o conclusivo.
      `;

      let response;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  comida: { type: Type.STRING },
                  calorias: { type: Type.INTEGER },
                  proteinas: { type: Type.INTEGER },
                  carbohidratos: { type: Type.INTEGER },
                  grasas: { type: Type.INTEGER },
                },
                required: ["comida", "calorias", "proteinas", "carbohidratos", "grasas"],
              },
            },
          });
          break;
        } catch (error: any) {
          attempts++;
          const errorMsg = error?.message || "";
          const isRateLimit =
            error?.status === 429 ||
            error?.statusCode === 429 ||
            errorMsg.includes("429") ||
            errorMsg.includes("RESOURCE_EXHAUSTED");

          if (isRateLimit && attempts < maxAttempts) {
            const backoffMs = attempts * 1000;
            console.warn(`Intento ${attempts} fallido por Rate Limit (429). Reintentando en ${backoffMs}ms...`);
            await sleep(backoffMs);
          } else {
            throw error;
          }
        }
      }

      const responseText = response?.text?.trim() || "{}";
      let cleanedText = responseText;
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const resultJson = JSON.parse(cleanedText);
      res.status(200).json(resultJson);

    } catch (error: any) {
      console.error("Error in analizarComida function:", error);
      const errorMsg = error?.message || "";
      const isRateLimit =
        error?.status === 429 ||
        error?.statusCode === 429 ||
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit) {
        res.status(429).json({
          error: "Rate Limit definitivo. La API de Gemini está sobrecargada. Por favor, intenta de nuevo más tarde.",
        });
        return;
      }

      res.status(500).json({
        error: "Internal Server Error",
        message: error?.message || String(error),
      });
    }
  }
);

// 2. Daily Advice function (Flash model)
export const obtenerConsejoPive = onRequest(
  {
    cors: true,
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req: any, res: any) => {
    const uid = await verifyAuthToken(req, res);
    if (!uid) return;

    try {
      const { dailyMacros, goals, bodyMetrics, meals, currentTime } = req.body;

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const remaining = {
        protein: Math.max(0, (goals?.protein || 0) - (dailyMacros?.protein || 0)),
        carbs: Math.max(0, (goals?.carbs || 0) - (dailyMacros?.carbs || 0)),
        fats: Math.max(0, (goals?.fats || 0) - (dailyMacros?.fats || 0)),
        calories: Math.max(0, (goals?.calories || 0) - (dailyMacros?.calories || 0))
      };

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
        Hora actual del usuario: ${currentTime || 'No provista'}
        Metas diarias del usuario: ${JSON.stringify(goals || {})}
        Macros ya consumidos hoy: ${JSON.stringify(dailyMacros || {})}
        Macros restantes por consumir: ${JSON.stringify(remaining)}
        Comidas registradas hoy por el usuario: ${JSON.stringify(meals || [])}
        Métricas corporales de fondo: ${JSON.stringify(bodyMetrics || 'No disponibles')}
      `;

      const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      res.status(200).json({ advice: response.text });
    } catch (error: any) {
      console.error("Error in obtenerConsejoPive:", error);
      res.status(500).json({ error: "Error generating advice", message: error?.message || String(error) });
    }
  }
);

// 3. Analyze Food Image (Flash model)
export const analizarImagenComida = onRequest(
  {
    cors: true,
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req: any, res: any) => {
    const uid = await verifyAuthToken(req, res);
    if (!uid) return;

    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: "Missing parameters: base64Data or mimeType" });
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        Analiza esta imagen de comida. Identifica el plato, los ingredientes visibles con una cantidad aproximada, y calcula los macronutrientes totales (calorías, proteínas, carbohidratos, grasas).
        REGLAS DE IDIOMA: Todos los campos de texto del JSON (como 'name' del plato y 'name' de los ingredientes) DEBEN estar estrictamente en español.
        Responde en formato JSON.
      `;

      const response = await ai.models.generateContent({
        model: FLASH_MODEL,
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

      res.status(200).json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("Error in analizarImagenComida:", error);
      res.status(500).json({ error: "Error analyzing food image", message: error?.message || String(error) });
    }
  }
);

// 4. Calculate Macros from Ingredients list (Flash model)
export const calcularMacrosIngredientes = onRequest(
  {
    cors: true,
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req: any, res: any) => {
    const uid = await verifyAuthToken(req, res);
    if (!uid) return;

    try {
      const { ingredients } = req.body;
      if (!ingredients || !Array.isArray(ingredients)) {
        res.status(400).json({ error: "Missing or invalid parameter: ingredients" });
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        Calcula los macronutrientes totales y calorías para la siguiente lista de ingredientes:
        ${JSON.stringify(ingredients)}
        Responde en formato JSON.
      `;

      const response = await ai.models.generateContent({
        model: FLASH_MODEL,
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

      res.status(200).json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("Error in calcularMacrosIngredientes:", error);
      res.status(500).json({ error: "Error calculating macros", message: error?.message || String(error) });
    }
  }
);

// 5. Analyze Nutrition Plan (Pro model)
export const analizarPlanNutricional = onRequest(
  {
    cors: true,
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req: any, res: any) => {
    const uid = await verifyAuthToken(req, res);
    if (!uid) return;

    try {
      const { base64Data, mimeType, text } = req.body;

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        Analiza este plan nutricional (ya sea una imagen, un PDF o texto extraído). 
        Extrae y devuelve de forma estructurada los macros totales sugeridos (calorías, proteínas, carbohidratos, grasas), 
        una breve recomendación personalizada en español (consejo / advice), la lista de intercambios diarios (exchanges) 
        y la estructura de las comidas (meals) detallando el tipo de comida y las opciones sugeridas de menús con sus macros e ingredientes.

        REGLA DE IDIOMA: Todos los campos de texto del JSON (títulos de opciones, nombres de ingredientes, unidades, nombres de los grupos de intercambio, etc.) DEBEN estar estrictamente en español.
        Responde en formato JSON.
      `;

      const parts: any[] = [{ text: prompt }];
      if (text) {
        parts.push({ text: `Texto del plan: ${text}` });
      } else if (base64Data && mimeType) {
        parts.push({ inlineData: { data: base64Data, mimeType } });
      }

      const response = await ai.models.generateContent({
        model: PRO_MODEL,
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
              exchanges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Nombre del grupo de intercambio, ej. Proteínas, Harinas, Frutas, Leche, Grasas, etc." },
                    qty: { type: Type.STRING, description: "Cantidad diaria recomendada, ej. '12', '7', 'Libres', '2+'" }
                  },
                  required: ["name", "qty"]
                },
                description: "Lista de porciones o grupos de intercambio diarios recomendados en el plan (si están de alguna forma presentes)."
              },
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "Ej. Desayuno, Merienda, Almuerzo, Cena" },
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

      res.status(200).json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("Error in analizarPlanNutricional:", error);
      res.status(500).json({ error: "Error analyzing nutrition plan", message: error?.message || String(error) });
    }
  }
);

// 6. Analyze Body Composition (Pro model)
export const analizarComposicionCorporal = onRequest(
  {
    cors: true,
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req: any, res: any) => {
    const uid = await verifyAuthToken(req, res);
    if (!uid) return;

    try {
      const { base64Data, mimeType, text } = req.body;

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

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
      if (text) {
        parts.push({ text: `Texto del reporte: ${text}` });
      } else if (base64Data && mimeType) {
        parts.push({ inlineData: { data: base64Data, mimeType } });
      }

      const response = await ai.models.generateContent({
        model: PRO_MODEL,
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

      res.status(200).json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("Error in analizarComposicionCorporal:", error);
      res.status(500).json({ error: "Error analyzing body composition", message: error?.message || String(error) });
    }
  }
);

// 7. Analyze Workout Plan (Pro model)
export const analizarPlanEntrenamiento = onRequest(
  {
    cors: true,
    minInstances: 0,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req: any, res: any) => {
    const uid = await verifyAuthToken(req, res);
    if (!uid) return;

    try {
      const { files } = req.body;
      if (!files || !Array.isArray(files)) {
        res.status(400).json({ error: "Missing or invalid parameter: files" });
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        Analiza esta rutina de entrenamiento (que puede ser una o varias fotos, capturas de pantalla, archivos de texto o PDFs).
        Extrae la rutina dividida en días de entrenamiento de forma estructurada.
        Si algún día no tiene un nombre claro, genera un nombre descriptivo en español (ej: "Día 1: Push", "Día 2: Pull", "Día 3: Piernas").
        Para cada ejercicio, extrae el nombre del ejercicio, número de series (sets), repeticiones (reps), una breve descripción de la técnica o forma en español (máximo 1 frase), y un arreglo de categorías de grupos musculares a los que pertenece (debe ser una o más de: Pecho, Espalda, Piernas, Hombros, Brazos, Core).
        Genera un URL de búsqueda en YouTube para cada ejercicio del tipo: "https://www.youtube.com/results?search_query=como+hacer+[nombre+ejercicio]".
        Responde en formato JSON.
      `;

      const parts: any[] = [{ text: prompt }];
      files.forEach((file: any) => {
        if (file.text) {
          parts.push({ text: `Texto de la rutina: ${file.text}` });
        } else if (file.base64Data && file.mimeType) {
          parts.push({ inlineData: { data: file.base64Data, mimeType: file.mimeType } });
        }
      });

      const response = await ai.models.generateContent({
        model: PRO_MODEL,
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

      res.status(200).json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("Error in analizarPlanEntrenamiento:", error);
      res.status(500).json({ error: "Error analyzing workout plan", message: error?.message || String(error) });
    }
  }
);
