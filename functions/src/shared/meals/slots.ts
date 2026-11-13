// Meal slots ("tiempos de comida"). Only the enums for now: the logic to suggest a slot arrives in phase 1.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.

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
