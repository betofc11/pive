import { computeSlotStatuses } from './budget';
import { DEFAULT_DAY_STRUCTURE } from './dayStructure';
import type { MealSlot } from './slots';

const goals = { calories: 2000, protein: 150, carbs: 200, fats: 60 };
const meal = (slot: MealSlot, calories: number, protein = 0, carbs = 0, fats = 0) => ({ slot, macros: { calories, protein, carbs, fats } });

const run = (now: string, meals: ReturnType<typeof meal>[], isToday = true) =>
  computeSlotStatuses({ now, isToday, structure: DEFAULT_DAY_STRUCTURE, goals, meals });

const byslot = (result: ReturnType<typeof run>) => Object.fromEntries(result.slots.map((s) => [s.slot, s]));

it('only dinner left with 600 kcal: dinner gets all of it and is the last of the day', () => {
  const result = run('18:00', [meal('breakfast', 500), meal('lunch', 700), meal('afternoon_snack', 200)]);
  const { dinner } = byslot(result);
  expect(result.next).toBe('dinner');
  expect(dinner).toMatchObject({ state: 'next', isLastOfDay: true, light: false });
  expect(dinner.budget?.calories).toBe(600);
  expect(result.remaining.calories).toBe(600);
});

it('lunch, snack and dinner left with 1,100 kcal: split 35 / 10 / 30', () => {
  const result = run('11:00', [meal('breakfast', 900, 30, 100, 30)]);
  const slots = byslot(result);
  expect(slots.breakfast).toMatchObject({ state: 'logged', budget: null, consumed: { calories: 900, protein: 30, carbs: 100, fats: 30 } });
  expect(slots.lunch).toMatchObject({ state: 'next', budget: { calories: 513, protein: 56, carbs: 47, fats: 14 } });
  expect(slots.afternoon_snack).toMatchObject({ state: 'pending', budget: { calories: 147, protein: 16, carbs: 13, fats: 4 } });
  expect(slots.dinner).toMatchObject({ state: 'pending', isLastOfDay: true, budget: { calories: 440, protein: 48, carbs: 40, fats: 12 } });
  expect(result.remaining).toEqual({ calories: 1100, protein: 120, carbs: 100, fats: 30 });
});

it('a slot whose window passed without meals is missed, with no budget', () => {
  const result = run('12:00', []);
  const slots = byslot(result);
  expect(slots.breakfast).toMatchObject({ state: 'missed', budget: null, isLastOfDay: false });
  expect(result.next).toBe('lunch');
  // The missed breakfast reserves nothing: the whole day goes to the slots still to come (35 / 10 / 30)
  expect(slots.lunch.budget?.calories).toBe(933);
});

it('within 30 minutes of the end of its window a slot is still to come', () => {
  expect(byslot(run('10:55', [])).breakfast.state).toBe('next');
  expect(byslot(run('11:01', [])).breakfast.state).toBe('missed');
});

it('nothing left of the day: every slot to come is light, with a zero budget', () => {
  const result = run('13:00', [meal('breakfast', 1500, 40, 150, 60), meal('lunch', 700, 50, 60, 20)]);
  const slots = byslot(result);
  expect(result.remaining.calories).toBe(-200);
  expect(slots.afternoon_snack).toMatchObject({ state: 'next', light: true });
  expect(slots.dinner).toMatchObject({ state: 'pending', light: true });
  expect(slots.dinner.budget?.calories).toBe(0);
  // Protein is still short: it keeps a budget, so Pive can still point at protein
  expect(slots.dinner.budget?.protein).toBeGreaterThan(0);
  expect(slots.breakfast.light).toBe(false);
});

it('extras count in what was eaten but reserve nothing', () => {
  const result = run('11:00', [meal('breakfast', 500), meal('extra', 300)]);
  expect(result.extras.calories).toBe(300);
  expect(result.remaining.calories).toBe(1200);
  expect(result.slots.map((s) => s.slot)).not.toContain('extra');
  expect(byslot(result).lunch.budget?.calories).toBe(560); // 1200 × 35 / 75
});

it('a meal in a slot the structure lacks counts as an extra', () => {
  const result = run('11:00', [meal('breakfast', 500), meal('morning_snack', 200)]);
  expect(result.extras.calories).toBe(200);
  expect(byslot(result).breakfast.consumed.calories).toBe(500);
});

it('on another day nothing is missed by the time: the first slot without meals is next', () => {
  const result = run('23:30', [meal('lunch', 700)], false);
  const slots = byslot(result);
  expect(slots.breakfast.state).toBe('next');
  expect(slots.dinner.state).toBe('pending');
  expect(result.next).toBe('breakfast');
});

it('with every slot logged there is no next', () => {
  const result = run('21:00', DEFAULT_DAY_STRUCTURE.slots.map((s) => meal(s.slot, 400)));
  expect(result.next).toBeNull();
  expect(result.slots.every((s) => s.state === 'logged' && !s.isLastOfDay)).toBe(true);
});
