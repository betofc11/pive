import type { Part } from "@google/genai";
import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { NUTRITION_PLAN_SCHEMA } from "../ai/schemas";
import { normalizeNutritionPlan, NUTRITION_PLAN_INSTRUCTION } from "../ai/tasks/nutritionPlan";

// Nutrition plan from an image, a PDF or text (heavy model).
// Every meal has its `slot`, and every option and ingredient its macros (an option's are the sum of its ingredients).
export const analizarPlanNutricional = aiEndpoint("analizarPlanNutricional", "Error analyzing nutrition plan", async ({ req, res, uid }) => {
  const { base64Data, mimeType, text, localDate } = req.body ?? {};

  const ai = requireAi(res);
  if (!ai) return;

  const parts: Part[] = [];
  if (text) {
    parts.push({ text: `Texto del plan: ${text}` });
  } else if (base64Data && mimeType) {
    parts.push({ inlineData: { data: base64Data, mimeType } });
  }

  const response = await generateContentWithRetry(ai, {
    model: MODELS.heavy,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: NUTRITION_PLAN_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: NUTRITION_PLAN_SCHEMA,
    },
  });
  await recordUsage(uid, "nutritionPlan", response.usageMetadata, MODELS.heavy, localDate);

  res.status(200).json(normalizeNutritionPlan(JSON.parse(response.text || "{}")));
});
