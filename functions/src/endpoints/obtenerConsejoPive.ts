import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { ADVICE_INSTRUCTION, buildAdviceContents } from "../ai/tasks/advice";

// Daily advice (light model).
// Request: { dailyMacros, goals, meals: { name, time, macros }[], currentTime, localDate: 'YYYY-MM-DD' }. Response: { advice }.
// Older clients also send bodyMetrics: it is ignored.
export const obtenerConsejoPive = aiEndpoint("obtenerConsejoPive", "Error generating advice", async ({ req, res, uid }) => {
  const { dailyMacros, goals, meals, currentTime, localDate } = req.body ?? {};

  const ai = requireAi(res);
  if (!ai) return;

  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: buildAdviceContents({ dailyMacros, goals, meals, currentTime, localDate }),
    config: {
      systemInstruction: ADVICE_INSTRUCTION,
    },
  });
  await recordUsage(uid, "advice", response.usageMetadata, MODELS.light, localDate);

  res.status(200).json({ advice: response.text });
});
