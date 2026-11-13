import type { Part } from "@google/genai";
import { aiEndpoint } from "../http";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { WORKOUT_PLAN_SCHEMA } from "../ai/schemas";
import { WORKOUT_PLAN_INSTRUCTION } from "../ai/tasks/workoutPlan";

interface WorkoutFile {
  base64Data?: string;
  mimeType?: string;
  text?: string;
}

// Workout plan from one or more photos, PDFs or text files (heavy model)
export const analizarPlanEntrenamiento = aiEndpoint("analizarPlanEntrenamiento", "Error analyzing workout plan", async ({ req, res }) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files)) {
    res.status(400).json({ error: "Missing or invalid parameter: files" });
    return;
  }

  const ai = requireAi(res);
  if (!ai) return;

  const parts: Part[] = [];
  (files as WorkoutFile[]).forEach((file) => {
    if (file.text) {
      parts.push({ text: `Texto de la rutina: ${file.text}` });
    } else if (file.base64Data && file.mimeType) {
      parts.push({ inlineData: { data: file.base64Data, mimeType: file.mimeType } });
    }
  });

  const response = await generateContentWithRetry(ai, {
    model: MODELS.heavy,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: WORKOUT_PLAN_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: WORKOUT_PLAN_SCHEMA,
    },
  });

  res.status(200).json(JSON.parse(response.text || "{}"));
});
