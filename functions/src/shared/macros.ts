// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export const ZERO_MACROS: Macros = Object.freeze({ calories: 0, protein: 0, carbs: 0, fats: 0 });

const mapMacros = (m: Macros, fn: (value: number) => number): Macros => ({
  calories: fn(m.calories),
  protein: fn(m.protein),
  carbs: fn(m.carbs),
  fats: fn(m.fats),
});

export function sumMacros(list: Macros[]): Macros {
  return list.reduce<Macros>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fats: acc.fats + m.fats,
    }),
    { ...ZERO_MACROS },
  );
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return mapMacros(m, (value) => value * factor);
}

/** a - b, field by field. It can go negative: clamping is the caller's decision. */
export function subtractMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories - b.calories,
    protein: a.protein - b.protein,
    carbs: a.carbs - b.carbs,
    fats: a.fats - b.fats,
  };
}

/** Everything to whole numbers: kcal and grams are always shown as integers. */
export function roundMacros(m: Macros): Macros {
  // `+ 0` turns the -0 that Math.round gives for values in (-0.5, 0] into 0
  return mapMacros(m, (value) => Math.round(value) + 0);
}

/** True if the value has the four macro fields as finite numbers. For data that comes from outside (AI, Firestore). */
export function isMacros(value: unknown): value is Macros {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (['calories', 'protein', 'carbs', 'fats'] as const).every(
    (key) => typeof m[key] === 'number' && Number.isFinite(m[key]),
  );
}
