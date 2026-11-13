// Estimate a meal from a photo, a description or both. Pure (no SDK imports), so the root Jest can test it.
import { NUTRITION_RULES } from "../prompts/nutrition";
import type { FoodAnalysis } from "../../shared/api";
import { sumMacros } from "../../shared/macros";
import { isMealSlot } from "../../shared/meals/slots";
import { asObject, asText, asTextList, cleanIngredients } from "./normalize";

const FOOD_TASK = `# Tu tarea: estimar una comida
Recibes la foto de una comida, una descripción del usuario o ambas.

1. Identifica el plato y dale un nombre corto en español.
2. Lista cada ingrediente con su cantidad estimada y los macros de esa cantidad. No calcules el total del plato: lo suma la app.
3. Si hay foto y descripción, la descripción manda: úsala para corregir cantidades, ingredientes o preparación que la foto no muestra.
4. En "assumptions", anota en frases cortas lo que supusiste y el usuario podría querer corregir (ej. "Asumí 1 cucharada de aceite para cocinar", "Asumí arroz cocido"). Si no supusiste nada importante, déjalo vacío.
5. "mentionedSlot": solo si el usuario dice explícitamente qué comida es ("mi almuerzo", "la cena de hoy", "snack de la tarde"). No lo deduzcas de la foto, del tipo de plato ni de la hora: si no lo dice, null. Valores: breakfast = desayuno, morning_snack = merienda de la mañana, lunch = almuerzo o comida, afternoon_snack = merienda de la tarde, dinner = cena, extra = un snack fuera de sus comidas.
6. Todo el texto en español.`;

export const FOOD_INSTRUCTION = `${NUTRITION_RULES}\n\n${FOOD_TASK}`;

export function normalizeFoodAnalysis(raw: unknown): FoodAnalysis {
  const data = asObject(raw);
  const ingredients = cleanIngredients(data.ingredients);
  return {
    name: asText(data.name, "Comida"),
    macros: sumMacros(ingredients.flatMap((ingredient) => (ingredient.macros ? [ingredient.macros] : []))),
    ingredients,
    assumptions: asTextList(data.assumptions),
    mentionedSlot: isMealSlot(data.mentionedSlot) ? data.mentionedSlot : null,
  };
}
