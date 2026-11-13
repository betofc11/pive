// Extract a nutrition plan from an image, a PDF or text. Pure (no SDK imports), so the root Jest can test it.
import { NUTRITION_RULES } from "../prompts/nutrition";
import type { NutritionPlanAnalysis, NutritionPlanEquivalence, NutritionPlanMeal, NutritionPlanOption } from "../../shared/api";
import { mealMacrosFromIngredients } from "../../shared/ingredients";
import { isPlannedSlot, slotFromLabel } from "../../shared/meals/slots";
import { asArray, asNumber, asObject, asText, asTextList, cleanIngredients, cleanMacros } from "./normalize";

const NUTRITION_PLAN_TASK = `# Tu tarea: extraer un plan nutricional
Recibes un plan nutricional (imagen, PDF o texto). Extrae de forma estructurada:

1. Las metas diarias del plan: calorías, proteína, carbohidratos y grasa.
2. "advice": una recomendación breve y personalizada en español, basada en el plan.
3. "restrictions": alergias, intolerancias y alimentos que el plan prohíbe o pide evitar, tal como los dice el plan. Vacío si no hay.
4. "exchanges": los grupos de intercambio diarios y su cantidad, si el plan los trae.
5. "equivalences": la tabla de equivalencias (cuánto de cada alimento cuenta como una porción de su grupo), solo si el plan la trae. No la inventes.
6. "meals": cada tiempo de comida del plan, con:
   - "type": el nombre tal como lo dice el plan;
   - "slot": el tiempo normalizado. Un snack nocturno va en dinner. Si el plan tiene una sola merienda, decide por su horario o su posición entre las comidas;
   - "options": cada opción de menú, con su título, sus ingredientes con la cantidad que indica el plan, los macros de cada ingrediente y los de la opción completa.
7. Respeta las cantidades del plan. Pasa una medida casera a gramos solo cuando la equivalencia sea clara.
8. Si el plan no da los macros de una opción o de un ingrediente, estímalos con las reglas de nutrición.
9. Todo el texto en español.`;

export const NUTRITION_PLAN_INSTRUCTION = `${NUTRITION_RULES}\n\n${NUTRITION_PLAN_TASK}`;

const roundGoal = (value: unknown) => {
  const n = asNumber(value);
  return n !== undefined && n > 0 ? Math.round(n) : undefined;
};

const normalizeOption = (value: unknown): NutritionPlanOption | null => {
  const raw = asObject(value);
  const title = asText(raw.title);
  if (!title) return null;
  const ingredients = cleanIngredients(raw.ingredients);
  const option: NutritionPlanOption = { title, ingredients };
  // The total of an option is the sum of its ingredients, so adjusting a portion later keeps the numbers consistent
  const macros = mealMacrosFromIngredients(ingredients) ?? cleanMacros(raw.macros);
  if (macros) option.macros = macros;
  return option;
};

const normalizeMeal = (value: unknown): NutritionPlanMeal | null => {
  const raw = asObject(value);
  const type = asText(raw.type);
  const options = asArray(raw.options)
    .map(normalizeOption)
    .filter((option): option is NutritionPlanOption => option !== null);
  if (!type || options.length === 0) return null;
  const meal: NutritionPlanMeal = { type, options };
  const slot = isPlannedSlot(raw.slot) ? raw.slot : slotFromLabel(type);
  if (slot) meal.slot = slot;
  return meal;
};

const normalizeEquivalence = (value: unknown): NutritionPlanEquivalence | null => {
  const raw = asObject(value);
  const group = asText(raw.group);
  const food = asText(raw.food);
  const quantity = asNumber(raw.quantity);
  const unit = asText(raw.unit);
  return group && food && unit && quantity !== undefined && quantity > 0 ? { group, food, quantity, unit } : null;
};

export function normalizeNutritionPlan(rawValue: unknown): NutritionPlanAnalysis {
  const raw = asObject(rawValue);
  const exchanges = asArray(raw.exchanges)
    .map((value) => {
      const item = asObject(value);
      const name = asText(item.name);
      const qty = typeof item.qty === "number" ? String(item.qty) : asText(item.qty);
      return name && qty ? { name, qty } : null;
    })
    .filter((item): item is { name: string; qty: string } => item !== null);
  const equivalences = asArray(raw.equivalences)
    .map(normalizeEquivalence)
    .filter((item): item is NutritionPlanEquivalence => item !== null);

  const plan: NutritionPlanAnalysis = {
    name: asText(raw.name, "Plan Extraído"),
    calories: roundGoal(raw.calories),
    protein: roundGoal(raw.protein),
    carbs: roundGoal(raw.carbs),
    fats: roundGoal(raw.fats),
    advice: asText(raw.advice),
    restrictions: asTextList(raw.restrictions),
    exchanges,
    meals: asArray(raw.meals)
      .map(normalizeMeal)
      .filter((meal): meal is NutritionPlanMeal => meal !== null),
  };
  if (equivalences.length > 0) plan.equivalences = equivalences;
  return plan;
}
