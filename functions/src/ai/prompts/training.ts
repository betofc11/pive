import { CANONICAL_EXERCISES, MUSCLE_GROUPS } from "../../shared/workouts/exercises";

// Rules for anything that reads or writes workouts. The code also runs every name through canonicalExerciseName.
export const TRAINING_RULES = `# Reglas de entrenamiento
- Nombra los ejercicios en español. Si el ejercicio está en esta lista, usa exactamente ese nombre: ${CANONICAL_EXERCISES.join(", ")}.
- Si no está en la lista, usa su nombre más común en español, corto y sin el número de series ni de repeticiones.
- Los grupos musculares solo pueden ser: ${MUSCLE_GROUPS.join(", ")}.`;
