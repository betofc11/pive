import { COMPLEMENTS, COMPLEMENTS_REVIEWED } from './complements';
import { buildMealFromFit, FIT, fitPlanOptions, foodNamesMatch, foodTokens, MIN_PORTION_SHARE } from './planFit';
import type { PlanOptionLike } from './plan';
import { sumMacros } from '../macros';

const m = (calories: number, protein: number, carbs: number, fats: number) => ({ calories, protein, carbs, fats });

// diseno.md §3.8: lunch budget ~600 kcal · P 45; option 2 is rice + ground beef (~500 kcal · P 35)
const riceAndBeef: PlanOptionLike = {
  title: 'Arroz con carne molida',
  ingredients: [
    { name: 'Arroz blanco cocido', quantity: 100, unit: 'g', macros: m(130, 3, 28, 0) },
    { name: 'Carne molida', quantity: 120, unit: 'g', macros: m(370, 32, 0, 24) },
  ],
};
const chickenAndPotato: PlanOptionLike = {
  title: 'Pollo con papa',
  ingredients: [
    { name: 'Pechuga de pollo', quantity: 120, unit: 'g', macros: m(198, 37, 0, 4) },
    { name: 'Papa cocida', quantity: 150, unit: 'g', macros: m(131, 3, 30, 0) },
    { name: 'Ensalada verde', quantity: 100, unit: 'g', macros: m(15, 1, 3, 0) },
  ],
};
// From the breakfast of the same plan
const freshCheese = { name: 'Queso tierno', quantity: 40, unit: 'g', macros: m(120, 7, 1, 9) };
const planFoods = [freshCheese, ...riceAndBeef.ingredients!, ...chickenAndPotato.ingredients!];
const lunchBudget = m(600, 45, 60, 25);

const fit = (options: PlanOptionLike[], budget = lunchBudget, excludeFoods: string[] = [], foods = planFoods) =>
  fitPlanOptions({ options, budget, planFoods: foods, complements: COMPLEMENTS, excludeFoods });

describe('fitPlanOptions', () => {
  it('short on protein: adds a complement, the plan’s own food (fresh cheese) first', () => {
    // As in the design: the only other food of the plan is the breakfast's fresh cheese
    const [result] = fit([riceAndBeef], lunchBudget, [], [freshCheese, ...riceAndBeef.ingredients!]);
    expect(result).toMatchObject({ optionIndex: 0, verdict: 'add', macros: m(500, 35, 28, 24), gap: m(100, 10, 32, 1), reductions: [] });
    expect(result.complements).toHaveLength(FIT.maxSuggestions);
    expect(result.complements[0]).toEqual({
      complementId: 'fresh_cheese',
      name: 'Queso tierno',
      grams: 40,
      unit: 'g',
      adds: m(120, 7, 1, 9),
      fromPlan: true,
    });
    // Then the curated table, never something the option already has (more ground beef) or a poor protein source
    for (const c of result.complements.slice(1)) {
      expect(c.fromPlan).toBe(false);
      expect(c.name).not.toMatch(/carne|arroz|aceite|mani/i);
      expect(c.adds.protein).toBeGreaterThanOrEqual(5);
    }
  });

  it('among the plan’s foods, the one that closes the gap best goes first', () => {
    const [result] = fit([riceAndBeef]);
    expect(result.complements.map((c) => [c.name, c.fromPlan])).toEqual([
      ['Pechuga de pollo', true],
      ['Queso tierno', true],
      [expect.any(String), false],
    ]);
    expect(result.complements[0].grams).toBe(50);
  });

  it('within ±10% kcal and ±5 g of protein: as it is', () => {
    const [result] = fit([chickenAndPotato], m(380, 42, 30, 8));
    expect(result).toMatchObject({ verdict: 'as_is', complements: [], reductions: [] });
  });

  it('over: reduces the ingredient that gives the most of what’s over, never to zero', () => {
    const bigRice: PlanOptionLike = {
      title: 'Arroz con pollo',
      ingredients: [
        { name: 'Arroz blanco cocido', quantity: 250, unit: 'g', macros: m(325, 7, 70, 1) },
        { name: 'Pechuga de pollo', quantity: 120, unit: 'g', macros: m(198, 37, 0, 4) },
      ],
    };
    const [result] = fit([bigRice], m(400, 30, 40, 15));
    expect(result.verdict).toBe('reduce');
    expect(result.complements).toEqual([]);
    // Carbs are what's over, and the rice gives all of them (the chicken has none)
    expect(result.reductions).toEqual([
      { ingredientIndex: 0, name: 'Arroz blanco cocido', fromQuantity: 250, toQuantity: 160, unit: 'g', removes: m(117, 3, 25, 0) },
    ]);
  });

  it('a huge excess cuts the portion only down to half', () => {
    const [result] = fit([riceAndBeef], m(0, 0, 0, 0));
    expect(result.verdict).toBe('reduce');
    for (const r of result.reductions) {
      expect(r.toQuantity).toBeGreaterThanOrEqual(r.fromQuantity * MIN_PORTION_SHARE);
      expect(r.toQuantity).toBeGreaterThan(0);
    }
  });

  it('leaves out the foods to avoid (phase 2: memory)', () => {
    const [result] = fit([riceAndBeef], lunchBudget, ['queso']);
    expect(result.complements.length).toBeGreaterThan(0);
    expect(result.complements.some((c) => /queso/i.test(c.name))).toBe(false);

    const [withoutEggs] = fit([riceAndBeef], lunchBudget, ['huevo', 'queso', 'cottage', 'pavo', 'leche', 'yogur', 'tofu']);
    expect(withoutEggs.complements.some((c) => /huevo|clara|queso|pavo|leche|yogur|tofu/i.test(c.name))).toBe(false);
  });

  it('sorts the options by fit: protein weighs double, then kcal', () => {
    const result = fit([riceAndBeef, chickenAndPotato]);
    // chicken + potato: 344 kcal · P 41 → gap P +4 · +256 kcal; rice + beef: gap P +10 · +100 kcal
    expect(result.map((r) => r.title)).toEqual(['Arroz con carne molida', 'Pollo con papa']);
    expect(result.map((r) => r.optionIndex)).toEqual([0, 1]);
  });

  it('doesn’t break on a plan without macros per ingredient (no fit possible)', () => {
    const old: PlanOptionLike = { title: 'Viejo', ingredients: [{ name: 'Arroz', quantity: 100, unit: 'g' }] };
    expect(fit([old])).toEqual([]);
    // With only the option's total: it fits, but there are no portions to reduce
    const [totalOnly] = fit([{ ...old, macros: m(900, 20, 150, 20) }]);
    expect(totalOnly).toMatchObject({ verdict: 'reduce', reductions: [] });
  });
});

describe('buildMealFromFit', () => {
  it('option + complement: the complement becomes an ingredient and the macros add up in code', () => {
    const [result] = fit([riceAndBeef], lunchBudget, [], [freshCheese]);
    const meal = buildMealFromFit(result, riceAndBeef, { complementIndex: 0 }, 'lunch');
    expect(meal.name).toBe('Arroz con carne molida + queso tierno');
    expect(meal.slot).toBe('lunch');
    expect(meal.ingredients).toHaveLength(3);
    expect(meal.ingredients[2]).toEqual({ name: 'Queso tierno', quantity: 40, unit: 'g', macros: m(120, 7, 1, 9) });
    expect(meal.macros).toEqual(sumMacros([result.macros, result.complements[0].adds]));
    // The plan's option is not modified
    expect(riceAndBeef.ingredients).toHaveLength(2);
  });

  it('option − reduction: the ingredient gets the smaller portion', () => {
    const option: PlanOptionLike = {
      title: 'Arroz con pollo',
      ingredients: [
        { name: 'Arroz blanco cocido', quantity: 250, unit: 'g', macros: m(325, 7, 70, 1) },
        { name: 'Pechuga de pollo', quantity: 120, unit: 'g', macros: m(198, 37, 0, 4) },
      ],
    };
    const [result] = fit([option], m(400, 30, 40, 15));
    const meal = buildMealFromFit(result, option, { reductionIndex: 0 }, 'lunch');
    expect(meal.name).toBe('Arroz con pollo');
    expect(meal.ingredients[0]).toEqual({ name: 'Arroz blanco cocido', quantity: 160, unit: 'g', macros: m(208, 4, 45, 1) });
    expect(meal.macros).toEqual(m(523 - 117, 44 - 3, 70 - 25, 5));
  });

  it('as it is, when nothing is chosen', () => {
    const [result] = fit([riceAndBeef]);
    const meal = buildMealFromFit(result, riceAndBeef, { complementIndex: null, reductionIndex: null }, 'lunch');
    expect(meal).toMatchObject({ name: 'Arroz con carne molida', macros: m(500, 35, 28, 24) });
  });
});

describe('food names', () => {
  it('normalizes case, accents, stopwords and plurals', () => {
    expect(foodTokens('Frijoles en agua')).toEqual(['frijol', 'agua']);
    expect(foodTokens('ATÚN de lata')).toEqual(['atun', 'lata']);
  });

  it('matches a general name with a specific one, both ways', () => {
    expect(foodNamesMatch(['queso tierno'], 'queso')).toBe(true);
    expect(foodNamesMatch(['atun'], 'atún en agua')).toBe(true);
    expect(foodNamesMatch(['Fresas'], 'fresa')).toBe(true);
    expect(foodNamesMatch(['pan integral'], 'pan cuadrado')).toBe(false);
    expect(foodNamesMatch(['mantequilla de mani'], 'maní')).toBe(true);
  });
});

describe('COMPLEMENTS', () => {
  it('is waiting for a review', () => {
    expect(COMPLEMENTS_REVIEWED).toBe(false);
  });

  it('has 30–40 foods with unique ids and sensible limits', () => {
    expect(COMPLEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(COMPLEMENTS.length).toBeLessThanOrEqual(40);
    expect(new Set(COMPLEMENTS.map((c) => c.id)).size).toBe(COMPLEMENTS.length);
    for (const c of COMPLEMENTS) {
      expect(c.minGrams).toBeGreaterThan(0);
      expect(c.maxGrams).toBeGreaterThanOrEqual(c.minGrams);
      expect((c.maxGrams - c.minGrams) % c.step).toBe(0);
      expect(c.aliases.every((a) => a === a.toLowerCase())).toBe(true);
    }
  });

  // Vegetables are off by more in %: their carbs are mostly fiber. Hence the 10 kcal floor.
  it.each(COMPLEMENTS.map((c) => [c.name, c] as const))('%s: its kcal match its macros (4/4/9, ±15% or ±10 kcal)', (_, c) => {
    const { calories, protein, carbs, fats } = c.per100g;
    const fromMacros = protein * 4 + carbs * 4 + fats * 9;
    expect(Math.abs(fromMacros - calories)).toBeLessThanOrEqual(Math.max(0.15 * calories, 10));
  });
});
