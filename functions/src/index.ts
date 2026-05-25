import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";

admin.initializeApp();

export const analizarComida = onRequest(
  {
    cors: true,
    minInstances: 1,
    secrets: ["GEMINI_API_KEY"],
  },
  async (req, res) => {
    try {
      // Configurar encabezados CORS para mayor seguridad ante peticiones directas
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

      // Consumir de forma segura la clave (fallback local a EXPO_PUBLIC_GEMINI_API_KEY)
      const apiKey = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API Key is not configured." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        Analiza el siguiente texto que describe una comida y estima sus ingredientes: "${comidaTexto}".
        Calcula los macronutrientes totales (calorías, proteínas, carbohidratos, grasas).
        Responde exclusivamente con un objeto JSON plano que contenga los campos:
        - comida (string): Un nombre resumido de la comida analizada.
        - calorias (number): Las calorías totales calculadas.
        - proteinas (number): Los gramos de proteína calculados.
        - carbohidratos (number): Los gramos de carbohidratos calculados.
        - grasas (number): Los gramos de grasa calculados.

        No agregues bloques de código markdown del tipo \`\`\`json ni texto introductorio o conclusivo.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      const responseText = response.text?.trim() || "{}";
      
      // Limpieza defensiva en caso de que el modelo incluya bloques markdown
      let cleanedText = responseText;
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const resultJson = JSON.parse(cleanedText);
      res.status(200).json(resultJson);

    } catch (error: any) {
      console.error("Error in analizarComida function:", error);

      // Control del error 429 (Rate Limit / Resource Exhausted)
      const errorMsg = error?.message || "";
      const isRateLimit =
        error?.status === 429 ||
        error?.statusCode === 429 ||
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit) {
        res.status(429).json({
          error: "Rate Limit exceeded. La API de Gemini está recibiendo demasiadas peticiones. Por favor, intenta de nuevo en unos momentos.",
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
