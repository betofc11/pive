import type { GoogleGenAI, Part } from "@google/genai";
import { generateContentWithRetry, MODELS } from "./gemini";
import { FOOD_SCHEMA } from "./schemas";
import { FOOD_INSTRUCTION, normalizeFoodAnalysis } from "./tasks/food";

export interface FoodInput {
  /** What the user wrote; may be empty if there is an image */
  description: string;
  image?: { data: string; mimeType: string };
}

/**
 * The logic of analizarImagenComida without HTTP or auth: the endpoint and the evals (functions/evals) both use it.
 * Returns the normalized analysis and what's needed to record the usage.
 */
export async function estimateFood(ai: GoogleGenAI, { description, image }: FoodInput) {
  const parts: Part[] = [];
  if (description) {
    parts.push({ text: `Descripción del usuario: ${description}` });
  }
  if (image) {
    parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
  }

  const model = MODELS.light;
  const response = await generateContentWithRetry(ai, {
    model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: FOOD_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: FOOD_SCHEMA,
    },
  });

  return {
    analysis: normalizeFoodAnalysis(JSON.parse(response.text || "{}")),
    usageMetadata: response.usageMetadata,
    model,
  };
}
