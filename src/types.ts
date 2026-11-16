import type { AdviceProposal } from '../functions/src/shared/api';
import type { Macros } from '../functions/src/shared/macros';
import type { DayStructure } from '../functions/src/shared/meals/dayStructure';
import type { MealSlot, PlannedSlot, SlotSource } from '../functions/src/shared/meals/slots';

export type { AdviceProposal, DayStructure, Macros, MealSlot, PlannedSlot, SlotSource };

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  createdAt: number;
  macroGoals?: MacroGoals;
  bodyMetrics?: BodyMetrics;
  nutritionalPlan?: NutritionalPlan;
  workoutPlan?: WorkoutPlan;
  activeWorkoutSession?: ActiveWorkoutSession | null;
  /** Only if the user customized their meal slots; otherwise they come from the plan or the default */
  dayStructure?: DayStructure;
}

export interface BodyMetrics {
  weight: number;
  bodyFat?: number;
  muscleMass?: number;
  height?: number;
  updatedAt: number;
}

export interface BodyMetricsHistory {
  id: string;
  userId: string;
  weight: number;
  bodyFat?: number;
  muscleMass?: number;
  date: string; // ISO string
  createdAt: number;
}

export interface NutritionalPlanExchange {
  name: string;
  qty: string;
}

export interface NutritionalPlan {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  advice?: string;
  extractedAt: number;
  meals?: PlanMealCategory[];
  exchanges?: NutritionalPlanExchange[];
  /** Allergies and foods the plan forbids, as the plan says them. Missing on plans saved before phase 0 */
  restrictions?: string[];
  equivalences?: PlanEquivalence[];
}

/** An exchange the plan allows: within `group`, `quantity` `unit` of `food` counts as one portion */
export interface PlanEquivalence {
  group: string;
  food: string;
  quantity: number;
  unit: string;
}

export interface PlanMealCategory {
  type: string; // e.g., "Desayuno", "Almuerzo", "Cena", "Snack"
  /** Missing on plans saved before phase 0: use slotFromLabel(type) */
  slot?: PlannedSlot;
  options: PlanMealOption[];
}

export interface PlanMealOption {
  title: string;
  ingredients: PlanIngredient[];
  /** Always present on plans saved since phase 0 */
  macros?: Macros;
}

export interface PlanIngredient {
  name: string;
  quantity: number;
  unit: string;
  /** Macros for `quantity`. Always present on plans saved since phase 0 */
  macros?: Macros;
}

export type MacroGoals = Macros;

export interface DailyLog {
  id: string;
  userId: string;
  date: string; // ISO string
  macros: Macros;
  meals: Meal[];
  waterIntake?: number; // in ml
  aiAdvice?: string;
  aiAdviceUpdatedAt?: number;
  adviceMacros?: Macros;
  /** The slot the advice talks about (the next one when it was generated) */
  adviceSlot?: PlannedSlot | null;
  /** The meal the advice proposes, for "Registrar así". Cleared once logged */
  adviceProposal?: AdviceProposal | null;
}

export interface Meal {
  id: string;
  name: string;
  /** ISO string */
  time: string;
  macros: Macros;
  imageUrl?: string;
  /** Missing on meals saved before phase 1: it's inferred when read (resolveMealSlots) */
  slot?: MealSlot;
  slotSource?: SlotSource;
}

export interface StrengthRecord {
  id: string;
  userId: string;
  exercise: string;
  weight: number;
  date: string;
  muscleGroups: string[];
  reps?: number;
  isUnilateral?: boolean;
}

export interface WorkoutPlan {
  name: string;
  days: WorkoutDay[];
  extractedAt: number;
}

export interface WorkoutDay {
  name: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutExercise {
  name: string;
  sets: string;
  reps: string;
  description: string;
  /** No longer generated (the app searches YouTube by name). Kept for plans saved before phase 0 */
  youtubeUrl?: string;
  muscleGroups?: string[];
}

export interface ActiveWorkoutSession {
  dayName: string;
  startedAt: number;
  exercises: ActiveExercise[];
}

export interface ActiveExercise extends WorkoutExercise {
  done: boolean;
}

/** A finished workout session, kept in users/{uid}/workoutHistory */
export interface CompletedWorkout extends ActiveWorkoutSession {
  id: string;
  userId: string;
  finishedAt: number;
  date: string; // ISO string of finishedAt
}

