// The nutrition plan's restrictions as memory facts (diseno §4.2): what comes from a document dies with the
// document, so a new plan replaces the facts of the old one.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { type CoachMemory, MAX_FACT_TEXT, type MemoryFact, normalizeText } from './memory';

const MAX_SLUG = 35; // "plan_" + 35 = the 40 characters a key's topic can have

const slugOf = (text: string) =>
  normalizeText(text)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/_+$/, '');

// "Sin lácteos", "No comer cerdo ni mariscos", "Alergia al maní", "Intolerancia a la lactosa"
const LEAD_RE =
  /^(?:sin|no comer|no consumir|no|cero|evitar|evita|nada de|libre de|alergia a|alergia al|alergico a|alergico al|alergica a|alergica al|intolerancia a|intolerancia al|intolerante a|intolerante al)\s+(.+)$/;
const DIET_RE = /^(?:dieta\s+)?(vegetarian[ao]|vegan[ao])$/;
const ARTICLE_RE = /^(?:el|la|los|las|un|una|de|del)\s+/;

/** The foods a restriction names, normalized: "Sin lácteos ni gluten" → ["lacteos", "gluten"]. [] if unclear */
export function restrictionFoods(restriction: string): string[] {
  const text = normalizeText(restriction).replace(/[.;:!¡¿?()]/g, ' ').replace(/\s+/g, ' ').trim();
  const diet = DIET_RE.exec(text);
  if (diet) return [diet[1]];
  const match = LEAD_RE.exec(text);
  if (!match) return [];
  return match[1]
    .split(/,|\s+(?:ni|y|o|e)\s+/)
    .map((part) => part.trim().replace(ARTICLE_RE, '').trim())
    .filter((part) => part.length >= 3);
}

/**
 * Deletes every fact that came from a plan and creates `restriction.plan_<slug>` for each restriction of the
 * new one, with the foods it names and stance 'avoid'. Chat and app facts are left as they are.
 */
export function replacePlanFacts(memory: CoachMemory, restrictions: string[], now: number): CoachMemory {
  const facts: Record<string, MemoryFact> = {};
  for (const [key, fact] of Object.entries(memory.facts)) {
    if (fact.source !== 'plan') facts[key] = fact;
  }

  (Array.isArray(restrictions) ? restrictions : []).forEach((raw, index) => {
    if (typeof raw !== 'string' || !raw.trim()) return;
    const text = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_FACT_TEXT);
    const base = `restriction.plan_${slugOf(text) || index + 1}`;
    let key = base;
    for (let n = 2; facts[key]; n++) key = `${base.slice(0, 'restriction.'.length + 37)}_${n}`;

    const fact: MemoryFact = {
      key,
      category: 'restriction',
      text,
      stance: 'avoid',
      source: 'plan',
      createdAt: now,
      updatedAt: now,
      lastConfirmedAt: now,
    };
    const foods = restrictionFoods(text);
    if (foods.length > 0) fact.foods = foods;
    facts[key] = fact;
  });

  return { ...memory, facts, updatedAt: now };
}
