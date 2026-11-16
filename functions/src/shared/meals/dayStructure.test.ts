import {
  buildDayStructure,
  DEFAULT_DAY_STRUCTURE,
  DEFAULT_WINDOWS,
  deriveDayStructureFromPlan,
  normalizeWeights,
  resolveDayStructure,
  sanitizeDayStructure,
} from './dayStructure';
import type { PlanLike } from './plan';

const kcal = (calories: number) => ({ calories, protein: 0, carbs: 0, fats: 0 });
const option = (title: string, calories?: number) => ({ title, ingredients: [], ...(calories ? { macros: kcal(calories) } : {}) });

const weightsOf = (s: { slots: { slot: string; weight: number }[] }) => Object.fromEntries(s.slots.map((x) => [x.slot, x.weight]));
const total = (s: { slots: { weight: number }[] }) => s.slots.reduce((sum, x) => sum + x.weight, 0);

describe('normalizeWeights', () => {
  it('gives whole numbers that add up to exactly 100', () => {
    expect(normalizeWeights([25, 35, 30])).toEqual([28, 39, 33]);
    expect(normalizeWeights([1, 1, 1])).toEqual([34, 33, 33]);
    expect(normalizeWeights([0, 0])).toEqual([50, 50]);
    expect(normalizeWeights([])).toEqual([]);
  });
});

it('the default structure is breakfast 25 · lunch 35 · afternoon snack 10 · dinner 30, with the default windows', () => {
  expect(DEFAULT_DAY_STRUCTURE.source).toBe('default');
  expect(weightsOf(DEFAULT_DAY_STRUCTURE)).toEqual({ breakfast: 25, lunch: 35, afternoon_snack: 10, dinner: 30 });
  expect(DEFAULT_DAY_STRUCTURE.slots.map((s) => s.window)).toEqual([
    DEFAULT_WINDOWS.breakfast,
    DEFAULT_WINDOWS.lunch,
    DEFAULT_WINDOWS.afternoon_snack,
    DEFAULT_WINDOWS.dinner,
  ]);
});

it('buildDayStructure sorts the slots by the day and keeps one per slot', () => {
  const s = buildDayStructure('user', [
    { slot: 'dinner', weight: 1 },
    { slot: 'breakfast', weight: 1 },
    { slot: 'dinner', weight: 5 },
  ]);
  expect(s.slots.map((x) => x.slot)).toEqual(['breakfast', 'dinner']);
  expect(total(s)).toBe(100);
});

describe('deriveDayStructureFromPlan', () => {
  it('weighs each slot by the average kcal of its options, normalized to 100', () => {
    const plan: PlanLike = {
      meals: [
        { type: 'Desayuno', slot: 'breakfast', options: [option('A', 350), option('B', 450)] },
        { type: 'Almuerzo', slot: 'lunch', options: [option('A', 600)] },
        { type: 'Cena', slot: 'dinner', options: [option('A', 400)] },
        // A second category in the same slot adds up
        { type: 'Snack nocturno', slot: 'dinner', options: [option('A', 100)] },
      ],
    };
    const s = deriveDayStructureFromPlan(plan)!;
    expect(s.source).toBe('plan');
    // 400 · 600 · (400 + 100) of 1500
    expect(weightsOf(s)).toEqual({ breakfast: 27, lunch: 40, dinner: 33 });
    expect(total(s)).toBe(100);
  });

  it('deduces the slot of old plans from the category name', () => {
    const s = deriveDayStructureFromPlan({
      meals: [
        { type: 'Desayuno', options: [option('A', 500)] },
        { type: 'Merienda', options: [option('A', 500)] },
      ],
    })!;
    expect(weightsOf(s)).toEqual({ breakfast: 50, afternoon_snack: 50 });
  });

  it('uses the default weights of its slots if any slot has no macros', () => {
    const s = deriveDayStructureFromPlan({
      meals: [
        { type: 'Desayuno', options: [option('A', 500)] },
        { type: 'Almuerzo', options: [option('A')] },
        { type: 'Cena', options: [option('A', 500)] },
      ],
    })!;
    // 25 / 35 / 30 normalized
    expect(weightsOf(s)).toEqual({ breakfast: 28, lunch: 39, dinner: 33 });
  });

  it('is null without slots it can recognize', () => {
    expect(deriveDayStructureFromPlan(undefined)).toBeNull();
    expect(deriveDayStructureFromPlan({ meals: [] })).toBeNull();
    expect(deriveDayStructureFromPlan({ meals: [{ type: 'Bebidas', options: [option('A', 100)] }] })).toBeNull();
    expect(deriveDayStructureFromPlan({ meals: [{ type: 'Cena', options: [] }] })).toBeNull();
  });
});

describe('sanitizeDayStructure', () => {
  const valid = {
    source: 'user',
    slots: [
      { slot: 'breakfast', weight: 30, window: { start: '06:00', end: '09:00' } },
      { slot: 'dinner', weight: 70, window: { start: '19:00', end: '21:30' } },
    ],
  };

  it('accepts a valid structure and normalizes it as the user’s', () => {
    expect(sanitizeDayStructure(valid)).toEqual({ ...valid, source: 'user' });
  });

  it.each([
    ['not an object', 'nope'],
    ['no slots', { slots: [] }],
    ['an unknown slot', { slots: [{ slot: 'extra', weight: 10, window: { start: '06:00', end: '07:00' } }] }],
    ['a window that ends before it starts', { slots: [{ slot: 'dinner', weight: 10, window: { start: '23:00', end: '00:30' } }] }],
    ['a bad time', { slots: [{ slot: 'dinner', weight: 10, window: { start: '7pm', end: '21:00' } }] }],
    ['a negative weight', { slots: [{ slot: 'dinner', weight: -1, window: { start: '19:00', end: '21:00' } }] }],
    ['a repeated slot', { slots: [valid.slots[1], valid.slots[1]] }],
  ])('rejects %s', (_, value) => {
    expect(sanitizeDayStructure(value)).toBeNull();
  });
});

describe('resolveDayStructure', () => {
  const plan: PlanLike = { meals: [{ type: 'Almuerzo', slot: 'lunch', options: [option('A', 600)] }] };
  const userStructure = { source: 'user', slots: [{ slot: 'dinner', weight: 100, window: { start: '19:00', end: '22:00' } }] };

  it('prefers what the user configured, then the plan, then the default', () => {
    expect(resolveDayStructure({ dayStructure: userStructure, nutritionalPlan: plan }).source).toBe('user');
    expect(resolveDayStructure({ nutritionalPlan: plan }).source).toBe('plan');
    expect(resolveDayStructure({})).toBe(DEFAULT_DAY_STRUCTURE);
  });

  it('ignores a broken saved structure', () => {
    expect(resolveDayStructure({ dayStructure: { slots: 'x' }, nutritionalPlan: plan }).source).toBe('plan');
  });
});
