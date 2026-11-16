// Runs in America/New_York (jest.global-setup.js): meal times are ISO in UTC and the slots use the local time.
import {
  daySlotStatuses,
  normalizeClockInput,
  resolveDayMeals,
  SLOT_REASON_LABELS,
  slotSourceFromReason,
  suggestSlotForNewMeal,
} from './mealSlots';
import type { Meal, UserProfile } from '../types';

const at = (hours: number, minutes = 0) => new Date(2026, 10, 13, hours, minutes);
const meal = (id: string, time: Date, calories: number, extra: Partial<Meal> = {}): Meal => ({
  id,
  name: `Comida ${id}`,
  time: time.toISOString(),
  macros: { calories, protein: 20, carbs: 30, fats: 10 },
  ...extra,
});

const profile = { macroGoals: { calories: 2000, protein: 150, carbs: 200, fats: 60 } } as UserProfile;

it('has a label for every reason, and maps reasons to where the slot came from', () => {
  expect(Object.keys(SLOT_REASON_LABELS)).toHaveLength(8);
  expect(slotSourceFromReason('mentioned')).toBe('mentioned');
  expect(slotSourceFromReason('plan')).toBe('plan');
  expect(slotSourceFromReason('size')).toBe('suggested');
});

describe('resolveDayMeals', () => {
  it('uses the local time of each meal and infers the slot of old ones', () => {
    const meals = resolveDayMeals([meal('a', at(7, 45), 450), meal('b', at(12, 30), 700), meal('c', at(16, 0), 150, { slot: 'dinner' })], profile);
    expect(meals.map((m) => [m.localTime, m.slot])).toEqual([
      ['07:45', 'breakfast'],
      ['12:30', 'lunch'],
      ['16:00', 'dinner'],
    ]);
    expect(meals[0].id).toBe('a');
  });

  it('tolerates a day without meals', () => {
    expect(resolveDayMeals(undefined, null)).toEqual([]);
  });
});

describe('suggestSlotForNewMeal', () => {
  const dayMeals = [meal('a', at(7, 30), 450)];

  it('suggests by the time and size, with the local time', () => {
    expect(suggestSlotForNewMeal({ isToday: true, calories: 950, dayMeals, profile, now: at(12, 20) })).toEqual({ slot: 'lunch', reason: 'time' });
    expect(suggestSlotForNewMeal({ isToday: true, calories: 900, dayMeals, profile, now: at(16, 30) })).toEqual({ slot: 'lunch', reason: 'late' });
  });

  it('takes a meal of unknown size as a normal one: main at its time, never a late one', () => {
    expect(suggestSlotForNewMeal({ isToday: true, calories: null, dayMeals, profile, now: at(12, 20) }).slot).toBe('lunch');
    expect(suggestSlotForNewMeal({ isToday: true, calories: null, dayMeals, profile, now: at(16, 30) }).slot).toBe('afternoon_snack');
  });

  it('gives priority to what the user said and to the plan', () => {
    expect(suggestSlotForNewMeal({ isToday: true, calories: 300, dayMeals, profile, mentionedSlot: 'dinner', now: at(9) }).slot).toBe('dinner');
    expect(suggestSlotForNewMeal({ isToday: true, calories: 300, dayMeals, profile, planSlot: 'lunch', now: at(9) }).slot).toBe('lunch');
  });

  it('on another day suggests the first slot without meals', () => {
    expect(suggestSlotForNewMeal({ isToday: false, calories: 500, dayMeals, profile, now: at(23) })).toEqual({ slot: 'lunch', reason: 'first_unlogged' });
  });
});

it('daySlotStatuses splits the rest of the day among the slots to come', () => {
  const statuses = daySlotStatuses({ meals: [meal('a', at(7, 30), 900)] } as never, profile, true, at(11));
  expect(statuses.next).toBe('lunch');
  expect(statuses.slots.find((s) => s.slot === 'lunch')?.budget?.calories).toBe(513);
});

it.each([
  ['07:30', '07:30'],
  ['7:30', '07:30'],
  ['0730', '07:30'],
  [' 21:05 ', '21:05'],
  ['24:00', null],
  ['7:5', null],
  ['siete', null],
  ['', null],
])('normalizeClockInput(%p) → %p', (input, expected) => {
  expect(normalizeClockInput(input)).toBe(expected);
});
