// Meal slots ("tiempos de comida"): the enums, and suggesting the slot of a meal when it's logged.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { clockToMinutes } from '../dates';
import type { Macros } from '../macros';
import type { DayStructure, SlotWindow } from './dayStructure';

export const MEAL_SLOTS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'extra'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Slots a nutrition plan can define. `extra` is for whatever falls outside the plan. */
export type PlannedSlot = Exclude<MealSlot, 'extra'>;
export const PLANNED_SLOTS: readonly PlannedSlot[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Desayuno',
  morning_snack: 'Merienda AM',
  lunch: 'Almuerzo',
  afternoon_snack: 'Merienda PM',
  dinner: 'Cena',
  extra: 'Snack',
};

export function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === 'string' && (MEAL_SLOTS as readonly string[]).includes(value);
}

export function isPlannedSlot(value: unknown): value is PlannedSlot {
  return typeof value === 'string' && (PLANNED_SLOTS as readonly string[]).includes(value);
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Checked in order, so the specific patterns ("merienda de la tarde", "snack nocturno") go before the generic ones
const LABEL_PATTERNS: { slot: PlannedSlot; pattern: RegExp }[] = [
  { slot: 'morning_snack', pattern: /\b(media manana|merienda (am|de la manana|manana|matutina)|(snack|refrigerio|colacion|tentempie) (am|de la manana|manana|matutin[oa])|almuerzo ligero|onces de la manana|brunch)\b/ },
  { slot: 'afternoon_snack', pattern: /\b(media tarde|merienda (pm|de la tarde|tarde|vespertina)|(snack|refrigerio|colacion) (pm|de la tarde|tarde|vespertin[oa])|pre ?entreno|post ?entreno|onces)\b/ },
  { slot: 'dinner', pattern: /\b(cena|cenar|(snack|merienda|colacion|refrigerio) (nocturn[oa]|de la noche|noche)|antes de dormir)\b/ },
  { slot: 'breakfast', pattern: /\b(desayuno|desayunar|al despertar|en ayunas)\b/ },
  { slot: 'lunch', pattern: /\b(almuerzo|almorzar|comida|lonche)\b/ },
  // A plain "merienda", "snack" or "refrigerio" is most often the afternoon one
  { slot: 'afternoon_snack', pattern: /\b(merienda|snack|refrigerio|colacion|tentempie)\b/ },
];

/**
 * Maps a meal label from a nutrition plan ("Desayuno", "Media mañana", "Comida"…) to its slot.
 * For plans saved before meals had a `slot`. Returns null if the label is not recognized.
 */
export function slotFromLabel(label: string): PlannedSlot | null {
  const text = normalize(label);
  if (!text) return null;
  return LABEL_PATTERNS.find(({ pattern }) => pattern.test(text))?.slot ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Suggesting the slot of a new meal. In code, not with the AI: instant, free and predictable, and the same for
// photos, manual entries, favorites and plan options. The AI only helps when the user says it ("mi almuerzo").

/** Where the slot of a saved meal came from */
export type SlotSource = 'suggested' | 'mentioned' | 'plan' | 'user';

export type SlotReason =
  | 'mentioned' // the user said it in the description
  | 'plan' // a plan option, which has its slot
  | 'time' // a pending slot whose window has the time
  | 'size' // overlapping windows, or too small for a main meal: the quantity decided
  | 'late' // big enough for a main meal whose window passed without a meal (late lunch)
  | 'same_slot' // close to a meal already in that slot (dessert goes with lunch)
  | 'first_unlogged' // a past day: the time says nothing, so the first slot without meals
  | 'fallback'; // nothing fits: extra

export interface SuggestSlotInput {
  /** Local "HH:mm" */
  time: string;
  isToday: boolean;
  calories: number;
  structure: DayStructure;
  goals: Macros;
  /** The meals already logged that day; `time` is the local "HH:mm" */
  dayMeals: Array<{ slot?: MealSlot; time: string; macros: Macros }>;
  mentionedSlot?: MealSlot | null;
  planSlot?: PlannedSlot | null;
}

/** A window "has" a time up to this many minutes before its start and after its end */
export const SLOT_WINDOW_TOLERANCE_MIN = 30;
/** A main meal (breakfast, lunch, dinner) needs at least this share of its slot's planned kcal */
export const MAIN_MEAL_MIN_SHARE = 0.3;
/** A late main meal, outside its window, needs at least this share of its slot's planned kcal */
export const LATE_MEAL_MIN_SHARE = 0.6;
/** Something logged this close to a meal of a slot, inside its window, goes with it */
export const SAME_SLOT_MAX_GAP_MIN = 60;
/** Daily kcal used to size the slots when the user has no calorie goal */
export const REFERENCE_DAILY_KCAL = 2000;

const MAIN_MEALS: readonly PlannedSlot[] = ['breakfast', 'lunch', 'dinner'];
export const isMainMeal = (slot: MealSlot): boolean => (MAIN_MEALS as readonly string[]).includes(slot);

export function isInSlotWindow(window: SlotWindow, minutes: number): boolean {
  const start = clockToMinutes(window.start);
  const end = clockToMinutes(window.end);
  if (start === null || end === null) return false;
  return minutes >= start - SLOT_WINDOW_TOLERANCE_MIN && minutes <= end + SLOT_WINDOW_TOLERANCE_MIN;
}

export function hasSlotWindowPassed(window: SlotWindow, minutes: number): boolean {
  const end = clockToMinutes(window.end);
  return end !== null && minutes > end + SLOT_WINDOW_TOLERANCE_MIN;
}

/**
 * Suggests the slot of a new meal. In order: what the user said, the plan, the time, the size, and `extra`.
 * The sizes compare against each slot's planned kcal (daily goal × weight), not what's left today: being over
 * or under for the day doesn't change what a meal looks like.
 */
export function suggestMealSlot(input: SuggestSlotInput): { slot: MealSlot; reason: SlotReason } {
  if (isMealSlot(input.mentionedSlot)) return { slot: input.mentionedSlot, reason: 'mentioned' };
  if (isPlannedSlot(input.planSlot)) return { slot: input.planSlot, reason: 'plan' };

  const { structure, dayMeals, calories } = input;
  const logged = new Set<MealSlot>(dayMeals.map((m) => m.slot).filter(isMealSlot));

  if (!input.isToday) {
    const first = structure.slots.find((s) => !logged.has(s.slot));
    return first ? { slot: first.slot, reason: 'first_unlogged' } : { slot: 'extra', reason: 'fallback' };
  }

  const now = clockToMinutes(input.time);
  if (now === null) return { slot: 'extra', reason: 'fallback' };

  const dailyKcal = input.goals.calories > 0 ? input.goals.calories : REFERENCE_DAILY_KCAL;
  const plannedKcal = (weight: number) => (dailyKcal * weight) / 100;

  const candidates = structure.slots.filter((s) => isInSlotWindow(s.window, now));
  const pending = candidates.filter((s) => !logged.has(s.slot));

  // 1. A pending main meal whose window has the time, if the meal is big enough for it
  const main = pending.find((s) => isMainMeal(s.slot) && calories >= MAIN_MEAL_MIN_SHARE * plannedKcal(s.weight));
  if (main) return { slot: main.slot, reason: pending.length > 1 ? 'size' : 'time' };

  // 2. A late main meal: big enough for one whose window already passed without meals (the latest one)
  const late = [...structure.slots]
    .reverse()
    .find(
      (s) =>
        isMainMeal(s.slot) &&
        !logged.has(s.slot) &&
        hasSlotWindowPassed(s.window, now) &&
        calories >= LATE_MEAL_MIN_SHARE * plannedKcal(s.weight),
    );
  if (late) return { slot: late.slot, reason: 'late' };

  // 3. A pending snack whose window has the time
  const rejectedMain = pending.some((s) => isMainMeal(s.slot));
  const snack = pending.find((s) => !isMainMeal(s.slot));
  if (snack) return { slot: snack.slot, reason: rejectedMain ? 'size' : 'time' };

  // 4. Right after a meal of a slot whose window has the time (dessert after lunch)
  const same = candidates.find(
    (s) =>
      logged.has(s.slot) &&
      dayMeals.some((m) => {
        const at = clockToMinutes(m.time);
        return m.slot === s.slot && at !== null && Math.abs(now - at) <= SAME_SLOT_MAX_GAP_MIN;
      }),
  );
  if (same) return { slot: same.slot, reason: 'same_slot' };

  // 5. Too small for the main meal of the moment, and no snack then
  if (rejectedMain) return { slot: 'extra', reason: 'size' };
  return { slot: 'extra', reason: 'fallback' };
}

/** The slot of an old meal saved without one, as if it had been suggested when it was logged. */
export function inferSlot(
  meal: { time: string; macros: Macros },
  ctx: Omit<SuggestSlotInput, 'time' | 'calories' | 'isToday'>,
): MealSlot {
  return suggestMealSlot({ ...ctx, time: meal.time, calories: meal.macros?.calories ?? 0, isToday: true }).slot;
}

/**
 * The slot of each meal of a day, in the same order: the saved one, or inferred for older meals. Each meal is
 * inferred with the meals logged before it (by time), as when it was logged. `time` is the local "HH:mm".
 */
export function resolveMealSlots(
  meals: Array<{ slot?: unknown; time: string; macros: Macros }>,
  ctx: { structure: DayStructure; goals: Macros },
): MealSlot[] {
  const result: Array<MealSlot | null> = meals.map((m) => (isMealSlot(m.slot) ? m.slot : null));
  const minutesOf = (i: number) => clockToMinutes(meals[i].time) ?? Number.MAX_SAFE_INTEGER;
  const order = meals.map((_, i) => i).sort((a, b) => minutesOf(a) - minutesOf(b) || a - b);

  for (const i of order) {
    if (result[i] !== null) continue;
    const before = order
      .filter((j) => j !== i && minutesOf(j) <= minutesOf(i) && result[j] !== null)
      .map((j) => ({ slot: result[j] as MealSlot, time: meals[j].time, macros: meals[j].macros }));
    result[i] = inferSlot(meals[i], { ...ctx, dayMeals: before });
  }
  return result as MealSlot[];
}
