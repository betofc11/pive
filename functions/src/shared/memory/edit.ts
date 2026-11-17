// What the user changes in "Lo que Pive sabe de ti". Pure, so the app runs it inside a transaction and tests it.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { type CoachMemory, MAX_FACT_TEXT, type MemoryFact } from './memory';
import { restrictionFoods } from './plan';

/**
 * The user rewrites a fact. The old text goes to `previous` and the source becomes 'app', so a new plan no
 * longer replaces it. The foods are read again from the new text for allergies and restrictions; a food fact
 * loses its foods and stance, which may no longer be true (the text still reaches the AI).
 * Throws if the fact doesn't exist or the text is empty or too long.
 */
export function editFactText(memory: CoachMemory, key: string, text: string, now: number): CoachMemory {
  const current = memory.facts[key];
  if (!current) throw new Error(`Unknown memory fact: ${key}`);
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > MAX_FACT_TEXT) throw new Error(`The text must have 1–${MAX_FACT_TEXT} characters`);
  if (clean === current.text) return memory;

  const { foods: _foods, stance: _stance, evidence: _evidence, ...rest } = current;
  const next: MemoryFact = {
    ...rest,
    text: clean,
    source: 'app',
    updatedAt: now,
    lastConfirmedAt: now,
    previous: { text: current.text, updatedAt: current.updatedAt },
  };
  if (current.category === 'allergy' || current.category === 'restriction') {
    const foods = restrictionFoods(clean);
    if (foods.length > 0) next.foods = foods;
    else if (current.category === 'allergy' && current.foods) next.foods = current.foods;
    next.stance = 'avoid';
  }
  return { ...memory, facts: { ...memory.facts, [key]: next }, updatedAt: now };
}

export function removeFact(memory: CoachMemory, key: string, now: number): CoachMemory {
  if (!memory.facts[key]) return memory;
  const { [key]: _removed, ...facts } = memory.facts;
  return { ...memory, facts, updatedAt: now };
}

/** "Borrar todo": every fact goes; whether the memory is on and the notice stay */
export const clearFacts = (memory: CoachMemory, now: number): CoachMemory => ({ ...memory, facts: {}, updatedAt: now });
