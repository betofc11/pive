// TODO(fase-3): quitar ruta vieja. The daily advice as it was before phase 1, for apps that still send
// { dailyMacros, goals, meals, currentTime }. Pure (no SDK imports), so the root Jest can test it.
import { PIVE_CORE } from "../prompts/core";
import { NUTRITION_RULES } from "../prompts/nutrition";
import { isMacros, type Macros, roundMacros, subtractMacros, ZERO_MACROS } from "../../shared/macros";
import { isDateKey, weekdayLabel } from "../../shared/dates";

const LEGACY_ADVICE_TASK = `# Tu tarea: el consejo del día
Da un consejo nutricional sumamente corto: máximo 2 frases.

1. Mira la hora actual y las comidas registradas hoy para deducir en qué momento del día está el usuario (si ya desayunó, si le toca el almuerzo, la merienda o la cena).
2. Adapta la recomendación de manera realista:
   - Si es tarde o de noche (después de las 19:00 o 20:00) y le faltan muchas calorías o macros, recomiéndale la mejor cena o snack nocturno para cerrar el día de forma práctica, priorizando proteína y sin forzarlo a comer de más si ya es muy tarde.
   - Si es de mañana o mediodía, dile qué priorizar en su próxima comida para mantenerse en camino.
3. Nombra alimentos naturales específicos (ej. pechuga de pollo, huevos, avena, aguacate) que le ayuden a completar lo que le falta hoy.
4. Habla de nutrición, alimentos y energía. No menciones peso, grasa corporal ni masa muscular.`;

export const LEGACY_ADVICE_INSTRUCTION = `${PIVE_CORE}\n\n${NUTRITION_RULES}\n\n${LEGACY_ADVICE_TASK}`;

/** The advice request as it arrives: from any client version, so nothing is trusted */
export interface LegacyAdviceInput {
  dailyMacros?: unknown;
  goals?: unknown;
  meals?: unknown;
  currentTime?: unknown;
  localDate?: unknown;
}

const toMacros = (value: unknown): Macros => (isMacros(value) ? value : ZERO_MACROS);

const formatMacros = (m: Macros) => {
  const r = roundMacros(m);
  return `${r.calories} kcal · proteína ${r.protein} g · carbohidratos ${r.carbs} g · grasa ${r.fats} g`;
};

const formatMeals = (meals: unknown): string => {
  if (!Array.isArray(meals) || meals.length === 0) return "- Ninguna todavía";
  return meals
    .map((meal) => {
      const { name, time, macros } = (meal ?? {}) as { name?: unknown; time?: unknown; macros?: unknown };
      const label = typeof name === "string" && name.trim() ? name.trim() : "Comida";
      const at = typeof time === "string" && time ? `${time} · ` : "";
      return `- ${at}${label} · ${formatMacros(toMacros(macros))}`;
    })
    .join("\n");
};

/** The user's data for the advice, with every number already calculated (the remaining macros never go below 0). */
export function buildLegacyAdviceContents({ dailyMacros, goals, meals, currentTime, localDate }: LegacyAdviceInput): string {
  const consumed = toMacros(dailyMacros);
  const goal = toMacros(goals);
  const diff = subtractMacros(goal, consumed);
  const remaining: Macros = {
    calories: Math.max(0, diff.calories),
    protein: Math.max(0, diff.protein),
    carbs: Math.max(0, diff.carbs),
    fats: Math.max(0, diff.fats),
  };

  const lines = [];
  if (isDateKey(localDate)) lines.push(`Fecha del usuario: ${weekdayLabel(localDate)} ${localDate}`);
  lines.push(`Hora actual del usuario: ${typeof currentTime === "string" && currentTime ? currentTime : "No provista"}`);
  lines.push(`Meta diaria: ${formatMacros(goal)}`);
  lines.push(`Consumido hoy: ${formatMacros(consumed)}`);
  lines.push(`Le falta hoy: ${formatMacros(remaining)}`);
  lines.push(`Comidas registradas hoy:\n${formatMeals(meals)}`);
  return lines.join("\n");
}
