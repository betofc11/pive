// Reading a nutrition plan as the meal logic needs it, for plans of any age.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { type IngredientWithMacros, mealMacrosFromIngredients } from '../ingredients';
import { isMacros, type Macros } from '../macros';
import { isPlannedSlot, type PlannedSlot, slotFromLabel } from './slots';

/** What the meal logic reads from a plan option. Fits NutritionalPlan (app) and NutritionPlanOption (API). */
export interface PlanOptionLike {
  title: string;
  ingredients?: IngredientWithMacros[];
  macros?: Macros;
}

export interface PlanCategoryLike {
  /** The meal's name as the plan says it ("Desayuno", "Snack nocturno") */
  type: string;
  /** Missing on plans saved before phase 0 */
  slot?: PlannedSlot;
  options?: PlanOptionLike[];
}

export interface PlanLike {
  meals?: PlanCategoryLike[];
}

/** The slot of a plan category: the saved one, or deduced from its name for older plans. */
export function categorySlot(category: PlanCategoryLike): PlannedSlot | null {
  return isPlannedSlot(category.slot) ? category.slot : slotFromLabel(category.type ?? '');
}

/** Macros of an option: the sum of its ingredients when all have macros, else its saved total, else null. */
export function optionMacros(option: PlanOptionLike): Macros | null {
  const fromIngredients = mealMacrosFromIngredients(option.ingredients ?? []);
  if (fromIngredients) return fromIngredients;
  return isMacros(option.macros) ? option.macros : null;
}

/** Average kcal of the options of a category that have macros, or null if none has. */
export function averageOptionKcal(category: PlanCategoryLike): number | null {
  const kcal = (category.options ?? [])
    .map(optionMacros)
    .filter((m): m is Macros => m !== null)
    .map((m) => m.calories);
  return kcal.length > 0 ? kcal.reduce((a, b) => a + b, 0) / kcal.length : null;
}

export interface SlotCategory {
  category: PlanCategoryLike;
  /** Share of the slot's budget for this category (0–1). With one category per slot, 1. */
  share: number;
}

/**
 * The plan categories of a slot. A plan can have two for the same slot (Cena and Snack nocturno): the main one
 * (most kcal on average) goes first, and each gets a share of the slot's budget proportional to its kcal.
 * Without macros the categories split the slot evenly.
 */
export function planCategoriesForSlot(plan: PlanLike | null | undefined, slot: PlannedSlot): SlotCategory[] {
  const categories = (plan?.meals ?? []).filter((c) => categorySlot(c) === slot && (c.options?.length ?? 0) > 0);
  if (categories.length === 0) return [];
  const kcal = categories.map((c) => averageOptionKcal(c));
  const allKnown = kcal.every((k): k is number => k !== null && k > 0);
  const total = allKnown ? (kcal as number[]).reduce((a, b) => a + b, 0) : categories.length;
  return categories
    .map((category, i) => ({ category, share: allKnown ? (kcal[i] as number) / total : 1 / categories.length }))
    .sort((a, b) => b.share - a.share);
}

/** Every ingredient in the plan with macros, once per name (the first one found). */
export function planFoods(plan: PlanLike | null | undefined): IngredientWithMacros[] {
  const seen = new Set<string>();
  const foods: IngredientWithMacros[] = [];
  for (const category of plan?.meals ?? []) {
    for (const option of category.options ?? []) {
      for (const ingredient of option.ingredients ?? []) {
        const key = (ingredient.name ?? '').trim().toLowerCase();
        if (!key || seen.has(key) || !isMacros(ingredient.macros)) continue;
        seen.add(key);
        foods.push(ingredient);
      }
    }
  }
  return foods;
}
