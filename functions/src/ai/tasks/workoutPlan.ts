// Extract a workout plan. Pure (no SDK imports), so the root Jest can test it.
import { TRAINING_RULES } from "../prompts/training";
import { canonicalExerciseName, isMuscleGroup, type MuscleGroup } from "../../shared/workouts/exercises";
import { asArray, asObject, asText } from "./normalize";

const WORKOUT_PLAN_TASK = `# Tu tarea: extraer una rutina de entrenamiento
Analiza esta rutina de entrenamiento (puede ser una o varias fotos, capturas de pantalla, archivos de texto o PDFs).
Extrae la rutina dividida en días de entrenamiento de forma estructurada.
- Si algún día no tiene un nombre claro, genera un nombre descriptivo en español (ej: "Día 1: Push", "Día 2: Pull", "Día 3: Piernas").
- Para cada ejercicio, extrae el nombre, el número de series (sets), las repeticiones (reps), una breve descripción de la técnica en español (máximo 1 frase) y los grupos musculares que trabaja.`;

export const WORKOUT_PLAN_INSTRUCTION = `${TRAINING_RULES}\n\n${WORKOUT_PLAN_TASK}`;

export interface WorkoutPlanExercise {
  name: string;
  sets: string;
  reps: string;
  description: string;
  muscleGroups: MuscleGroup[];
}

/** Response of analizarPlanEntrenamiento. No youtubeUrl: the app searches YouTube by the exercise name. */
export interface WorkoutPlanAnalysis {
  name: string;
  days: { name: string; exercises: WorkoutPlanExercise[] }[];
}

// Sets and reps are text ("4", "8-12", "Al fallo"), but a model can return them as numbers
const asCount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? String(value) : asText(value));

const normalizeExercise = (value: unknown): WorkoutPlanExercise | null => {
  const raw = asObject(value);
  const name = canonicalExerciseName(asText(raw.name));
  if (!name) return null;
  return {
    name,
    sets: asCount(raw.sets),
    reps: asCount(raw.reps),
    description: asText(raw.description),
    muscleGroups: [...new Set(asArray(raw.muscleGroups).filter(isMuscleGroup))],
  };
};

export function normalizeWorkoutPlan(rawValue: unknown): WorkoutPlanAnalysis {
  const raw = asObject(rawValue);
  return {
    name: asText(raw.name, "Mi rutina"),
    days: asArray(raw.days)
      .map((value, index) => {
        const day = asObject(value);
        const exercises = asArray(day.exercises)
          .map(normalizeExercise)
          .filter((exercise): exercise is WorkoutPlanExercise => exercise !== null);
        // A day without exercises is kept: it can be a rest day the plan lists on purpose
        return { name: asText(day.name, `Día ${index + 1}`), exercises };
      }),
  };
}
