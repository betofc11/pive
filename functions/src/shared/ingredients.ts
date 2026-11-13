// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { type Macros, isMacros, scaleMacros, sumMacros } from './macros';

/** Units the AI may use. User-facing values, so they stay in Spanish. */
export const INGREDIENT_UNITS = ['g', 'ml', 'unidad', 'taza', 'cucharada', 'cucharadita', 'rebanada', 'porcion'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export interface IngredientWithMacros {
  name: string;
  quantity: number;
  /** Free text: the user can type any unit, the AI uses INGREDIENT_UNITS */
  unit: string;
  /** Macros for `quantity` of this ingredient. Missing on data saved before phase 0 or typed by hand. */
  macros?: Macros;
}

/**
 * Changes the quantity of an ingredient. If it has macros and a quantity > 0, they are scaled proportionally
 * (100 g → 150 g multiplies them by 1.5). Otherwise the result has no macros, so they have to be calculated again.
 */
export function rescaleIngredient(prev: IngredientWithMacros, nextQuantity: number): IngredientWithMacros {
  const { macros, ...rest } = prev;
  const next: IngredientWithMacros = { ...rest, quantity: nextQuantity };
  if (macros && prev.quantity > 0 && nextQuantity > 0 && Number.isFinite(nextQuantity)) {
    next.macros = scaleMacros(macros, nextQuantity / prev.quantity);
  }
  return next;
}

/** Total macros of a meal, or null if any ingredient lacks macros (then the AI has to calculate them). */
export function mealMacrosFromIngredients(list: IngredientWithMacros[]): Macros | null {
  if (list.length === 0) return null;
  const all: Macros[] = [];
  for (const ingredient of list) {
    if (!isMacros(ingredient.macros)) return null;
    all.push(ingredient.macros);
  }
  return sumMacros(all);
}
