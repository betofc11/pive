import { isMacros, roundMacros, scaleMacros, subtractMacros, sumMacros, ZERO_MACROS } from './macros';

const chicken = { calories: 165, protein: 31, carbs: 0, fats: 3.6 };
const rice = { calories: 130, protein: 2.7, carbs: 28, fats: 0.3 };

describe('sumMacros', () => {
  it('returns zero for an empty list', () => {
    expect(sumMacros([])).toEqual(ZERO_MACROS);
  });

  it('adds field by field', () => {
    expect(sumMacros([chicken, rice])).toEqual({ calories: 295, protein: 33.7, carbs: 28, fats: 3.9 });
  });

  it('does not mutate ZERO_MACROS', () => {
    sumMacros([chicken]);
    expect(ZERO_MACROS).toEqual({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  });
});

it('scaleMacros multiplies every field', () => {
  expect(scaleMacros({ calories: 100, protein: 10, carbs: 20, fats: 4 }, 1.5)).toEqual({
    calories: 150,
    protein: 15,
    carbs: 30,
    fats: 6,
  });
});

it('subtractMacros subtracts field by field and can go negative', () => {
  expect(subtractMacros({ calories: 2000, protein: 150, carbs: 200, fats: 60 }, { calories: 2100, protein: 100, carbs: 50, fats: 60 })).toEqual({
    calories: -100,
    protein: 50,
    carbs: 150,
    fats: 0,
  });
});

it('roundMacros rounds everything to integers, without -0', () => {
  const rounded = roundMacros({ calories: 295.5, protein: 33.7, carbs: 27.49, fats: -0.2 });
  expect(rounded).toEqual({ calories: 296, protein: 34, carbs: 27, fats: 0 });
  expect(Object.is(rounded.fats, -0)).toBe(false);
});

describe('isMacros', () => {
  it('accepts the four fields as finite numbers', () => {
    expect(isMacros(chicken)).toBe(true);
  });

  it.each([null, undefined, 'x', {}, { calories: 1, protein: 1, carbs: 1 }, { ...chicken, fats: NaN }, { ...chicken, protein: '31' }])(
    'rejects %p',
    (value) => {
      expect(isMacros(value)).toBe(false);
    },
  );
});
