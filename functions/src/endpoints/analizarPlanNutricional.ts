import type { Part } from "@google/genai";
import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { NUTRITION_PLAN_SCHEMA } from "../ai/schemas";
import { NUTRITION_PLAN_INSTRUCTION } from "../ai/tasks/nutritionPlan";

// Nutrition plan from an image, a PDF or text (heavy model)
export const analizarPlanNutricional = aiEndpoint("analizarPlanNutricional", "Error analyzing nutrition plan", async ({ req, res, uid }) => {
  const { base64Data, mimeType, text } = req.body;

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
  await recordUsage(uid, "nutritionPlan", response.usageMetadata, MODELS.heavy);

  res.status(200).json(JSON.parse(response.text || "{}"));
});
