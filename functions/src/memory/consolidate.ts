// "While you sleep" (diseno §4.3): after a chat session, one cheap call turns what the user said into memory
// operations, and only those that pass the anti-junk filter are applied. Phase 3 schedules it (consolidarMemoria).
import { db } from "../firestore";
import { memoryDoc } from "./store";
import { recordUsage } from "../usage";
import { createAi, generateContentWithRetry, MODELS } from "../ai/gemini";
import { MEMORY_OPS_SCHEMA } from "../ai/schemas";
import { buildConsolidationContents, MEMORY_INSTRUCTION, parseMemoryOpsResponse } from "../ai/tasks/memory";
import { DEFAULT_MAX_FACTS, parseCoachMemory } from "../shared/memory/memory";
import { applyMemoryOps, validateMemoryOps } from "../shared/memory/ops";

export type ConsolidationResult = "applied" | "skipped" | "empty";

/**
 * Updates users/{uid}/coach/memory with what the user wrote in a session.
 * - 'skipped': the memory is off (the model isn't called).
 * - 'empty': nothing durable, or nothing passed the filter.
 * - 'applied': at least one operation was saved.
 * The operations are validated and applied in a transaction against the memory as it is at that moment.
 * Needs GEMINI_API_KEY (the function that calls it must declare the secret).
 */
export async function consolidateSession(
  uid: string,
  userMessages: string[],
  localDate: string,
  maxFacts: number = DEFAULT_MAX_FACTS,
): Promise<ConsolidationResult> {
  const ref = memoryDoc(uid);
  const memory = parseCoachMemory((await ref.get()).data());
  if (!memory.enabled) return "skipped";

  const messages = userMessages.filter((m) => typeof m === "string" && m.trim() !== "");
  if (messages.length === 0) return "empty";

  const ai = createAi();
  const response = await generateContentWithRetry(ai, {
    model: MODELS.light,
    contents: buildConsolidationContents({ memory, userMessages: messages, localDate }),
    config: {
      systemInstruction: MEMORY_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: MEMORY_OPS_SCHEMA,
    },
  });
  await recordUsage(uid, "memory", response.usageMetadata, MODELS.light, localDate);

  const ops = parseMemoryOpsResponse(response.text);
  if (ops.length === 0) return "empty";

  return db.runTransaction(async (tx): Promise<ConsolidationResult> => {
    const snap = await tx.get(ref);
    const current = parseCoachMemory(snap.data());
    // Turned off while the model was answering
    if (!current.enabled) return "skipped";

    const now = Date.now();
    const { accepted, rejected } = validateMemoryOps(ops, current, messages, now);
    // Only the reasons: the rest is the user's own words
    if (rejected.length > 0) console.info(`consolidateSession: ${rejected.length} rejected (${rejected.map((r) => r.reason).join(", ")})`);
    if (accepted.length === 0) return "empty";

    tx.set(ref, applyMemoryOps(current, accepted, now, "chat", maxFacts));
    return "applied";
  });
}
