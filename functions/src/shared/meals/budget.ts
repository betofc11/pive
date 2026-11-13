// What's left of the day, split among the slots still to come.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { clockToMinutes } from '../dates';
import { isMacros, type Macros, roundMacros, subtractMacros, sumMacros, ZERO_MACROS } from '../macros';
import type { DayStructure } from './dayStructure';
import { hasSlotWindowPassed, isPlannedSlot, type MealSlot, type PlannedSlot } from './slots';

export type SlotState = 'logged' | 'next' | 'pending' | 'missed';

export interface SlotStatus {
  slot: PlannedSlot;
  state: SlotState;
  /** What its meals add up to (zero if it has none) */
  consumed: Macros;
  /** Its share of what's left of the day; null if logged or missed */
  budget: Macros | null;
  /** The last slot still to come today */
  isLastOfDay: boolean;
  /** Nothing left of the day's kcal: keep it light (protein and vegetables), never skip it */
  light: boolean;
}

/**
 * budget(slot) = what's left of the day × weight(slot) / sum of the weights of the slots still to come,
 * for kcal and for each macro. Every number comes rounded to whole kcal and grams.
 *
 * - A slot with meals is `logged`. A slot without meals whose window passed (today only) is `missed`:
 *   it gets no budget, so Pive asks instead of assuming. The first of the rest is `next`.
 * - Meals in `extra`, or in a slot the structure doesn't have, count in `extras`: they use up the day but
 *   don't reserve anything.
 */
export function computeSlotStatuses(input: {
  /** Local "HH:mm" */
  now: string;
  /** On other days the time says nothing, so no slot is `missed` */
  isToday: boolean;
  structure: DayStructure;
  goals: Macros;
  meals: Array<{ slot: MealSlot; macros: Macros }>;
}): { slots: SlotStatus[]; remaining: Macros; extras: Macros; next: PlannedSlot | null } {
  const { structure } = input;
  const goals = isMacros(input.goals) ? input.goals : ZERO_MACROS;
  const nowMin = clockToMinutes(input.now);
  const inStructure = new Set<MealSlot>(structure.slots.map((s) => s.slot));

  const bySlot = new Map<PlannedSlot, Macros[]>();
  const extras: Macros[] = [];
  const all: Macros[] = [];
  for (const meal of input.meals) {
    if (!isMacros(meal.macros)) continue;
    all.push(meal.macros);
    if (isPlannedSlot(meal.slot) && inStructure.has(meal.slot)) bySlot.set(meal.slot, [...(bySlot.get(meal.slot) ?? []), meal.macros]);
    else extras.push(meal.macros);
  }

  const remaining = subtractMacros(goals, sumMacros(all));

  const states: SlotState[] = structure.slots.map((s) => {
    if (bySlot.has(s.slot)) return 'logged';
    if (input.isToday && nowMin !== null && hasSlotWindowPassed(s.window, nowMin)) return 'missed';
    return 'pending';
  });
  const nextIndex = states.indexOf('pending');
  if (nextIndex >= 0) states[nextIndex] = 'next';

  const open = (i: number) => states[i] === 'next' || states[i] === 'pending';
  const openIndexes = structure.slots.map((_, i) => i).filter(open);
  const openWeight = openIndexes.reduce((sum, i) => sum + structure.slots[i].weight, 0);
  const shareOf = (i: number) =>
    openWeight > 0 ? structure.slots[i].weight / openWeight : openIndexes.length > 0 ? 1 / openIndexes.length : 0;
  const left: Macros = {
    calories: Math.max(0, remaining.calories),
    protein: Math.max(0, remaining.protein),
    carbs: Math.max(0, remaining.carbs),
    fats: Math.max(0, remaining.fats),
  };
  const lastOpen = openIndexes[openIndexes.length - 1];

  const slots: SlotStatus[] = structure.slots.map((s, i) => {
    const share = shareOf(i);
    return {
      slot: s.slot,
      state: states[i],
      consumed: roundMacros(sumMacros(bySlot.get(s.slot) ?? [])),
      budget: open(i)
        ? roundMacros({
            calories: left.calories * share,
            protein: left.protein * share,
            carbs: left.carbs * share,
            fats: left.fats * share,
          })
        : null,
      isLastOfDay: i === lastOpen,
      light: open(i) && remaining.calories <= 0,
    };
  });

  return {
    slots,
    remaining: roundMacros(remaining),
    extras: roundMacros(sumMacros(extras)),
    next: nextIndex >= 0 ? structure.slots[nextIndex].slot : null,
  };
}
