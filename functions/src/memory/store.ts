// Reading the memory on the server: users/{uid}/coach/memory, with the cleanup without AI (diseno §4.5).
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { db } from "../firestore";
import { type CoachMemory, DEFAULT_MAX_FACTS, parseCoachMemory } from "../shared/memory/memory";
import { pruneMemory } from "../shared/memory/prune";

export const memoryDoc = (uid: string) => db.doc(`users/${uid}/coach/memory`);

/**
 * Deletes facts one by one (keys have dots, so each goes as a FieldPath), without touching the rest: an edit made
 * meanwhile isn't overwritten. A key that is already gone is a no-op.
 */
export async function deleteMemoryFacts(uid: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const [firstKey, ...moreKeys] = keys;
  const more = moreKeys.flatMap((key) => [new FieldPath("facts", key), FieldValue.delete()]);
  await memoryDoc(uid).update(new FieldPath("facts", firstKey), FieldValue.delete(), ...more);
}

/**
 * The memory to use in a prompt: null if it's off. Expired and abandoned facts and those over the cap are left
 * out, and deleted from Firestore (lazy cleanup; if that fails, the next load tries again).
 */
export async function loadActiveMemory(uid: string, now: number, maxFacts: number = DEFAULT_MAX_FACTS): Promise<CoachMemory | null> {
  const memory = parseCoachMemory((await memoryDoc(uid).get()).data());
  if (!memory.enabled) return null;
  const pruned = pruneMemory(memory, now, maxFacts);
  if (pruned.removed.length > 0) {
    await deleteMemoryFacts(uid, pruned.removed).catch((error) => console.warn("Memory cleanup failed:", error));
  }
  return pruned.memory;
}
