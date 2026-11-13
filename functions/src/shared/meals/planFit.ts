// The plan first: how each option of the plan fits the budget of a slot, and how to compensate.
// Pive recommends an option of the plan; if it falls short it adds ONE concrete food, and if it goes over it
// reduces ONE portion. Every quantity is calculated here; the model only picks among these and writes.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { type IngredientWithMacros, mealMacrosFromIngredients, rescaleIngredient } from '../ingredients';
import { isMacros, type Macros, roundMacros, scaleMacros, subtractMacros, sumMacros } from '../macros';
import type { Complement } from './complements';
import { optionMacros, type PlanOptionLike } from './plan';
import type { MealSlot } from './slots';

export const FIT = {
  /** An option within ±10% of the slot's kcal… */
  asIsKcalTolerance: 0.1,
  /** …and ±5 g of its protein is fine as it is */
  asIsProteinToleranceG: 5,
  /** Complements or reductions offered per option */
  maxSuggestions: 3,
} as const;

/** To close a protein gap, a food needs at least this share of its kcal from protein (rice doesn't count) */
export const PROTEIN_SOURCE_MIN_SHARE = 0.2;
/** A complement has to close at least this share of what's missing of its target (no 200 g of lettuce for protein) */
export const MIN_TARGET_CLOSED = 0.5;
/** A reduction never leaves less than this share of the ingredient: never zero, never skip the meal */
export const MIN_PORTION_SHARE = 0.5;
/** Limits for a plan food that isn't in the curated table */
const PLAN_FOOD_LIMITS = { minGrams: 10, maxGrams: 200, step: 10 };

export interface ComplementSuggestion {
  /** The curated complement, or null for a plan food that isn't in the table */
  complementId: string | null;
  name: string;
  grams: number;
  /** 'ml' for drinks (1 ml ≈ 1 g) */
  unit: 'g' | 'ml';
  adds: Macros;
  /** It's already in the user's plan: offered first */
  fromPlan: boolean;
  /** When the grams are whole pieces: "4 claras" */
  pieces?: { count: number; label: string };
}

export interface PortionReduction {
  /** Index in the option's ingredients */
  ingredientIndex: number;
  name: string;
  fromQuantity: number;
  toQuantity: number;
  unit: string;
  removes: Macros;
}

export interface PlanOptionFit {
  /** Index in the `options` passed to fitPlanOptions */
  optionIndex: number;
  title: string;
  macros: Macros;
  /** budget − option. Positive: it falls short; negative: it goes over */
  gap: Macros;
  verdict: 'as_is' | 'add' | 'reduce';
  complements: ComplementSuggestion[];
  reductions: PortionReduction[];
}

// ---------------------------------------------------------------------------------------------------------------
// Matching food names: plan foods with the curated table, and the foods to avoid (phase 2: memory).

const STOPWORDS = new Set(['de', 'del', 'en', 'con', 'la', 'el', 'los', 'las', 'a', 'al', 'y', 'o', 'sin']);

const singular = (word: string) => {
  if (/[lnrdz]es$/.test(word) && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
};

/** Lowercase, no accents, no stopwords, singular: "Frijoles en agua" → ["frijol", "agua"] */
export function foodTokens(name: string): string[] {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singular);
}

const containsAll = (haystack: string[], needles: string[]) => needles.length > 0 && needles.every((w) => haystack.includes(w));

/** True if a food name and one of `terms` name the same thing ("queso" ~ "queso tierno", "atún en agua" ~ "atún"). */
export function foodNamesMatch(terms: string[], food: string): boolean {
  const foodWords = foodTokens(food);
  return terms.some((term) => {
    const termWords = foodTokens(term);
    return containsAll(termWords, foodWords) || containsAll(foodWords, termWords);
  });
}

// ---------------------------------------------------------------------------------------------------------------

interface Candidate {
  complementId: string | null;
  name: string;
  /** Names to match it by: its own, plus the curated aliases */
  terms: string[];
  unit: 'g' | 'ml';
  perGram: Macros;
  minGrams: number;
  maxGrams: number;
  step: number;
  fromPlan: boolean;
  piece?: Complement['piece'];
}

const GRAM_UNITS = new Set(['g', 'gr', 'grs', 'gramo', 'gramos', 'ml', 'mililitro', 'mililitros']);

const termsOf = (c: Complement) => [c.name, ...c.aliases];

/** Plan foods (in grams or ml) first, then the curated table; without the foods to avoid. */
function buildCandidates(planFoods: IngredientWithMacros[], complements: Complement[], excludeFoods: string[]): Candidate[] {
  const avoided = (names: string[]) => excludeFoods.some((food) => foodNamesMatch(names, food));
  const candidates: Candidate[] = [];

  for (const food of planFoods) {
    const unit = (food.unit ?? '').trim().toLowerCase();
    if (!GRAM_UNITS.has(unit) || !(food.quantity > 0) || !isMacros(food.macros) || food.macros.calories <= 0) continue;
    if (avoided([food.name])) continue;
    const curated = complements.find((c) => foodNamesMatch(termsOf(c), food.name));
    if (curated && candidates.some((c) => c.complementId === curated.id)) continue;
    candidates.push({
      complementId: curated?.id ?? null,
      name: food.name,
      terms: [food.name, ...(curated ? termsOf(curated) : [])],
      unit: unit.startsWith('m') ? 'ml' : 'g',
      perGram: scaleMacros(food.macros, 1 / food.quantity),
      ...(curated ? { minGrams: curated.minGrams, maxGrams: curated.maxGrams, step: curated.step } : PLAN_FOOD_LIMITS),
      fromPlan: true,
      piece: curated?.piece,
    });
  }

  for (const c of complements) {
    if (candidates.some((p) => p.complementId === c.id) || avoided(termsOf(c))) continue;
    candidates.push({
      complementId: c.id,
      name: c.name,
      terms: termsOf(c),
      unit: c.unit ?? 'g',
      perGram: scaleMacros(c.per100g, 1 / 100),
      minGrams: c.minGrams,
      maxGrams: c.maxGrams,
      step: c.step,
      fromPlan: false,
      piece: c.piece,
    });
  }
  return candidates;
}

/**
 * How far a gap is from closed, in kcal: missing protein weighs double (×8 per gram), extra protein only past
 * the tolerance, and kcal count both ways.
 */
function gapScore(gap: Macros): number {
  const tolerance = FIT.asIsProteinToleranceG;
  const protein = gap.protein > 0 ? 8 * gap.protein : -gap.protein > tolerance ? 8 * (-gap.protein - tolerance) : 0;
  return protein + Math.abs(gap.calories);
}

/** The best quantity of a candidate for a gap, or null if none improves it enough to be worth saying. */
function bestComplement(candidate: Candidate, gap: Macros, target: 'protein' | 'calories'): { suggestion: ComplementSuggestion; score: number } | null {
  const { perGram } = candidate;
  if (perGram[target] <= 0) return null;
  if (target === 'protein' && (perGram.protein * 4) / perGram.calories < PROTEIN_SOURCE_MIN_SHARE) return null;

  const before = gapScore(gap);
  let best: { suggestion: ComplementSuggestion; score: number } | null = null;
  for (let grams = candidate.minGrams; grams <= candidate.maxGrams + 1e-9; grams += candidate.step) {
    const adds = roundMacros(scaleMacros(perGram, grams));
    if (adds[target] < MIN_TARGET_CLOSED * gap[target]) continue;
    const score = gapScore(subtractMacros(gap, adds));
    if (!best || score < best.score) {
      const suggestion: ComplementSuggestion = {
        complementId: candidate.complementId,
        name: candidate.name,
        grams: Math.round(grams),
        unit: candidate.unit,
        adds,
        fromPlan: candidate.fromPlan,
      };
      const count = candidate.piece ? grams / candidate.piece.grams : 0;
      if (candidate.piece && count >= 1 && Math.abs(count - Math.round(count)) < 0.01) {
        suggestion.pieces = { count: Math.round(count), label: candidate.piece.label };
      }
      best = { score, suggestion };
    }
  }
  // It has to close at least a quarter of the gap
  return best && best.score <= before * 0.75 ? best : null;
}

const roundQuantity = (quantity: number, unit: string) => {
  const step = GRAM_UNITS.has(unit.trim().toLowerCase()) ? (quantity >= 50 ? 10 : 5) : 0.5;
  return { value: Math.round(quantity / step) * step, step };
};

/** Smaller portions of the ingredients that give the most of what's over, largest first. */
function reductionsFor(option: PlanOptionLike, gap: Macros, proteinShort: boolean): PortionReduction[] {
  const excess: Array<[keyof Macros, number]> = [
    ['carbs', Math.max(0, -gap.carbs) * 4],
    ['fats', Math.max(0, -gap.fats) * 9],
    ['protein', proteinShort ? 0 : Math.max(0, -gap.protein) * 4],
  ];
  const [macro, kcal] = excess.sort((a, b) => b[1] - a[1])[0];
  const key: keyof Macros = kcal > 0 ? macro : 'calories';
  const kcalToRemove = Math.max(0, -gap.calories);

  return (option.ingredients ?? [])
    .map((ingredient, index) => ({ ingredient, index }))
    .filter(({ ingredient }) => ingredient.quantity > 0 && isMacros(ingredient.macros) && ingredient.macros[key] > 0)
    .sort((a, b) => (b.ingredient.macros as Macros)[key] - (a.ingredient.macros as Macros)[key])
    .map(({ ingredient, index }): PortionReduction | null => {
      const macros = ingredient.macros as Macros;
      const keep = macros.calories > 0 ? Math.max(MIN_PORTION_SHARE, 1 - kcalToRemove / macros.calories) : MIN_PORTION_SHARE;
      const floor = ingredient.quantity * MIN_PORTION_SHARE;
      let { value: toQuantity, step } = roundQuantity(ingredient.quantity * keep, ingredient.unit);
      if (toQuantity < floor) toQuantity += step;
      if (toQuantity <= 0 || toQuantity >= ingredient.quantity) return null;
      const reduced = roundMacros((rescaleIngredient(ingredient, toQuantity).macros as Macros) ?? macros);
      return {
        ingredientIndex: index,
        name: ingredient.name,
        fromQuantity: ingredient.quantity,
        toQuantity,
        unit: ingredient.unit,
        removes: roundMacros(subtractMacros(macros, reduced)),
      };
    })
    .filter((r): r is PortionReduction => r !== null)
    .slice(0, FIT.maxSuggestions);
}

/**
 * Each option of a slot against its budget, best fit first (protein weighs double, then kcal).
 * - Within tolerance → `as_is`.
 * - Over on kcal → `reduce`: smaller portions of the ingredient that gives the most of what's over.
 * - Short on protein or kcal → `add`: up to 3 complements, the plan's own foods first, never one the option
 *   already has.
 * Options without macros are left out (old plans): there's nothing to calculate with.
 */
export function fitPlanOptions(input: {
  options: PlanOptionLike[];
  budget: Macros;
  planFoods: IngredientWithMacros[];
  complements: Complement[];
  /** Foods the user avoids or is allergic to (phase 2 fills it from the memory) */
  excludeFoods?: string[];
}): PlanOptionFit[] {
  const budget = roundMacros(input.budget);
  const candidates = buildCandidates(input.planFoods, input.complements, input.excludeFoods ?? []);
  const kcalTolerance = FIT.asIsKcalTolerance * Math.max(0, budget.calories);

  const fits: Array<PlanOptionFit & { score: number }> = [];
  input.options.forEach((option, optionIndex) => {
    const raw = optionMacros(option);
    if (!raw) return;
    const macros = roundMacros(raw);
    const gap = subtractMacros(budget, macros);
    const over = gap.calories < -kcalTolerance;
    const proteinShort = gap.protein > FIT.asIsProteinToleranceG;
    const kcalShort = gap.calories > kcalTolerance;
    const verdict: PlanOptionFit['verdict'] = over ? 'reduce' : proteinShort || kcalShort ? 'add' : 'as_is';

    let complements: ComplementSuggestion[] = [];
    if (verdict === 'add') {
      const target = proteinShort ? 'protein' : 'calories';
      // Something new: more of what the option already has would be changing its portion
      const ownFoods = (option.ingredients ?? []).map((i) => i.name);
      const scored = candidates
        .filter((candidate) => !ownFoods.some((food) => foodNamesMatch(candidate.terms, food)))
        .map((candidate) => bestComplement(candidate, gap, target))
        .filter((c): c is { suggestion: ComplementSuggestion; score: number } => c !== null);
      const byScore = (a: { score: number }, b: { score: number }) => a.score - b.score;
      complements = [
        ...scored.filter((c) => c.suggestion.fromPlan).sort(byScore),
        ...scored.filter((c) => !c.suggestion.fromPlan).sort(byScore),
      ]
        .slice(0, FIT.maxSuggestions)
        .map((c) => c.suggestion);
    }

    fits.push({
      optionIndex,
      title: option.title,
      macros,
      gap,
      verdict,
      complements,
      reductions: verdict === 'reduce' ? reductionsFor(option, gap, proteinShort) : [],
      score: gapScore(gap),
    });
  });

  return fits.sort((a, b) => a.score - b.score).map(({ score: _score, ...fit }) => fit);
}

const lowerFirst = (text: string) => (text ? text[0].toLowerCase() + text.slice(1) : text);

/**
 * The exact meal for "Registrar así": the option, with the chosen reduction and/or complement applied.
 * Its macros are the sum of its ingredients, in code (option + complement, or option − reduction).
 */
export function buildMealFromFit(
  fit: PlanOptionFit,
  option: PlanOptionLike,
  choice: { complementIndex?: number | null; reductionIndex?: number | null },
  slot: MealSlot,
): { name: string; ingredients: IngredientWithMacros[]; macros: Macros; slot: MealSlot } {
  const ingredients: IngredientWithMacros[] = (option.ingredients ?? []).map((i) => ({ ...i }));
  let macros = fit.macros;

  const reduction = choice.reductionIndex != null ? fit.reductions[choice.reductionIndex] : undefined;
  const target = reduction ? ingredients[reduction.ingredientIndex] : undefined;
  if (reduction && target) {
    const rescaled = rescaleIngredient(target, reduction.toQuantity);
    ingredients[reduction.ingredientIndex] = {
      ...rescaled,
      macros: isMacros(target.macros) ? subtractMacros(target.macros, reduction.removes) : rescaled.macros,
    };
    macros = subtractMacros(macros, reduction.removes);
  }

  const complement = choice.complementIndex != null ? fit.complements[choice.complementIndex] : undefined;
  if (complement) {
    ingredients.push({ name: complement.name, quantity: complement.grams, unit: complement.unit, macros: complement.adds });
    macros = sumMacros([macros, complement.adds]);
  }

  return {
    name: complement ? `${fit.title} + ${lowerFirst(complement.name)}` : fit.title,
    ingredients,
    macros: roundMacros(mealMacrosFromIngredients(ingredients) ?? macros),
    slot,
  };
}
