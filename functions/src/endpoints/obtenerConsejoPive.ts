import { aiEndpoint } from "../http";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { ADVICE_INSTRUCTION } from "../ai/tasks/advice";

// Daily advice (light model)
export const obtenerConsejoPive = aiEndpoint("obtenerConsejoPive", "Error generating advice", async ({ req, res, uid }) => {
  const { dailyMacros, goals, bodyMetrics, meals, currentTime } = req.body;

  const ai = requireAi(res);
  if (!ai) return;

  const remaining = {
    protein: Math.max(0, (goals?.protein || 0) - (dailyMacros?.protein || 0)),
    carbs: Math.max(0, (goals?.carbs || 0) - (dailyMacros?.carbs || 0)),
    fats: Math.max(0, (goals?.fats || 0) - (dailyMacros?.fats || 0)),
    calories: Math.max(0, (goals?.calories || 0) - (dailyMacros?.calories || 0)),
  };

  const prompt = `
Hora actual del usuario: ${currentTime || "No provista"}
Metas diarias del usuario: ${JSON.stringify(goals || {})}
Macros ya consumidos hoy: ${JSON.stringify(dailyMacros || {})}
Macros restantes por consumir: ${JSON.stringify(remaining)}
Comidas registradas hoy por el usuario: ${JSON.stringify(meals || [])}
Métricas corporales de fondo: ${JSON.stringify(bodyMetrics || "No disponibles")}
`;

  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: prompt,
    config: {
      systemInstruction: ADVICE_INSTRUCTION,
    },
  });
  await recordUsage(uid, "advice", response.usageMetadata, MODELS.light);

  res.status(200).json({ advice: response.text });
});
