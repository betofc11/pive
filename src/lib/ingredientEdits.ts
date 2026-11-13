import { type IngredientWithMacros, rescaleIngredient } from '../../functions/src/shared/ingredients';
import type { Macros } from '../../functions/src/shared/macros';

/** An ingredient while the user edits a meal */
export interface EditableIngredient extends IngredientWithMacros {
  /**
   * Last quantity whose macros are known. Scaling always starts from here, so clearing the quantity
   * to type a new one doesn't lose the macros. Never saved.
   */
  base?: { quantity: number; macros: Macros };
}

export type IngredientField = 'name' | 'quantity' | 'unit';

const withBase = (ingredient: IngredientWithMacros): EditableIngredient =>
  ingredient.macros && ingredient.quantity > 0
    ? { ...ingredient, base: { quantity: ingredient.quantity, macros: ingredient.macros } }
    : { ...ingredient };

export function toEditableIngredients(list: IngredientWithMacros[] | undefined): EditableIngredient[] {
  return (list ?? []).map(withBase);
}

/** "1,5" (Spanish decimal comma) and "1.5" are both 1.5; anything else is 0 */
export function parseQuantity(value: string): number {
  const quantity = parseFloat(value.replace(',', '.'));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

/**
 * Applies what the user typed in one field. Changing only the quantity scales the macros, without the AI.
 * Changing the name or the unit changes what the ingredient is, so its macros are dropped and recalculated on save.
 */
export function applyIngredientEdit(ingredient: EditableIngredient, field: IngredientField, value: string): EditableIngredient {
  const { base, macros: _macros, ...rest } = ingredient;

  if (field !== 'quantity') return { ...rest, [field]: value };

  const quantity = parseQuantity(value);
  if (!base) return { ...rest, quantity };
  const scaled = rescaleIngredient({ ...rest, quantity: base.quantity, macros: base.macros }, quantity);
  return { ...scaled, base };
}

/** What gets saved: no empty rows and no editing state (Firestore rejects undefined fields too). */
export function toSavedIngredients(list: EditableIngredient[]): IngredientWithMacros[] {
  return list
    .filter((ingredient) => ingredient.name.trim())
    .map(({ name, quantity, unit, macros }) => (macros ? { name: name.trim(), quantity, unit, macros } : { name: name.trim(), quantity, unit }));
}
