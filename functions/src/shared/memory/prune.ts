// Cleaning without AI (diseno §4.5): done each time the memory is loaded.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import {
  type CoachMemory,
  CONFIRM_GRACE_DAYS,
  DAY_MS,
  INJURY_REVIEW_DAYS,
  type MemoryFact,
  STALE_AFTER_DAYS,
} from './memory';
import { enforceCap } from './ops';

const STALE_CATEGORIES = new Set<MemoryFact['category']>(['food', 'schedule', 'equipment']);

const daysSince = (ms: number, now: number) => (now - ms) / DAY_MS;

/**
 * - Removes expired facts, and food/schedule/equipment facts nobody confirmed in STALE_AFTER_DAYS +
 *   CONFIRM_GRACE_DAYS.
 * - Applies the cap (never removes allergies or injuries).
 * - `toConfirm`: food/schedule/equipment facts older than STALE_AFTER_DAYS, and injuries older than
 *   INJURY_REVIEW_DAYS. Pive can ask about them naturally.
 * If nothing was removed, `memory` comes back as the same object.
 */
export function pruneMemory(
  memory: CoachMemory,
  now: number,
  maxFacts: number,
): { memory: CoachMemory; removed: string[]; toConfirm: string[] } {
  const facts: Record<string, MemoryFact> = { ...memory.facts };
  const removed: string[] = [];

  for (const fact of Object.values(facts)) {
    const expired = fact.expiresAt !== undefined && fact.expiresAt <= now;
    const abandoned = STALE_CATEGORIES.has(fact.category) && daysSince(fact.lastConfirmedAt, now) > STALE_AFTER_DAYS + CONFIRM_GRACE_DAYS;
    if (expired || abandoned) {
      delete facts[fact.key];
      removed.push(fact.key);
    }
  }
  removed.push(...enforceCap(facts, maxFacts));

  const toConfirm = Object.values(facts)
    .filter((fact) => {
      const age = daysSince(fact.lastConfirmedAt, now);
      if (STALE_CATEGORIES.has(fact.category)) return age > STALE_AFTER_DAYS;
      return fact.category === 'injury' && age > INJURY_REVIEW_DAYS;
    })
    .map((fact) => fact.key)
    .sort();

  return { memory: removed.length > 0 ? { ...memory, facts, updatedAt: now } : memory, removed, toConfirm };
}
