import { averageOptionKcal, categorySlot, optionMacros, planCategoriesForSlot, planFoods, type PlanLike } from './plan';

const macros = (calories: number, protein = 0, carbs = 0, fats = 0) => ({ calories, protein, carbs, fats });

it('categorySlot uses the saved slot, or the name for old plans', () => {
  expect(categorySlot({ type: 'Comida', slot: 'dinner' })).toBe('dinner');
  expect(categorySlot({ type: 'Almuerzo' })).toBe('lunch');
  expect(categorySlot({ type: 'Bebidas' })).toBeNull();
  // A bad value from Firestore falls back to the name
  expect(categorySlot({ type: 'Cena', slot: 'brunch' as never })).toBe('dinner');
});

it('optionMacros prefers the sum of the ingredients, then the saved total', () => {
  expect(
    optionMacros({
      title: 'A',
      macros: macros(999),
      ingredients: [
        { name: 'Arroz', quantity: 100, unit: 'g', macros: macros(130, 3, 28, 0) },
        { name: 'Pollo', quantity: 100, unit: 'g', macros: macros(165, 31, 0, 4) },
      ],
    }),
  ).toEqual(macros(295, 34, 28, 4));
  expect(optionMacros({ title: 'A', macros: macros(500), ingredients: [{ name: 'Arroz', quantity: 100, unit: 'g' }] })).toEqual(macros(500));
  expect(optionMacros({ title: 'A', ingredients: [{ name: 'Arroz', quantity: 100, unit: 'g' }] })).toBeNull();
});

it('averageOptionKcal skips options without macros', () => {
  expect(averageOptionKcal({ type: 'Cena', options: [{ title: 'A', macros: macros(400) }, { title: 'B' }, { title: 'C', macros: macros(600) }] })).toBe(500);
  expect(averageOptionKcal({ type: 'Cena', options: [{ title: 'A' }] })).toBeNull();
});

describe('planCategoriesForSlot', () => {
  const plan: PlanLike = {
    meals: [
      { type: 'Snack nocturno', slot: 'dinner', options: [{ title: 'Yogur', macros: macros(150) }] },
      { type: 'Cena', slot: 'dinner', options: [{ title: 'Pollo', macros: macros(450) }] },
      { type: 'Almuerzo', slot: 'lunch', options: [{ title: 'Arroz', macros: macros(600) }] },
    ],
  };

  it('puts the main category first and splits the slot by kcal', () => {
    const result = planCategoriesForSlot(plan, 'dinner');
    expect(result.map((r) => r.category.type)).toEqual(['Cena', 'Snack nocturno']);
    expect(result.map((r) => r.share)).toEqual([0.75, 0.25]);
  });

  it('gives a single category the whole slot, and nothing for a slot the plan lacks', () => {
    expect(planCategoriesForSlot(plan, 'lunch')).toEqual([{ category: plan.meals![2], share: 1 }]);
    expect(planCategoriesForSlot(plan, 'breakfast')).toEqual([]);
    expect(planCategoriesForSlot(undefined, 'lunch')).toEqual([]);
  });

  it('splits evenly when some category has no macros', () => {
    const result = planCategoriesForSlot({ meals: [{ type: 'Cena', options: [{ title: 'A' }] }, { type: 'Snack nocturno', options: [{ title: 'B', macros: macros(100) }] }] }, 'dinner');
    expect(result.map((r) => r.share)).toEqual([0.5, 0.5]);
  });
});

it('planFoods lists each ingredient with macros once', () => {
  const foods = planFoods({
    meals: [
      { type: 'Desayuno', options: [{ title: 'A', ingredients: [{ name: 'Queso tierno', quantity: 40, unit: 'g', macros: macros(120, 7, 1, 9) }] }] },
      {
        type: 'Cena',
        options: [
          {
            title: 'B',
            ingredients: [
              { name: 'queso tierno ', quantity: 80, unit: 'g', macros: macros(240, 14, 2, 18) },
              { name: 'Lechuga', quantity: 50, unit: 'g' },
            ],
          },
        ],
      },
    ],
  });
  expect(foods).toEqual([{ name: 'Queso tierno', quantity: 40, unit: 'g', macros: macros(120, 7, 1, 9) }]);
});
