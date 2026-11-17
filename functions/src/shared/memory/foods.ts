// Which foods the memory rules out, so the plan fit never suggests them (fitPlanOptions' excludeFoods).
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { type CoachMemory, normalizeText } from './memory';

/**
 * Words that name a whole group of foods, with the foods they cover, so "sin lácteos" also rules out "queso
 * tierno". Keys and foods are normalized (normalizeText); they're compared with foodNamesMatch, which ignores
 * plurals.
 */
export const FOOD_GROUPS: Record<string, string[]> = {
  lactosa: ['leche', 'queso', 'yogur', 'yogurt', 'kefir', 'crema', 'requeson', 'cottage'],
  lacteo: ['leche', 'queso', 'yogur', 'yogurt', 'kefir', 'crema', 'mantequilla', 'requeson', 'cottage', 'lacteo'],
  marisco: ['camaron', 'langosta', 'cangrejo', 'pulpo', 'calamar', 'almeja', 'mejillon', 'ostion', 'marisco'],
  pescado: ['pescado', 'atun', 'salmon', 'tilapia', 'sardina', 'bacalao'],
  gluten: ['pan', 'pasta', 'galleta', 'harina de trigo', 'trigo', 'cebada', 'centeno', 'gluten'],
  'carne roja': ['res', 'cerdo', 'carne molida', 'bistec', 'carne roja'],
  carne: ['carne', 'res', 'cerdo', 'carne molida', 'bistec', 'pollo', 'pechuga', 'pavo', 'jamon'],
  huevo: ['huevo', 'clara'],
  'fruto seco': ['nuez', 'almendra', 'mani', 'cacahuate', 'pistacho', 'maranon', 'avellana'],
  nuez: ['nuez', 'almendra', 'mani', 'cacahuate', 'pistacho', 'maranon', 'avellana'],
  // Diets: what they leave out
  vegetariano: ['carne', 'res', 'cerdo', 'carne molida', 'pollo', 'pechuga', 'pavo', 'jamon', 'pescado', 'atun', 'salmon', 'marisco', 'camaron'],
  vegano: [
    'carne', 'res', 'cerdo', 'carne molida', 'pollo', 'pechuga', 'pavo', 'jamon', 'pescado', 'atun', 'salmon', 'marisco',
    'camaron', 'leche', 'queso', 'yogur', 'yogurt', 'cottage', 'requeson', 'huevo', 'clara', 'miel', 'mantequilla',
  ],
};

/** "Lácteos" → "lacteo", "Frutos secos" → "fruto seco": the FOOD_GROUPS key a food names, if any */
function groupKey(food: string): string | null {
  const words = normalizeText(food)
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      if (/ces$/.test(w) && w.length > 4) return `${w.slice(0, -3)}z`; // nueces → nuez
      if (/[lnrdz]es$/.test(w) && w.length > 4) return w.slice(0, -2);
      return w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w;
    });
  const key = words.join(' ');
  if (FOOD_GROUPS[key]) return key;
  // "vegetariana", "vegana"
  if (/^vegetarian[ao]$/.test(key)) return 'vegetariano';
  if (/^vegan[ao]$/.test(key)) return 'vegano';
  return null;
}

/** The foods themselves plus what the groups among them cover, without repeats */
export function expandFoodGroups(foods: string[]): string[] {
  const out = new Set<string>();
  for (const food of foods) {
    const normalized = normalizeText(food);
    if (!normalized) continue;
    out.add(normalized);
    const group = groupKey(normalized);
    if (group) FOOD_GROUPS[group].forEach((f) => out.add(f));
  }
  return [...out];
}

/**
 * Foods to leave out of the suggestions: those of every allergy, of the restrictions (unless they're a
 * preference) and of any fact with stance 'avoid', with their groups expanded.
 */
export function avoidedFoods(memory: CoachMemory): string[] {
  const foods: string[] = [];
  for (const fact of Object.values(memory.facts)) {
    const avoids =
      fact.category === 'allergy' || (fact.category === 'restriction' && fact.stance !== 'prefer') || fact.stance === 'avoid';
    if (avoids && fact.foods) foods.push(...fact.foods);
  }
  return expandFoodGroups(foods);
}
