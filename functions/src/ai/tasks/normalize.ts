// Helpers to validate what the model returns. A response schema guides the model but doesn't guarantee the values.
import type { IngredientWithMacros } from "../../shared/ingredients";
import { isMacros, type Macros, roundMacros } from "../../shared/macros";

export type Json = Record<string, unknown>;

export const asObject = (value: unknown): Json => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {});

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const asText = (value: unknown, fallback = ""): string => (typeof value === "string" && value.trim() ? value.trim() : fallback);

export const asNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** Non-empty strings, trimmed */
export const asTextList = (value: unknown): string[] => asArray(value).map((item) => asText(item)).filter(Boolean);

/** Integers, never negative: a model can return -0.4 g of fat */
export const cleanMacros = (value: unknown): Macros | undefined => {
  if (!isMacros(value)) return undefined;
  return roundMacros({
    calories: Math.max(0, value.calories),
    protein: Math.max(0, value.protein),
    carbs: Math.max(0, value.carbs),
    fats: Math.max(0, value.fats),
  });
};

/** An ingredient from the model or the client, or null if it has no name. Macros are kept only if valid. */
export const cleanIngredient = (value: unknown, defaultUnit = "g"): IngredientWithMacros | null => {
  const raw = asObject(value);
  const name = asText(raw.name);
  if (!name) return null;
  const quantity = asNumber(raw.quantity);
  const ingredient: IngredientWithMacros = {
    name,
    quantity: quantity !== undefined && quantity > 0 ? quantity : 0,
    unit: asText(raw.unit, defaultUnit),
  };
  const macros = cleanMacros(raw.macros);
  if (macros) ingredient.macros = macros;
  return ingredient;
};

export const cleanIngredients = (value: unknown): IngredientWithMacros[] =>
  asArray(value)
    .map((item) => cleanIngredient(item))
    .filter((item): item is IngredientWithMacros => item !== null);
