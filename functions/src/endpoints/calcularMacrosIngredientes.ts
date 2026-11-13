import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { INGREDIENTS_MACROS_SCHEMA } from "../ai/schemas";
import {
  ingredientsToEstimate,
  INGREDIENTS_INSTRUCTION,
  MAX_INGREDIENTS,
  mergeIngredientMacros,
  parseRequestedIngredients,
} from "../ai/tasks/ingredients";

// Macros of a list of ingredients (light model).
// Request: { ingredients: { name, quantity, unit, macros? }[] }. Only the ones without macros go to the AI.
// Response: { calories, protein, carbs, fats, ingredients } with the totals at the top level, as before.
export const calcularMacrosIngredientes = aiEndpoint("calcularMacrosIngredientes", "Error calculating macros", async ({ req, res, uid }) => {
  const { ingredients, localDate } = req.body ?? {};
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length > MAX_INGREDIENTS) {
    res.status(400).json({ error: "Missing or invalid parameter: ingredients" });
    return;
  }

  const requested = parseRequestedIngredients(ingredients);
  const toEstimate = ingredientsToEstimate(requested);
  // Everything already has macros (they were scaled in the app): the totals are a sum, no AI needed
  if (toEstimate.length === 0) {
    res.status(200).json(mergeIngredientMacros(requested, {}));
    return;
  }

  const ai = requireAi(res);
  if (!ai) return;

  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: JSON.stringify(toEstimate),
    config: {
      systemInstruction: INGREDIENTS_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: INGREDIENTS_MACROS_SCHEMA,
    },
  });
  await recordUsage(uid, "ingredients", response.usageMetadata, MODELS.light, localDate);

  res.status(200).json(mergeIngredientMacros(requested, JSON.parse(response.text || "{}")));
});
