// Daily advice (since phase 1): the server reads the day from Firestore, calculates the slots, budgets and plan
// fits in code, and the model only picks among them and writes. Pure (no SDK imports), so the root Jest can test it.
import { PIVE_CORE } from "../prompts/core";
import { NUTRITION_RULES } from "../prompts/nutrition";
import { formatDayContext } from "../context/day";
import type { AdviceProposal } from "../../shared/api";
import { isoToLocalClock, utcOffsetFromLocalClock, weekdayLabel } from "../../shared/dates";
import type { IngredientWithMacros } from "../../shared/ingredients";
import { isMacros, type Macros, scaleMacros } from "../../shared/macros";
import { computeSlotStatuses } from "../../shared/meals/budget";
import { COMPLEMENTS } from "../../shared/meals/complements";
import { resolveDayStructure } from "../../shared/meals/dayStructure";
import { planCategoriesForSlot, planFoods, type PlanLike, type PlanOptionLike } from "../../shared/meals/plan";
import { buildMealFromFit, fitPlanOptions, type PlanOptionFit } from "../../shared/meals/planFit";
import { type PlannedSlot, resolveMealSlots } from "../../shared/meals/slots";

const ADVICE_TASK = `# Tu tarea: el consejo del día
Escribe un consejo sumamente corto, de máximo 2 frases, sobre la PRÓXIMA comida del usuario.

1. Habla solo de la comida marcada como PRÓXIMA. Si es la última del día, dilo.
2. Si hay plan para esa comida, recomienda UNA de sus opciones y, si le hace falta, UN complemento o UNA reducción de los que vienen debajo de ella. Di las cantidades tal como vienen.
3. Usa solo las cantidades del contexto: no sumes ni recalcules nada.
4. Si la comida está marcada como ligera, recomienda algo ligero con proteína y verduras. Nunca que se la salte.
5. Si una comida anterior quedó sin registrar, no asumas que no la comió: si importa, pregúntale en pocas palabras.
6. Si no quedan comidas pendientes, cierra el día con algo breve (hidratación, descanso) sin recomendar más comida.
7. Habla de nutrición, alimentos y energía. No menciones peso, grasa corporal ni masa muscular.

# Respuesta
- text: el consejo.
- optionIndex: el número de la opción del plan que recomiendas (Opción 1 → 1), o null si no recomiendas ninguna.
- complementIndex: el número del complemento de esa opción que recomiendas, o null.
- reductionIndex: el número de la reducción de esa opción que recomiendas, o null.`;

export const ADVICE_INSTRUCTION = `${PIVE_CORE}\n\n${NUTRITION_RULES}\n\n${ADVICE_TASK}`;

/** What the server read and calculated for the advice */
export interface DayAdvicePrep {
  /** The user's data for the model */
  contents: string;
  next: PlannedSlot | null;
  /** Fits of the plan options for the next slot (best first), or null without a plan for it */
  fits: PlanOptionFit[] | null;
  /** The options those fits refer to (by fit.optionIndex) */
  options: PlanOptionLike[];
}

const describeIngredients = (option: PlanOptionLike) =>
  (option.ingredients ?? [])
    .filter((i) => typeof i?.name === "string" && i.name.trim())
    .map((i) => `${i.name.trim()}${typeof i.quantity === "number" && i.quantity > 0 ? ` ${i.quantity}${i.unit ? ` ${i.unit}` : ""}` : ""}`)
    .join(" + ");

/**
 * Builds the advice context from the documents of users/{uid} and users/{uid}/dailyLogs/{localDate}, as they are
 * in Firestore (any age, so nothing is trusted). `localDate` and `localTime` must be valid; the meals' local
 * times are deduced from them (utcOffsetFromLocalClock). Null if the user has no macro goals.
 */
export function prepareDayAdvice(input: {
  profile: Record<string, unknown> | undefined;
  log: Record<string, unknown> | null | undefined;
  localDate: string;
  localTime: string;
  nowMs: number;
}): DayAdvicePrep | null {
  const profile = input.profile ?? {};
  const goals = profile.macroGoals;
  if (!isMacros(goals)) return null;

  const plan = (profile.nutritionalPlan ?? null) as PlanLike | null;
  const structure = resolveDayStructure({ dayStructure: profile.dayStructure, nutritionalPlan: plan });
  const offset = utcOffsetFromLocalClock(input.localDate, input.localTime, input.nowMs);

  const rawMeals = Array.isArray(input.log?.meals) ? (input.log?.meals as Array<Record<string, unknown>>) : [];
  const meals = rawMeals
    .filter((m) => m && isMacros(m.macros))
    .map((m) => ({
      name: typeof m.name === "string" && m.name.trim() ? m.name.trim() : "Comida",
      // Without an offset (the device clock is off by more than a day) the times are unknown
      time: offset === null ? "" : (isoToLocalClock(m.time, offset) ?? ""),
      macros: m.macros as Macros,
      slot: m.slot,
    }));
  const slots = resolveMealSlots(meals, { structure, goals });
  const dayMeals = meals.map((m, i) => ({ name: m.name, time: m.time, macros: m.macros, slot: slots[i] }));

  const statuses = computeSlotStatuses({ now: input.localTime, isToday: true, structure, goals, meals: dayMeals });
  const next = statuses.next;

  let fits: PlanOptionFit[] | null = null;
  let options: PlanOptionLike[] = [];
  const nextBudget = statuses.slots.find((s) => s.slot === next)?.budget;
  if (next && nextBudget) {
    // With two plan categories in the slot (Cena and Snack nocturno), the main one, with its share of the budget
    const [main] = planCategoriesForSlot(plan, next);
    if (main) {
      options = main.category.options ?? [];
      fits = fitPlanOptions({
        options,
        budget: scaleMacros(nextBudget, main.share),
        planFoods: planFoods(plan),
        complements: COMPLEMENTS,
        // Phase 2 fills it from the memory
        excludeFoods: [],
      });
    }
  }

  const ingredientsByOption = Object.fromEntries(options.map((option, i) => [i, describeIngredients(option)]));
  const lines: string[] = [];
  const restrictions = Array.isArray((plan as { restrictions?: unknown } | null)?.restrictions)
    ? ((plan as { restrictions: unknown[] }).restrictions.filter((r) => typeof r === "string" && r.trim()) as string[])
    : [];
  if (restrictions.length > 0) lines.push(`RESTRICCIONES DE SU PLAN: ${restrictions.join("; ")}`, "");
  lines.push(
    formatDayContext({
      weekday: weekdayLabel(input.localDate) ?? "",
      now: input.localTime,
      statuses,
      dayMeals,
      nextSlotFits: fits,
      ingredientsByOption,
    }),
  );

  return { contents: lines.join("\n"), next, fits, options };
}

export interface AdviceChoice {
  text: string;
  fit: PlanOptionFit | null;
  complementIndex: number | null;
  reductionIndex: number | null;
}

/** A 1-based number from the model as a 0-based index into a list of `length`, or null if it's out of range. */
const toIndex = (value: unknown, length: number): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= length ? value - 1 : null;

/**
 * The model's answer, validated: indexes out of range become null, and only the kind of adjustment the option
 * needs is kept (a complement if it falls short, a reduction if it goes over).
 */
export function parseAdviceChoice(raw: string | undefined, fits: PlanOptionFit[] | null): AdviceChoice {
  let data: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // Not JSON: take it as the text, with no choice
    return { text: (raw ?? "").trim(), fit: null, complementIndex: null, reductionIndex: null };
  }

  const text = typeof data.text === "string" ? data.text.trim() : "";
  const optionIndex = fits ? toIndex(data.optionIndex, fits.length) : null;
  const fit = optionIndex === null || !fits ? null : fits[optionIndex];
  const complementIndex = fit && fit.verdict === "add" ? toIndex(data.complementIndex, fit.complements.length) : null;
  const reductionIndex = fit && fit.verdict === "reduce" ? toIndex(data.reductionIndex, fit.reductions.length) : null;
  return { text, fit, complementIndex, reductionIndex };
}

const cleanIngredient = (i: IngredientWithMacros): IngredientWithMacros => ({
  name: String(i.name ?? ""),
  quantity: typeof i.quantity === "number" ? i.quantity : 0,
  unit: String(i.unit ?? ""),
  ...(isMacros(i.macros) ? { macros: i.macros } : {}),
});

/** The exact meal for "Registrar así", built in code from the chosen option; null if no option was chosen. */
export function buildAdviceProposal(prep: DayAdvicePrep, choice: AdviceChoice): AdviceProposal | null {
  if (!choice.fit || !prep.next) return null;
  const option = prep.options[choice.fit.optionIndex];
  if (!option) return null;
  const meal = buildMealFromFit(choice.fit, option, { complementIndex: choice.complementIndex, reductionIndex: choice.reductionIndex }, prep.next);
  return { slot: meal.slot, name: meal.name, macros: meal.macros, ingredients: meal.ingredients.map(cleanIngredient) };
}

/** When the model returns no text */
export const FALLBACK_ADVICE = "¡Vas súper bien con tus registros de hoy! Sigue sumando consistencia.";
