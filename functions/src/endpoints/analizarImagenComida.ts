import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { requireAi } from "../ai/gemini";
import { estimateFood } from "../ai/estimateFood";

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

  const { analysis, usageMetadata, model } = await estimateFood(ai, {
    description,
    image: hasImage ? { data: base64Data, mimeType } : undefined,
  });
  await recordUsage(uid, "food", usageMetadata, model, localDate);

  res.status(200).json(analysis);
});
