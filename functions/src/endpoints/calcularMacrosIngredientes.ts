import { aiEndpoint } from "../http";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { INGREDIENTS_MACROS_SCHEMA } from "../ai/schemas";
import { INGREDIENTS_INSTRUCTION } from "../ai/tasks/ingredients";

// Macros of a list of ingredients (light model)
export const calcularMacrosIngredientes = aiEndpoint("calcularMacrosIngredientes", "Error calculating macros", async ({ req, res }) => {
  const { ingredients } = req.body;
  if (!ingredients || !Array.isArray(ingredients)) {
    res.status(400).json({ error: "Missing or invalid parameter: ingredients" });
    return;
  }

  const ai = requireAi(res);
  if (!ai) return;

  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: JSON.stringify(ingredients),
    config: {
      systemInstruction: INGREDIENTS_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: INGREDIENTS_MACROS_SCHEMA,
    },
  });

  res.status(200).json(JSON.parse(response.text || "{}"));
});
