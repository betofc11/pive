import { FOOD_INSTRUCTION, normalizeFoodAnalysis } from './food';
import { NUTRITION_RULES } from '../prompts/nutrition';

const modelResponse = {
  name: 'Pollo con arroz',
  ingredients: [
    { name: 'Pechuga de pollo a la plancha', quantity: 150, unit: 'g', macros: { calories: 247.6, protein: 46.4, carbs: 0, fats: 5.4 } },
    { name: 'Arroz blanco cocido', quantity: 150, unit: 'g', macros: { calories: 195, protein: 4, carbs: 42, fats: 0.4 } },
    { name: 'Aceite de oliva', quantity: 1, unit: 'cucharada', macros: { calories: 119, protein: 0, carbs: 0, fats: 13.5 } },
  ],
  assumptions: ['Asumí 1 cucharada de aceite para cocinar', '  ', 'Asumí arroz cocido'],
  mentionedSlot: 'lunch',
};

it('the instruction starts with the nutrition rules and forbids guessing the slot from the photo', () => {
  expect(FOOD_INSTRUCTION.startsWith(NUTRITION_RULES)).toBe(true);
  expect(FOOD_INSTRUCTION).toMatch(/No lo deduzcas de la foto/);
});

describe('normalizeFoodAnalysis', () => {
  it('calculates the meal macros in code as the sum of the rounded ingredients', () => {
    const result = normalizeFoodAnalysis(modelResponse);
    expect(result.ingredients.map((i) => i.macros)).toEqual([
      { calories: 248, protein: 46, carbs: 0, fats: 5 },
      { calories: 195, protein: 4, carbs: 42, fats: 0 },
      { calories: 119, protein: 0, carbs: 0, fats: 14 },
    ]);
    expect(result.macros).toEqual({ calories: 562, protein: 50, carbs: 42, fats: 19 });
  });

  it('keeps the name, the non-empty assumptions and a valid mentioned slot', () => {
    const result = normalizeFoodAnalysis(modelResponse);
    expect(result.name).toBe('Pollo con arroz');
    expect(result.assumptions).toEqual(['Asumí 1 cucharada de aceite para cocinar', 'Asumí arroz cocido']);
    expect(result.mentionedSlot).toBe('lunch');
  });

  it('turns an unknown slot into null', () => {
    expect(normalizeFoodAnalysis({ ...modelResponse, mentionedSlot: 'Almuerzo' }).mentionedSlot).toBeNull();
    expect(normalizeFoodAnalysis({ ...modelResponse, mentionedSlot: undefined }).mentionedSlot).toBeNull();
  });

  it('survives an empty or broken response', () => {
    expect(normalizeFoodAnalysis({})).toEqual({
      name: 'Comida',
      macros: { calories: 0, protein: 0, carbs: 0, fats: 0 },
      ingredients: [],
      assumptions: [],
      mentionedSlot: null,
    });
    expect(normalizeFoodAnalysis({ ingredients: [{ quantity: 10 }, { name: 'Sal', quantity: -1, unit: '' }] }).ingredients).toEqual([
      { name: 'Sal', quantity: 0, unit: 'g' },
    ]);
  });
});
