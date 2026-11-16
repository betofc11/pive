import { buildDayStructure, DEFAULT_DAY_STRUCTURE, DEFAULT_WEIGHTS } from './dayStructure';
import {
  inferSlot,
  isMealSlot,
  isPlannedSlot,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  type MealSlot,
  PLANNED_SLOTS,
  resolveMealSlots,
  slotFromLabel,
  suggestMealSlot,
  type SuggestSlotInput,
} from './slots';

describe('slotFromLabel', () => {
  it.each([
    ['Desayuno', 'breakfast'],
    ['DESAYUNO (7:00 am)', 'breakfast'],
    ['Media mañana', 'morning_snack'],
    ['Merienda AM', 'morning_snack'],
    ['Snack de la mañana', 'morning_snack'],
    ['Almuerzo', 'lunch'],
    ['Comida', 'lunch'],
    ['Merienda', 'afternoon_snack'],
    ['Merienda PM', 'afternoon_snack'],
    ['Media tarde', 'afternoon_snack'],
    ['Snack', 'afternoon_snack'],
    ['Cena', 'dinner'],
    ['Snack nocturno', 'dinner'],
  ])('%s → %s', (label, slot) => {
    expect(slotFromLabel(label)).toBe(slot);
  });

  it.each(['', '   ', 'Opciones libres', 'Bebidas'])('returns null for an unknown label (%p)', (label) => {
    expect(slotFromLabel(label)).toBeNull();
  });
});

it('has a label for every slot and plans every slot but extra', () => {
  expect(Object.keys(MEAL_SLOT_LABELS).sort()).toEqual([...MEAL_SLOTS].sort());
  expect(PLANNED_SLOTS).toEqual(MEAL_SLOTS.filter((slot) => slot !== 'extra'));
});

it('isMealSlot and isPlannedSlot validate values from outside', () => {
  expect(isMealSlot('extra')).toBe(true);
  expect(isPlannedSlot('extra')).toBe(false);
  expect(isPlannedSlot('lunch')).toBe(true);
  expect(isMealSlot('Almuerzo')).toBe(false);
  expect(isMealSlot(null)).toBe(false);
});

// ---------------------------------------------------------------------------------------------------------------

const goals = { calories: 2000, protein: 150, carbs: 200, fats: 67 };
const kcal = (calories: number) => ({ calories, protein: 0, carbs: 0, fats: 0 });
const logged = (slot: MealSlot, time: string, calories = 400) => ({ slot, time, macros: kcal(calories) });
const breakfast = logged('breakfast', '07:30', 450);

const withMorningSnack = buildDayStructure(
  'user',
  (['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'] as const).map((slot) => ({ slot, weight: DEFAULT_WEIGHTS[slot] })),
);

const suggest = (input: Partial<SuggestSlotInput> & Pick<SuggestSlotInput, 'time' | 'calories'>) =>
  suggestMealSlot({ isToday: true, structure: DEFAULT_DAY_STRUCTURE, goals, dayMeals: [], ...input });

describe('suggestMealSlot (default structure, 2,000 kcal)', () => {
  it.each<[string, Partial<SuggestSlotInput> & Pick<SuggestSlotInput, 'time' | 'calories'>, MealSlot, string]>([
    ['restaurant lunch at 12:20', { time: '12:20', calories: 950, dayMeals: [breakfast] }, 'lunch', 'time'],
    ['yogurt at 11:15, no morning snack in the structure', { time: '11:15', calories: 180, dayMeals: [breakfast] }, 'extra', 'size'],
    [
      'yogurt at 11:15, with a morning snack',
      { time: '11:15', calories: 180, dayMeals: [breakfast], structure: withMorningSnack },
      'morning_snack',
      'size',
    ],
    ['a full plate at 16:30: late lunch', { time: '16:30', calories: 900, dayMeals: [breakfast] }, 'lunch', 'late'],
    ['dessert at 13:10 after lunch at 12:30', { time: '13:10', calories: 200, dayMeals: [breakfast, logged('lunch', '12:30', 700)] }, 'lunch', 'same_slot'],
    [
      'cookies at 22:30 with everything logged',
      {
        time: '22:30',
        calories: 150,
        dayMeals: [breakfast, logged('lunch', '12:30'), logged('afternoon_snack', '16:00', 150), logged('dinner', '19:30')],
      },
      'extra',
      'fallback',
    ],
    ['the user said it was dinner', { time: '08:00', calories: 500, mentionedSlot: 'dinner' }, 'dinner', 'mentioned'],
    ['a plan option for lunch', { time: '20:00', calories: 500, planSlot: 'lunch' }, 'lunch', 'plan'],
    ['a past day with breakfast logged', { time: '23:50', calories: 500, isToday: false, dayMeals: [breakfast] }, 'lunch', 'first_unlogged'],
  ])('%s', (_, input, slot, reason) => {
    expect(suggest(input)).toEqual({ slot, reason });
  });

  it('a normal breakfast at 08:00 is breakfast, by the time', () => {
    expect(suggest({ time: '08:00', calories: 450 })).toEqual({ slot: 'breakfast', reason: 'time' });
  });

  it('a small afternoon snack at 16:30 stays a snack (not a late lunch)', () => {
    expect(suggest({ time: '16:30', calories: 200, dayMeals: [breakfast] })).toEqual({ slot: 'afternoon_snack', reason: 'time' });
  });

  it('what the user said wins over the plan, even on a past day', () => {
    expect(suggest({ time: '12:00', calories: 500, isToday: false, mentionedSlot: 'breakfast', planSlot: 'lunch' })).toEqual({
      slot: 'breakfast',
      reason: 'mentioned',
    });
  });

  it('a past day with every slot logged falls back to extra', () => {
    const all = DEFAULT_DAY_STRUCTURE.slots.map((s) => logged(s.slot, '12:00'));
    expect(suggest({ time: '12:00', calories: 300, isToday: false, dayMeals: all })).toEqual({ slot: 'extra', reason: 'fallback' });
  });

  it('without a calorie goal, sizes against a 2,000 kcal day', () => {
    expect(suggest({ time: '11:15', calories: 180, goals: kcal(0), dayMeals: [breakfast] })).toEqual({ slot: 'extra', reason: 'size' });
  });

  it('a bad time falls back to extra', () => {
    expect(suggest({ time: '7pm', calories: 300 })).toEqual({ slot: 'extra', reason: 'fallback' });
  });
});

describe('inferSlot and resolveMealSlots (old meals without a slot)', () => {
  const ctx = { structure: DEFAULT_DAY_STRUCTURE, goals };

  it('inferSlot suggests as if the meal had been logged at its time', () => {
    expect(inferSlot({ time: '12:20', macros: kcal(800) }, { ...ctx, dayMeals: [breakfast] })).toBe('lunch');
  });

  it('keeps saved slots and infers the rest in time order, each with the meals before it', () => {
    const meals = [
      { time: '13:05', macros: kcal(200) }, // dessert after lunch
      { time: '07:45', macros: kcal(450) },
      { slot: 'lunch', time: '12:40', macros: kcal(700) },
      { slot: 'dinner', time: '08:00', macros: kcal(300) }, // the user moved it: it stays
      { time: '22:40', macros: kcal(150) },
    ];
    expect(resolveMealSlots(meals, ctx)).toEqual(['lunch', 'breakfast', 'lunch', 'dinner', 'extra']);
  });

  it('ignores an invalid saved slot', () => {
    expect(resolveMealSlots([{ slot: 'brunch', time: '08:00', macros: kcal(400) }], ctx)).toEqual(['breakfast']);
  });
});
