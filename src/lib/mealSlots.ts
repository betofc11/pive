// Meal slots on the app side: the shared logic (functions/src/shared/meals) applied to Firestore data,
// where meal times are ISO strings and old meals have no slot.
import { getLocalTimeString } from './utils';
import type { DailyLog, Meal, UserProfile } from '../types';
import { clockToMinutes } from '../../functions/src/shared/dates';
import { isMacros, type Macros, ZERO_MACROS } from '../../functions/src/shared/macros';
import { computeSlotStatuses } from '../../functions/src/shared/meals/budget';
import { type DayStructure, resolveDayStructure } from '../../functions/src/shared/meals/dayStructure';
import {
  type MealSlot,
  type PlannedSlot,
  REFERENCE_DAILY_KCAL,
  resolveMealSlots,
  type SlotReason,
  type SlotSource,
  suggestMealSlot,
} from '../../functions/src/shared/meals/slots';

/** Why a slot was suggested, under the chips of FoodDialog */
export const SLOT_REASON_LABELS: Record<SlotReason, string> = {
  time: 'Sugerido por la hora',
  mentioned: 'Lo dijiste en la descripción',
  plan: 'De tu plan',
  size: 'Por la cantidad',
  late: 'Por la cantidad: parece una comida tardía',
  same_slot: 'Va con lo que comiste hace poco',
  first_unlogged: 'El primer tiempo sin registrar de ese día',
  fallback: 'Fuera de tus tiempos del día',
};

export const slotSourceFromReason = (reason: SlotReason): SlotSource =>
  reason === 'mentioned' ? 'mentioned' : reason === 'plan' ? 'plan' : 'suggested';

/** The macro goals, or zeros (the slot logic then sizes against a 2,000 kcal day) */
export const goalsOf = (profile: UserProfile | null | undefined): Macros =>
  isMacros(profile?.macroGoals) ? profile.macroGoals : ZERO_MACROS;

export const structureOf = (profile: UserProfile | null | undefined): DayStructure =>
  resolveDayStructure({ dayStructure: profile?.dayStructure, nutritionalPlan: profile?.nutritionalPlan });

export interface ResolvedMeal extends Meal {
  slot: MealSlot;
  /** Local HH:mm */
  localTime: string;
}

/** The day's meals with their slot: the saved one, or inferred for meals saved before slots existed. */
export function resolveDayMeals(meals: Meal[] | null | undefined, profile: UserProfile | null | undefined): ResolvedMeal[] {
  const list = (meals ?? []).map((meal) => ({ ...meal, localTime: getLocalTimeString(meal.time) }));
  const slots = resolveMealSlots(
    list.map((m) => ({ slot: m.slot, time: m.localTime, macros: m.macros })),
    { structure: structureOf(profile), goals: goalsOf(profile) },
  );
  return list.map((meal, i) => ({ ...meal, slot: slots[i] }));
}

/**
 * A meal whose macros aren't known yet (typed by hand, calculated on save) is taken as 15% of the day: enough
 * for a main meal at its time, too little to look like a late one. The slot is suggested again on save.
 */
export const UNKNOWN_MEAL_SHARE = 0.15;

export function suggestSlotForNewMeal(input: {
  isToday: boolean;
  /** null if not known yet */
  calories: number | null;
  dayMeals: Meal[] | null | undefined;
  profile: UserProfile | null | undefined;
  mentionedSlot?: MealSlot | null;
  planSlot?: PlannedSlot | null;
  now?: Date;
}): { slot: MealSlot; reason: SlotReason } {
  const goals = goalsOf(input.profile);
  const daily = goals.calories > 0 ? goals.calories : REFERENCE_DAILY_KCAL;
  return suggestMealSlot({
    time: getLocalTimeString(input.now ?? new Date()),
    isToday: input.isToday,
    calories: input.calories ?? daily * UNKNOWN_MEAL_SHARE,
    structure: structureOf(input.profile),
    goals,
    dayMeals: resolveDayMeals(input.dayMeals, input.profile).map((m) => ({ slot: m.slot, time: m.localTime, macros: m.macros })),
    mentionedSlot: input.mentionedSlot,
    planSlot: input.planSlot,
  });
}

/** The slots of a day with their budgets: the same numbers the advice uses. */
export function daySlotStatuses(log: DailyLog | null | undefined, profile: UserProfile | null | undefined, isToday: boolean, now = new Date()) {
  return computeSlotStatuses({
    now: getLocalTimeString(now),
    isToday,
    structure: structureOf(profile),
    goals: goalsOf(profile),
    meals: resolveDayMeals(log?.meals, profile),
  });
}

/** A time typed by the user: "7:00" or "0700" → "07:00"; null if it's not a valid time */
export function normalizeClockInput(value: string): string | null {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const clock = `${match[1].padStart(2, '0')}:${match[2]}`;
  return clockToMinutes(clock) === null ? null : clock;
}
