import { isMealSlot, isPlannedSlot, MEAL_SLOT_LABELS, MEAL_SLOTS, PLANNED_SLOTS, slotFromLabel } from './slots';

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
