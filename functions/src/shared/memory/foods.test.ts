import { avoidedFoods, expandFoodGroups } from './foods';
import { type CoachMemory, emptyMemory, type MemoryFact } from './memory';
import { replacePlanFacts } from './plan';
import { COMPLEMENTS } from '../meals/complements';
import { fitPlanOptions } from '../meals/planFit';
import type { PlanOptionLike } from '../meals/plan';

const NOW = Date.UTC(2026, 10, 17, 15);
const fact = (key: string, extra: Partial<MemoryFact>): MemoryFact => ({
  key,
  category: key.split('.')[0] as MemoryFact['category'],
  text: key,
  source: 'chat',
  createdAt: NOW,
  updatedAt: NOW,
  lastConfirmedAt: NOW,
  ...extra,
});
const withFacts = (...facts: MemoryFact[]): CoachMemory => ({ ...emptyMemory(), facts: Object.fromEntries(facts.map((f) => [f.key, f])) });

describe('avoidedFoods', () => {
  it('takes allergies, restrictions and stance avoid; not preferences', () => {
    const memory = withFacts(
      fact('allergy.mani', { foods: ['mani'] }),
      fact('food.atun', { foods: ['atun'], stance: 'avoid' }),
      fact('food.pan_cuadrado', { foods: ['pan cuadrado integral'], stance: 'prefer' }),
      fact('restriction.sin_cerdo', { foods: ['cerdo'] }),
      fact('goal.fuerza', {}),
    );
    expect(avoidedFoods(memory).sort()).toEqual(['atun', 'cerdo', 'mani']);
  });

  it('expands groups: lácteos covers cheese and yogurt, a vegetarian diet covers meat and fish', () => {
    expect(expandFoodGroups(['Lácteos'])).toEqual(expect.arrayContaining(['lacteos', 'queso', 'yogur', 'leche']));
    expect(expandFoodGroups(['vegetariana'])).toEqual(expect.arrayContaining(['pollo', 'atun', 'carne molida']));
    expect(expandFoodGroups(['frutos secos'])).toEqual(expect.arrayContaining(['mani', 'almendra']));
    expect(expandFoodGroups(['nueces'])).toEqual(expect.arrayContaining(['mani', 'almendra']));
    expect(expandFoodGroups(['atún', 'atun'])).toEqual(['atun']);
  });
});

describe('avoidedFoods + fitPlanOptions', () => {
  const m = (calories: number, protein: number, carbs: number, fats: number) => ({ calories, protein, carbs, fats });
  // Short on protein: the fit looks for a protein complement
  const riceAndBeans: PlanOptionLike = {
    title: 'Arroz con frijoles',
    ingredients: [
      { name: 'Arroz blanco cocido', quantity: 150, unit: 'g', macros: m(195, 4, 42, 0) },
      { name: 'Frijoles cocidos', quantity: 100, unit: 'g', macros: m(130, 9, 23, 1) },
    ],
  };
  // Without the memory: queso tierno (from the plan), queso cottage, carne molida
  const budget = m(450, 25, 70, 18);
  // From the breakfast of the same plan: the plan's own foods go first
  const planFoods = [{ name: 'Queso tierno', quantity: 40, unit: 'g', macros: m(120, 7, 1, 9) }];
  const complementNames = (excludeFoods: string[]) =>
    fitPlanOptions({ options: [riceAndBeans], budget, planFoods, complements: COMPLEMENTS, excludeFoods })[0].complements.map((c) => c.name);

  it('an avoided complement does not show up', () => {
    const before = complementNames([]);
    expect(before.length).toBeGreaterThan(0);
    const [first] = before;
    const memory = withFacts(fact('food.no_gusta', { foods: [first], stance: 'avoid' }));
    expect(complementNames(avoidedFoods(memory))).not.toContain(first);
  });

  it('a plan with "Sin lácteos" leaves out cheese and yogurt', () => {
    expect(complementNames([]).slice(0, 2)).toEqual(['Queso tierno', 'Queso cottage']);
    const memory = replacePlanFacts(emptyMemory(), ['Sin lácteos'], NOW);
    const names = complementNames(avoidedFoods(memory));
    expect(names.length).toBeGreaterThan(0);
    expect(names.join(' ')).not.toMatch(/queso|yogur/i);
  });

  it('a vegetarian diet leaves out meat, chicken and fish', () => {
    expect(complementNames([]).join(' ')).toMatch(/carne|pollo/i);
    const memory = replacePlanFacts(emptyMemory(), ['Vegetariana'], NOW);
    const names = complementNames(avoidedFoods(memory));
    expect(names.length).toBeGreaterThan(0);
    expect(names.join(' ')).not.toMatch(/carne|pollo|atún|pescado/i);
  });
});
