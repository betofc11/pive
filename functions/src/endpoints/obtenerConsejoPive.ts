import { aiEndpoint, type EndpointContext } from "../http";
import { db } from "../firestore";
import { recordUsage } from "../usage";
import { generateContentWithRetry, MODELS, requireAi } from "../ai/gemini";
import { ADVICE_SCHEMA } from "../ai/schemas";
import { ADVICE_INSTRUCTION, buildAdviceProposal, FALLBACK_ADVICE, parseAdviceChoice, prepareDayAdvice } from "../ai/tasks/advice";
import { buildLegacyAdviceContents, LEGACY_ADVICE_INSTRUCTION } from "../ai/tasks/adviceLegacy";
import type { AdviceResponse } from "../shared/api";
import { isClockTime, isDateKey } from "../shared/dates";

// TODO(fase-3): quitar ruta vieja. Apps from before phase 1 send { dailyMacros, goals, meals, currentTime, localDate }
// and get { advice }.
async function legacyAdvice({ req, res, uid }: EndpointContext) {
  const { dailyMacros, goals, meals, currentTime, localDate } = req.body ?? {};
  const ai = requireAi(res);
  if (!ai) return;

  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: buildLegacyAdviceContents({ dailyMacros, goals, meals, currentTime, localDate }),
    config: { systemInstruction: LEGACY_ADVICE_INSTRUCTION },
  });
  await recordUsage(uid, "advice", response.usageMetadata, MODELS.light, localDate);
  res.status(200).json({ advice: response.text });
}

// Daily advice (light model). Request: { localDate: 'YYYY-MM-DD', localTime: 'HH:mm' }.
// Response: { advice, slot, proposal } (AdviceResponse). The server reads the profile and that day's log itself.
export const obtenerConsejoPive = aiEndpoint("obtenerConsejoPive", "Error generating advice", async (ctx) => {
  const { req, res, uid } = ctx;
  const body = req.body ?? {};
  if (body.dailyMacros !== undefined) return legacyAdvice(ctx);

  const { localDate, localTime } = body;
  if (!isDateKey(localDate) || !isClockTime(localTime)) {
    res.status(400).json({ error: "localDate (YYYY-MM-DD) and localTime (HH:mm) are required" });
    return;
  }

  const ai = requireAi(res);
  if (!ai) return;

  const [userSnap, logSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`users/${uid}/dailyLogs/${localDate}`).get(),
  ]);
  const prep = prepareDayAdvice({
    profile: userSnap.data(),
    log: logSnap.exists ? logSnap.data() : null,
    localDate,
    localTime,
    nowMs: Date.now(),
  });
  if (!prep) {
    res.status(400).json({ error: "The user has no macro goals yet" });
    return;
  }

  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: prep.contents,
    config: {
      systemInstruction: ADVICE_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: ADVICE_SCHEMA,
    },
  });
  await recordUsage(uid, "advice", response.usageMetadata, MODELS.light, localDate);

  const choice = parseAdviceChoice(response.text, prep.fits);
  const result: AdviceResponse = {
    advice: choice.text || FALLBACK_ADVICE,
    slot: prep.next,
    proposal: buildAdviceProposal(prep, choice),
  };
  res.status(200).json(result);
});
