// Contracts of the Cloud Functions endpoints: what the app sends and what it gets back.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
// Every request may also carry `localDate: 'YYYY-MM-DD'` (the user's local date), used to date the usage log.
import type { IngredientWithMacros } from './ingredients';
import type { Macros } from './macros';
import type { MealSlot, PlannedSlot } from './meals/slots';
import type { MuscleGroup } from './workouts/exercises';

/** obtenerConsejoPive request. Response: { advice: string } */
export interface AdviceRequest {
  dailyMacros: Macros;
  goals: Macros;
  /** `time` is the local HH:mm */
  meals: { name: string; time: string; macros: Macros }[];
  currentTime: string;
  localDate: string;
}

/** analizarImagenComida response */
export interface FoodAnalysis {
  name: string;
  /** Sum of the ingredients, calculated in code */
  macros: Macros;
  ingredients: IngredientWithMacros[];
  /** What the AI assumed and the user may want to correct ("Asumí arroz cocido") */
  assumptions: string[];
  /** Only when the user said which meal it is ("mi almuerzo"); never guessed from the photo */
  mentionedSlot: MealSlot | null;
}

/** calcularMacrosIngredientes response: the meal's totals at the top level (as before phase 0) plus the breakdown */
export interface IngredientsMacros extends Macros {
  ingredients: IngredientWithMacros[];
}

export interface NutritionPlanOption {
  title: string;
  ingredients: IngredientWithMacros[];
  /** Sum of the ingredients when all have macros; otherwise the model's total */
  macros?: Macros;
}

export interface NutritionPlanMeal {
  /** The meal's name as the plan says it */
  type: string;
  slot?: PlannedSlot;
  options: NutritionPlanOption[];
}

export interface NutritionPlanEquivalence {
  group: string;
  food: string;
  quantity: number;
  unit: string;
}

/** analizarPlanNutricional response. A missing goal means the plan didn't have it. */
export interface NutritionPlanAnalysis {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  advice: string;
  restrictions: string[];
  exchanges: { name: string; qty: string }[];
  equivalences?: NutritionPlanEquivalence[];
  meals: NutritionPlanMeal[];
}

/** analizarComposicionCorporal response. A missing metric means the report didn't have it. */
export interface BodyCompositionAnalysis {
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  /** Date of the measurement (YYYY-MM-DD), or null if the report doesn't show it */
  measuredAt: string | null;
}

export interface WorkoutPlanExercise {
  name: string;
  sets: string;
  reps: string;
  description: string;
  muscleGroups: MuscleGroup[];
}

/** analizarPlanEntrenamiento response. No youtubeUrl: the app searches YouTube by the exercise name. */
export interface WorkoutPlanAnalysis {
  name: string;
  days: { name: string; exercises: WorkoutPlanExercise[] }[];
}
