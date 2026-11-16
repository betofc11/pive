// The structure of the user's day: which meal slots they eat, when, and how much of the day each one weighs.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { clockToMinutes } from '../dates';
import { averageOptionKcal, categorySlot, type PlanLike } from './plan';
import { isPlannedSlot, PLANNED_SLOTS, type PlannedSlot } from './slots';

/** Local 'HH:mm', start before end (a window can't cross midnight) */
export interface SlotWindow {
  start: string;
  end: string;
}

export interface DayStructureSlot {
  slot: PlannedSlot;
  /** Share of the day, in %. The weights of a structure add up to 100. */
  weight: number;
  window: SlotWindow;
}

export interface DayStructure {
  /** 'user' is the only one that gets saved; the plan's and the default are calculated on the fly */
  source: 'plan' | 'user' | 'default';
  /** In the order of the day (PLANNED_SLOTS) */
  slots: DayStructureSlot[];
}

/** They overlap on purpose: where they do, the size of the meal decides. */
export const DEFAULT_WINDOWS: Record<PlannedSlot, SlotWindow> = {
  breakfast: { start: '05:00', end: '10:30' },
  morning_snack: { start: '10:00', end: '11:30' },
  lunch: { start: '11:00', end: '15:30' },
  afternoon_snack: { start: '15:00', end: '18:30' },
  dinner: { start: '18:30', end: '23:00' },
};

/** Weight of each slot when nothing else says it. Normalized to 100 with the slots a structure has. */
export const DEFAULT_WEIGHTS: Record<PlannedSlot, number> = {
  breakfast: 25,
  morning_snack: 10,
  lunch: 35,
  afternoon_snack: 10,
  dinner: 30,
};

const DEFAULT_SLOTS: PlannedSlot[] = ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];

/** Whole numbers that add up to exactly 100, proportional to `weights` (largest remainder). All 0 → equal. */
export function normalizeWeights(weights: number[]): number[] {
  if (weights.length === 0) return [];
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  const exact = total > 0 ? clean.map((w) => (w / total) * 100) : clean.map(() => 100 / clean.length);
  const result = exact.map(Math.floor);
  let missing = 100 - result.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((value, i) => ({ i, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder);
  for (const { i } of byRemainder) {
    if (missing <= 0) break;
    result[i] += 1;
    missing -= 1;
  }
  return result;
}

/** A structure from a list of slots in any order: sorted by the day, one entry per slot, weights normalized. */
export function buildDayStructure(
  source: DayStructure['source'],
  slots: Array<{ slot: PlannedSlot; weight: number; window?: SlotWindow }>,
): DayStructure {
  const unique = PLANNED_SLOTS.map((slot) => slots.find((s) => s.slot === slot)).filter(
    (s): s is { slot: PlannedSlot; weight: number; window?: SlotWindow } => Boolean(s),
  );
  const weights = normalizeWeights(unique.map((s) => s.weight));
  return {
    source,
    slots: unique.map((s, i) => ({ slot: s.slot, weight: weights[i], window: s.window ?? DEFAULT_WINDOWS[s.slot] })),
  };
}

/** Breakfast 25 · lunch 35 · afternoon snack 10 · dinner 30 */
export const DEFAULT_DAY_STRUCTURE: DayStructure = buildDayStructure(
  'default',
  DEFAULT_SLOTS.map((slot) => ({ slot, weight: DEFAULT_WEIGHTS[slot] })),
);

/**
 * The structure a nutrition plan implies: its slots, each weighing the average kcal of its options
 * (two categories in the same slot, like Cena and Snack nocturno, add up). If any slot has no macros,
 * every slot takes its default weight. Null if no category maps to a slot.
 */
export function deriveDayStructureFromPlan(plan: PlanLike | null | undefined): DayStructure | null {
  const kcalBySlot = new Map<PlannedSlot, number | null>();
  for (const category of plan?.meals ?? []) {
    const slot = categorySlot(category);
    if (!slot || (category.options?.length ?? 0) === 0) continue;
    const kcal = averageOptionKcal(category);
    const previous = kcalBySlot.get(slot);
    if (previous === undefined) kcalBySlot.set(slot, kcal);
    else kcalBySlot.set(slot, previous === null || kcal === null ? null : previous + kcal);
  }
  if (kcalBySlot.size === 0) return null;

  const entries = [...kcalBySlot.entries()];
  const allKnown = entries.every(([, kcal]) => kcal !== null && kcal > 0);
  return buildDayStructure(
    'plan',
    entries.map(([slot, kcal]) => ({ slot, weight: allKnown ? (kcal as number) : DEFAULT_WEIGHTS[slot] })),
  );
}

const isWindow = (value: unknown): value is SlotWindow => {
  const w = value as SlotWindow | null;
  if (!w || typeof w !== 'object') return false;
  const start = clockToMinutes(w.start);
  const end = clockToMinutes(w.end);
  return start !== null && end !== null && start < end;
};

/** The structure the user saved, checked field by field (it comes from Firestore), or null if it's not valid. */
export function sanitizeDayStructure(value: unknown): DayStructure | null {
  const raw = value as { slots?: unknown } | null;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.slots)) return null;
  const slots: Array<{ slot: PlannedSlot; weight: number; window: SlotWindow }> = [];
  for (const item of raw.slots as Array<Partial<DayStructureSlot>>) {
    if (!item || !isPlannedSlot(item.slot) || !isWindow(item.window)) return null;
    if (typeof item.weight !== 'number' || !Number.isFinite(item.weight) || item.weight < 0) return null;
    if (slots.some((s) => s.slot === item.slot)) return null;
    slots.push({ slot: item.slot, weight: item.weight, window: { start: item.window.start, end: item.window.end } });
  }
  if (slots.length === 0) return null;
  return buildDayStructure('user', slots);
}

/** Priority: what the user configured > the plan's > the default. */
export function resolveDayStructure(p: { dayStructure?: unknown; nutritionalPlan?: PlanLike | null }): DayStructure {
  return sanitizeDayStructure(p.dayStructure) ?? deriveDayStructureFromPlan(p.nutritionalPlan) ?? DEFAULT_DAY_STRUCTURE;
}
