import type { Part } from "@google/genai";
import { aiEndpoint } from "../http";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { BODY_COMPOSITION_SCHEMA } from "../ai/schemas";
import { BODY_COMPOSITION_INSTRUCTION } from "../ai/tasks/bodyComposition";

// Body composition report (heavy model)
export const analizarComposicionCorporal = aiEndpoint("analizarComposicionCorporal", "Error analyzing body composition", async ({ req, res }) => {
  const { base64Data, mimeType, text } = req.body;

  const ai = requireAi(res);
  if (!ai) return;

  const parts: Part[] = [];
  if (text) {
    parts.push({ text: `Texto del reporte: ${text}` });
  } else if (base64Data && mimeType) {
    parts.push({ inlineData: { data: base64Data, mimeType } });
  }

  const response = await generateContentWithRetry(ai, {
    model: MODELS.heavy,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: BODY_COMPOSITION_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: BODY_COMPOSITION_SCHEMA,
    },
  });

  res.status(200).json(JSON.parse(response.text || "{}"));
});
