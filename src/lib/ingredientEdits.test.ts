import { applyIngredientEdit, parseQuantity, toEditableIngredients, toSavedIngredients } from './ingredientEdits';

const chicken = { name: 'Pechuga de pollo', quantity: 100, unit: 'g', macros: { calories: 165, protein: 31, carbs: 0, fats: 4 } };
const [editable] = toEditableIngredients([chicken]);

it('parseQuantity accepts a decimal comma or point', () => {
  expect(parseQuantity('1,5')).toBe(1.5);
  expect(parseQuantity('1.5')).toBe(1.5);
  expect(parseQuantity('')).toBe(0);
  expect(parseQuantity('-2')).toBe(0);
});

describe('applyIngredientEdit', () => {
  it('changing only the quantity scales the macros', () => {
    expect(applyIngredientEdit(editable, 'quantity', '150').macros).toEqual({ calories: 247.5, protein: 46.5, carbs: 0, fats: 6 });
  });

  it('clearing the quantity and typing it again keeps the macros', () => {
    const cleared = applyIngredientEdit(editable, 'quantity', '');
    expect(cleared.quantity).toBe(0);
    expect(cleared.macros).toBeUndefined();
    const retyped = applyIngredientEdit(applyIngredientEdit(cleared, 'quantity', '2'), 'quantity', '200');
    expect(retyped.macros).toEqual({ calories: 330, protein: 62, carbs: 0, fats: 8 });
  });

  it.each(['name', 'unit'] as const)('changing the %s drops the macros so they are recalculated', (field) => {
    const edited = applyIngredientEdit(editable, field, 'otro');
    expect(edited[field]).toBe('otro');
    expect(edited.macros).toBeUndefined();
    expect(applyIngredientEdit(edited, 'quantity', '200').macros).toBeUndefined();
  });

  it('an ingredient without macros just takes the new quantity', () => {
    const [plain] = toEditableIngredients([{ name: 'Huevo', quantity: 2, unit: 'unidad' }]);
    expect(applyIngredientEdit(plain, 'quantity', '3')).toEqual({ name: 'Huevo', quantity: 3, unit: 'unidad' });
  });
});

it('toSavedIngredients drops empty rows and the editing state', () => {
  const list = [applyIngredientEdit(editable, 'quantity', '150'), { name: '  ', quantity: 0, unit: 'g' }, { name: ' Sal ', quantity: 1, unit: 'g' }];
  expect(toSavedIngredients(list)).toEqual([
    { name: 'Pechuga de pollo', quantity: 150, unit: 'g', macros: { calories: 247.5, protein: 46.5, carbs: 0, fats: 6 } },
    { name: 'Sal', quantity: 1, unit: 'g' },
  ]);
});
