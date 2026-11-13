// Macros of a list of ingredients. Pure (no SDK imports), so the root Jest can test it.
import { NUTRITION_RULES } from "../prompts/nutrition";
import type { IngredientsMacros } from "../../shared/api";
import type { IngredientWithMacros } from "../../shared/ingredients";
import { sumMacros } from "../../shared/macros";
import { asArray, asObject, cleanIngredient, cleanIngredients } from "./normalize";

const INGREDIENTS_TASK = `# Tu tarea: macros de una lista de ingredientes
Recibes una lista de ingredientes en JSON, cada uno con nombre, cantidad y unidad.

- Devuelve los mismos ingredientes, en el mismo orden y con el mismo nombre, cantidad y unidad, agregando los macros de esa cantidad de cada uno.
- No agregues, quites ni juntes ingredientes, y no cambies cantidades ni unidades.
- Si la unidad es casera o ambigua (taza, porción, rebanada), asume la medida más común.`;

export const INGREDIENTS_INSTRUCTION = `${NUTRITION_RULES}\n\n${INGREDIENTS_TASK}`;

/** The most ingredients a request can have (a saved meal allows up to 50) */
export const MAX_INGREDIENTS = 50;

/** The ingredients the client sent, cleaned. Those that already have macros don't need the AI. */
export function parseRequestedIngredients(value: unknown): IngredientWithMacros[] {
  return asArray(value)
    .slice(0, MAX_INGREDIENTS)
    .map((item) => cleanIngredient(item))
    .filter((item): item is IngredientWithMacros => item !== null);
}

/** What goes to the model: only name, quantity and unit of the ingredients without macros. */
export function ingredientsToEstimate(requested: IngredientWithMacros[]): Omit<IngredientWithMacros, "macros">[] {
  return requested.filter((ingredient) => !ingredient.macros).map(({ name, quantity, unit }) => ({ name, quantity, unit }));
}

/**
 * Puts the model's macros on the ingredients that lacked them, keeping the user's names, quantities and units.
 * If the model returned a different number of ingredients they can't be matched one by one: those stay without
 * macros, but the model's macros still count in the totals.
 */
export function mergeIngredientMacros(requested: IngredientWithMacros[], modelResponse: unknown): IngredientsMacros {
  const estimated = cleanIngredients(asObject(modelResponse).ingredients);
  const missing = requested.filter((ingredient) => !ingredient.macros).length;
  const matched = estimated.length === missing;

  let next = 0;
  const ingredients = requested.map((ingredient) => {
    if (ingredient.macros) return ingredient;
    const macros = matched ? estimated[next++].macros : undefined;
    return macros ? { ...ingredient, macros } : ingredient;
  });

  const totals = sumMacros([
    ...ingredients.flatMap((ingredient) => (ingredient.macros ? [ingredient.macros] : [])),
    ...(matched ? [] : estimated.flatMap((ingredient) => (ingredient.macros ? [ingredient.macros] : []))),
  ]);
  return { ...totals, ingredients };
}
