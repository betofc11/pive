import { mealMacrosFromIngredients, rescaleIngredient, type IngredientWithMacros } from './ingredients';

const chicken: IngredientWithMacros = {
  name: 'Pechuga de pollo cocida',
  quantity: 100,
  unit: 'g',
  macros: { calories: 165, protein: 31, carbs: 0, fats: 4 },
};
const rice: IngredientWithMacros = {
  name: 'Arroz blanco cocido',
  quantity: 150,
  unit: 'g',
  macros: { calories: 195, protein: 4, carbs: 42, fats: 0 },
};

describe('rescaleIngredient', () => {
  it('100 g → 150 g multiplies the macros by 1.5', () => {
    expect(rescaleIngredient(chicken, 150)).toEqual({
      ...chicken,
      quantity: 150,
      macros: { calories: 247.5, protein: 46.5, carbs: 0, fats: 6 },
    });
  });

  it('a quantity of 0 drops the macros', () => {
    const result = rescaleIngredient(chicken, 0);
    expect(result.quantity).toBe(0);
    expect(result.macros).toBeUndefined();
  });

  it('cannot scale from a previous quantity of 0', () => {
    expect(rescaleIngredient({ ...chicken, quantity: 0 }, 100).macros).toBeUndefined();
  });

  it('an ingredient without macros stays without macros', () => {
    const { macros: _, ...plain } = chicken;
    expect(rescaleIngredient(plain, 200)).toEqual({ ...plain, quantity: 200 });
  });

  it('does not mutate the previous ingredient', () => {
    rescaleIngredient(chicken, 300);
    expect(chicken.quantity).toBe(100);
    expect(chicken.macros?.calories).toBe(165);
  });
});

describe('mealMacrosFromIngredients', () => {
  it('adds the macros of every ingredient', () => {
    expect(mealMacrosFromIngredients([chicken, rice])).toEqual({ calories: 360, protein: 35, carbs: 42, fats: 4 });
  });

  it('returns null if no ingredient has macros', () => {
    expect(mealMacrosFromIngredients([{ name: 'Huevo', quantity: 2, unit: 'unidad' }])).toBeNull();
  });

  it('returns null if some have macros and some do not', () => {
    expect(mealMacrosFromIngredients([chicken, { name: 'Aguacate', quantity: 50, unit: 'g' }])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(mealMacrosFromIngredients([])).toBeNull();
  });
});
