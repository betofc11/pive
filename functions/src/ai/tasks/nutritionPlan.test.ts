import { normalizeNutritionPlan } from './nutritionPlan';

const oats = { name: 'Avena en hojuelas', quantity: 40, unit: 'g', macros: { calories: 150, protein: 5, carbs: 27, fats: 3 } };
const milk = { name: 'Leche descremada', quantity: 240, unit: 'ml', macros: { calories: 83, protein: 8, carbs: 12, fats: 0.2 } };

const modelResponse = {
  name: 'Plan de definición',
  calories: 2000.4,
  protein: 150,
  carbs: 200,
  fats: 66.6,
  advice: 'Prioriza la proteína en cada comida.',
  restrictions: ['Alergia al maní', ''],
  exchanges: [{ name: 'Proteínas', qty: 12 }, { name: 'Harinas', qty: '7' }, { name: '', qty: '1' }],
  equivalences: [
    { group: 'Harinas', food: 'Tortilla de maíz', quantity: 1, unit: 'unidad' },
    { group: 'Harinas', food: 'Pan', quantity: 0, unit: 'g' },
  ],
  meals: [
    {
      type: 'Desayuno',
      slot: 'breakfast',
      options: [{ title: 'Avena con leche', macros: { calories: 999, protein: 1, carbs: 1, fats: 1 }, ingredients: [oats, milk] }],
    },
    {
      type: 'Media mañana',
      slot: 'snack',
      options: [{ title: 'Fruta', macros: { calories: 80, protein: 1, carbs: 20, fats: 0 }, ingredients: [{ name: 'Manzana', quantity: 1, unit: 'unidad' }] }],
    },
    { type: 'Cena', slot: 'dinner', options: [] },
  ],
};

describe('normalizeNutritionPlan', () => {
  const plan = normalizeNutritionPlan(modelResponse);

  it('rounds the daily goals and keeps restrictions, exchanges and valid equivalences', () => {
    expect(plan).toMatchObject({ name: 'Plan de definición', calories: 2000, protein: 150, carbs: 200, fats: 67 });
    expect(plan.restrictions).toEqual(['Alergia al maní']);
    expect(plan.exchanges).toEqual([
      { name: 'Proteínas', qty: '12' },
      { name: 'Harinas', qty: '7' },
    ]);
    expect(plan.equivalences).toEqual([{ group: 'Harinas', food: 'Tortilla de maíz', quantity: 1, unit: 'unidad' }]);
  });

  it("an option's macros are the sum of its ingredients when all have macros", () => {
    expect(plan.meals[0].options[0].macros).toEqual({ calories: 233, protein: 13, carbs: 39, fats: 3 });
  });

  it("falls back to the model's option total when an ingredient lacks macros", () => {
    expect(plan.meals[1].options[0].macros).toEqual({ calories: 80, protein: 1, carbs: 20, fats: 0 });
  });

  it('fixes an invalid slot from the meal label, and drops meals without options', () => {
    expect(plan.meals.map((meal) => [meal.type, meal.slot])).toEqual([
      ['Desayuno', 'breakfast'],
      ['Media mañana', 'morning_snack'],
    ]);
  });

  it('omits equivalences when the plan has none', () => {
    expect(normalizeNutritionPlan({ ...modelResponse, equivalences: [] })).not.toHaveProperty('equivalences');
  });
});
