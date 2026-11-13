import { ingredientsToEstimate, MAX_INGREDIENTS, mergeIngredientMacros, parseRequestedIngredients } from './ingredients';

const egg = { name: 'Huevo', quantity: 2, unit: 'unidad', macros: { calories: 143, protein: 12.6, carbs: 0.7, fats: 9.5 } };
const toast = { name: 'Pan integral', quantity: 2, unit: 'rebanadas' };
const avocado = { name: 'Aguacate', quantity: 50, unit: 'g' };

describe('parseRequestedIngredients', () => {
  it('cleans what the client sends and rounds the macros it already has', () => {
    expect(parseRequestedIngredients([egg, toast, { quantity: 3 }, 'nope'])).toEqual([
      { ...egg, macros: { calories: 143, protein: 13, carbs: 1, fats: 10 } },
      toast,
    ]);
  });

  it(`keeps at most ${MAX_INGREDIENTS} ingredients`, () => {
    expect(parseRequestedIngredients(Array.from({ length: 60 }, () => toast))).toHaveLength(MAX_INGREDIENTS);
  });
});

it('ingredientsToEstimate only sends name, quantity and unit of those without macros', () => {
  expect(ingredientsToEstimate(parseRequestedIngredients([egg, toast, avocado]))).toEqual([toast, avocado]);
});

describe('mergeIngredientMacros', () => {
  const requested = parseRequestedIngredients([egg, toast, avocado]);

  it("puts the model's macros on the missing ones, keeping the user's names and units", () => {
    const result = mergeIngredientMacros(requested, {
      ingredients: [
        { name: 'Pan integral tostado', quantity: 60, unit: 'g', macros: { calories: 150, protein: 7, carbs: 25, fats: 2 } },
        { name: 'Aguacate', quantity: 50, unit: 'g', macros: { calories: 80, protein: 1, carbs: 4, fats: 7.4 } },
      ],
    });

    expect(result.ingredients).toEqual([
      requested[0],
      { ...toast, macros: { calories: 150, protein: 7, carbs: 25, fats: 2 } },
      { ...avocado, macros: { calories: 80, protein: 1, carbs: 4, fats: 7 } },
    ]);
    expect(result).toMatchObject({ calories: 373, protein: 21, carbs: 30, fats: 19 });
  });

  it('with no ingredients to estimate it only adds them up', () => {
    const allKnown = parseRequestedIngredients([egg, { ...avocado, macros: { calories: 80, protein: 1, carbs: 4, fats: 7 } }]);
    expect(mergeIngredientMacros(allKnown, {})).toMatchObject({ calories: 223, protein: 14, carbs: 5, fats: 17 });
  });

  it('if the model returns a different number of ingredients, they stay without macros but count in the totals', () => {
    const result = mergeIngredientMacros(requested, {
      ingredients: [{ name: 'Pan con aguacate', quantity: 1, unit: 'porcion', macros: { calories: 230, protein: 8, carbs: 29, fats: 9 } }],
    });
    expect(result.ingredients).toEqual(requested);
    expect(result).toMatchObject({ calories: 373, protein: 21, carbs: 30, fats: 19 });
  });
});
