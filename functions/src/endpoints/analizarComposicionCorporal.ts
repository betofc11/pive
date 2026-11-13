import type { Part } from "@google/genai";
import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { BODY_COMPOSITION_SCHEMA } from "../ai/schemas";
import { BODY_COMPOSITION_INSTRUCTION, normalizeBodyComposition } from "../ai/tasks/bodyComposition";

// Body composition report (heavy model). Response: { weight, bodyFat?, muscleMass?, measuredAt: 'YYYY-MM-DD' | null }
export const analizarComposicionCorporal = aiEndpoint("analizarComposicionCorporal", "Error analyzing body composition", async ({ req, res, uid }) => {
  const { base64Data, mimeType, text, localDate } = req.body ?? {};

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
  await recordUsage(uid, "bodyComposition", response.usageMetadata, MODELS.heavy, localDate);

  res.status(200).json(normalizeBodyComposition(JSON.parse(response.text || "{}")));
});
