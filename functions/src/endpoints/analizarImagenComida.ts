import type { Part } from "@google/genai";
import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { FOOD_SCHEMA } from "../ai/schemas";
import { FOOD_INSTRUCTION, normalizeFoodAnalysis } from "../ai/tasks/food";

// Food from an image, a text description, or both (light model).
// Response: { name, macros, ingredients (each with its macros), assumptions, mentionedSlot }. `macros` is the sum of the ingredients.
export const analizarImagenComida = aiEndpoint("analizarImagenComida", "Error analyzing food image", async ({ req, res, uid }) => {
  const { base64Data, mimeType, text, localDate } = req.body ?? {};
  const description = typeof text === "string" ? text.trim() : "";
  const hasImage = Boolean(base64Data && mimeType);
  if (!hasImage && !description) {
    res.status(400).json({ error: "Missing parameters: provide text or base64Data with mimeType" });
    return;
  }

  const ai = requireAi(res);
  if (!ai) return;

  const parts: Part[] = [];
  if (description) {
    parts.push({ text: `Descripción del usuario: ${description}` });
  }
  if (hasImage) {
    parts.push({ inlineData: { data: base64Data, mimeType } });
  }

  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: FOOD_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: FOOD_SCHEMA,
    },
  });
  await recordUsage(uid, "food", response.usageMetadata, MODELS.light, localDate);

  res.status(200).json(normalizeFoodAnalysis(JSON.parse(response.text || "{}")));
});
