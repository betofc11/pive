# Fase 4: Rutinas híbridas

**Objetivo:**

1. Las rutinas combinan **fuerza, carrera y movilidad**.
2. Se pueden **extraer** de un archivo (como hoy) o **generar** desde un formulario.
3. Se ejecutan en la sesión activa, registrando las carreras desde la PWA.
4. También se puede registrar una actividad suelta que no estaba en el plan.

| | |
|---|---|
| **Depende de** | Fase 0: `shared/`, `TRAINING_RULES`, `canonicalExerciseName`, `MUSCLE_GROUPS`, `recordUsage` |
| **Opcional** | Fase 2 (lesiones, horario y equipo de la memoria) y Fase 3 (límite mensual `routine` y herramienta del chat). Si no están hechas, esas partes se saltan y se anotan en la bitácora |
| **Desbloquea** | Fase 5 (Apple Health importa al mismo formato) |
| **Leer antes** | `diseno.md` §8 |
| **PRs sugeridos** | **A:** modelo de datos v2 + adaptador + sesión. **B:** extractor y generador. **C:** UI de carrera y actividad suelta |

---

## Punto de partida (verifícalo contra el código)

**Tipos** (`src/types.ts`)

```ts
interface WorkoutPlan { name: string; days: WorkoutDay[]; extractedAt: number }
interface WorkoutDay { name: string; exercises: WorkoutExercise[] }
interface WorkoutExercise { name; sets: string; reps: string; description; youtubeUrl?; muscleGroups? }
interface ActiveWorkoutSession { dayName; startedAt; exercises: ActiveExercise[] }   // en users/{uid}.activeWorkoutSession
interface CompletedWorkout extends ActiveWorkoutSession { id; userId; finishedAt; date } // users/{uid}/workoutHistory
```

**Servicio** (`src/services/workoutService.ts`, con tests de emulador)

- `saveWorkoutPlan`
- `startWorkoutSession(uid, day)` copia `exercises` con `done: false`.
- `toggleExerciseDone(uid, session, index)`
- `finishWorkoutSession`: guarda en el historial si hay algo hecho.

**UI**

- `app/(tabs)/coach.tsx` con `src/components/coach/WorkoutPlanUpload.tsx`, `WorkoutPlanDays.tsx` y `ActiveWorkout.tsx`.
- El botón de YouTube usa `openYouTubeSearch(exercise.name)`.
- `src/lib/activity.ts > buildActivityItems` muestra "x/y ejercicios" en el historial del perfil.

**Datos de usuarios**

- **Hay planes y sesiones activas guardados con el formato viejo:** el adaptador tiene que leerlos.

---

## Contratos

### Tipos v2 (`functions/src/shared/workouts/types.ts`, puro)

```ts
export type RunType = 'easy' | 'tempo' | 'intervals' | 'long';
export const RUN_TYPE_LABELS: Record<RunType, string>; // Suave, Tempo, Intervalos, Largo

export type WorkoutBlock =
  | { kind: 'strength'; exercises: WorkoutExercise[] }
  | {
      kind: 'run';
      runType: RunType;
      durationMin?: number;
      distanceKm?: number;
      targetPace?: string;              // "5:30/km"
      zone?: 1 | 2 | 3 | 4 | 5;
      intervals?: { reps: number; work: string; rest: string }; // "400 m" / "90 s"
      notes?: string;
    }
  | { kind: 'mobility'; durationMin: number; notes?: string };

export interface WorkoutDayV2 { name: string; blocks: WorkoutBlock[] }
export function normalizeWorkoutDay(day: { name: string; blocks?: WorkoutBlock[]; exercises?: WorkoutExercise[] }): WorkoutDayV2;
// Formato viejo → un bloque 'strength'

export interface RunResult { distanceKm?: number; durationMin?: number; rpe?: number }
export type ActiveBlock =
  | { kind: 'strength'; exercises: ActiveExercise[] }
  | (Extract<WorkoutBlock, { kind: 'run' }> & { done: boolean; result?: RunResult })
  | (Extract<WorkoutBlock, { kind: 'mobility' }> & { done: boolean });

export interface ActiveWorkoutSessionV2 { dayName: string; startedAt: number; blocks: ActiveBlock[] }
export function normalizeActiveSession(s: ActiveWorkoutSession | ActiveWorkoutSessionV2): ActiveWorkoutSessionV2;

export interface WorkoutSummary {
  strengthDone: number;
  strengthTotal: number;
  runKm?: number;
  runMin?: number;
  mobilityMin?: number;
}
export function summarizeSession(s: ActiveWorkoutSessionV2): WorkoutSummary;
```

### Historial

`CompletedWorkout` gana campos opcionales, para que lo viejo siga siendo válido:

- `source: 'app' | 'manual' | 'healthkit'`
- `blocks?: ActiveBlock[]`
- `summary?: WorkoutSummary`
- `externalId?: string` (para la fase 5)

### Endpoints

- **`analizarPlanEntrenamiento`:** responde `{ name, days: WorkoutDayV2[] }`, con nombres canónicos y sin `youtubeUrl`.
- **`generarPlanEntrenamiento`** (nuevo, modelo pesado):
  - **request:** `{ goal: 'strength' | '5k' | '10k' | 'half' | 'mixed'; daysPerWeek: number; minutesPerSession: number; level: 'beginner' | 'intermediate' | 'advanced'; currentRunKmPerWeek?: number; easyPace?: string; notes?: string }`;
  - **response:** `{ name, days: WorkoutDayV2[], rationale: string }`. Es una **vista previa**: no se guarda;
  - el servidor agrega:
    - de la memoria (si existe): `injury`, `schedule` y `equipment`;
    - de `strengthRecords`: la mejor marca por ejercicio (como `usePersonalRecords`);
  - `recordUsage('routine')`, y `checkAndConsume('routine')` si la Fase 3 está hecha.

---

## Tareas

### PR A: datos y sesión

1. Tipos v2, `normalizeWorkoutDay`, `normalizeActiveSession` y `summarizeSession`, con tests.
2. **`workoutService`:**
   - `startWorkoutSession` crea `blocks`;
   - `toggleExerciseDone(blockIndex, exerciseIndex)`;
   - `setBlockDone(blockIndex, done, result?)`;
   - `finishWorkoutSession` guarda `summary` y `source: 'app'`;
   - todo con tests de emulador.
3. **Lectura:** todo lo que lee `workoutPlan` o `activeWorkoutSession` pasa por los adaptadores.
4. **`activity.ts`:** el detalle usa `summary` si existe ("4/5 ejercicios · 5 km"); si no, el cálculo actual.

### PR B: extractor y generador

1. **`TRAINING_RULES`:** se suman los principios híbridos de diseno §8. Marcar en un comentario que el usuario debe validarlos con un entrenador.
2. **Extractor:** esquema v2 (bloques).
3. **`generarPlanEntrenamiento`** según el contrato.
4. **UI del generador** en `coach.tsx`:
   - botón "Generar rutina" junto a la subida;
   - formulario → vista previa (los días con sus bloques) → [Guardar] (`saveWorkoutPlan`) o [Ajustar] (vuelve al formulario).

### PR C: carrera en la sesión y actividad suelta

1. **`WorkoutPlanDays`:** mostrar los bloques, con tarjetas distintas para fuerza, carrera y movilidad.
2. **`ActiveWorkout`, bloque de carrera:**
   - muestra el objetivo (tipo, duración o distancia, ritmo o zona, intervalos);
   - [Hecho];
   - campos opcionales de distancia, tiempo y RPE (1–10).
3. **"Registrar actividad suelta":** una carrera fuera del plan.
   - Pide fecha, tipo, distancia, tiempo y RPE.
   - Se guarda en `workoutHistory` con `source: 'manual'`.
4. **Herramienta del chat `openRoutineGenerator`** (si la Fase 3 está hecha): devuelve parámetros sugeridos y la app abre el generador prellenado.

---

## Tests a escribir

- **`normalizeWorkoutDay`:** formato viejo → 1 bloque `strength`; v2 → igual; un día vacío.
- **`normalizeActiveSession`:** una sesión vieja en curso → bloques, conservando los `done`.
- **`summarizeSession`:** una sesión mixta → conteos y km correctos.
- **Emulador:** inicio, marcado y fin con bloques; actividad suelta.
- **`activity.ts`:** el detalle con y sin `summary`.

---

## Verificación

```bash
npm run lint && npx tsc --noEmit && npx tsc --noEmit -p functions && npm test && npm run build
npm run test:emulator
```

**Manual** (PWA):

1. Generar una rutina 10k + fuerza de 4 días: la vista previa es coherente, se guarda y se ve en el Coach.
2. Ejecutar un día mixto: marcar los ejercicios y la carrera con resultado; se ve en el historial.
3. Una rutina vieja ya guardada se sigue viendo y ejecutando.
4. Registrar una actividad suelta.

---

## Pasos del usuario

- **Validar las reglas de entrenamiento híbrido** con un entrenador.
- **Desplegar:** Functions → reglas → app.

## Fuera de alcance

- Apple Health (Fase 5).
- Strava.
- Planes por semanas con progresión automática: es una idea futura; esta fase genera una semana tipo.

---

## Al terminar

- [ ] `README.md` de la raíz: endpoint `generarPlanEntrenamiento`.
- [ ] `docs/plans/pive-coach/README.md`: estado, PRs y bitácora.
- [ ] Notas para la Fase 5: el formato de `CompletedWorkout` con `externalId`.

---

## Prompt de arranque

```
Vamos a implementar la Fase 4 del plan de Pive Coach (rutinas híbridas).

1. Lee CLAUDE.md, docs/plans/pive-coach/README.md (incluida la bitácora) y docs/plans/pive-coach/fase-4-rutinas-hibridas.md completo, y la sección §8 de docs/plans/pive-coach/diseno.md.
2. Confirma en la tabla de estado que la Fase 0 esté hecha, y dime cuáles de las Fases 2 y 3 lo están (cambian partes opcionales de esta fase).
3. Revisa el "Punto de partida" contra el código actual. Si algo no coincide, dímelo y propón el ajuste antes de cambiar nada.
4. Marca la fase como "En curso". Haz el PR A (datos, adaptadores y sesión), luego el B (extractor y generador) y luego el C (UI de carrera y actividad suelta).
5. Corre las verificaciones de la fase.
6. Al terminar: actualiza el estado y la bitácora en docs/plans/pive-coach/README.md, deja notas para la Fase 5 y abre el PR.
```
