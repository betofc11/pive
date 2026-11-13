# Fase 0: Base común de prompts y medición

**Objetivo:** ordenar el código de IA de `functions/` en bloques compartidos, corregir los problemas de los prompts actuales y empezar a medir tokens y costo por usuario.

Casi nada cambia para el usuario: las respuestas salen más consistentes, editar un ingrediente ya no llama a la IA y queda la base para todas las fases siguientes.

| | |
|---|---|
| **Depende de** | Nada |
| **Desbloquea** | Todas las fases |
| **Leer antes** | `diseno.md` §1 (diagnóstico) y §2 (arquitectura) |
| **PRs sugeridos** | **A:** infraestructura y refactor, sin cambios de comportamiento. **B:** prompts, esquemas y cambios en la app |

---

## Punto de partida (verifícalo contra el código)

**Functions**

- `functions/src/index.ts` (~575 líneas) contiene todo:
  - helpers `verifyAuthToken` (con CORS), `getApiKey` y `generateContentWithRetry` (3 intentos ante 429/503);
  - constantes `LIGHT_MODEL = "gemini-3.5-flash-lite"` y `HEAVY_MODEL = "gemini-3.8-flash"`;
  - 6 endpoints POST:

| Endpoint | Modelo | Cliente (`src/services/geminiService.ts`) | Se usa en |
|---|---|---|---|
| `obtenerConsejoPive` | ligero | `getPiveAdvice` | `app/(tabs)/index.tsx` |
| `analizarImagenComida` | ligero | `analyzeFood` | `src/components/FoodDialog.tsx` |
| `calcularMacrosIngredientes` | ligero | `calculateMacrosFromIngredients` | `FoodDialog.tsx`, `app/(tabs)/plan.tsx` |
| `analizarPlanNutricional` | pesado | `analyzeNutritionPlan` | `app/(tabs)/plan.tsx` |
| `analizarComposicionCorporal` | pesado | `analyzeBodyComposition` | `src/components/BodyCompositionDialog.tsx` |
| `analizarPlanEntrenamiento` | pesado | `analyzeWorkoutPlan` | `app/(tabs)/coach.tsx` |

- Las Functions **todavía no usan Firestore**, solo `admin.auth()`.

**Configuración**

- La app usa una **base Firestore con nombre**: `firestoreDatabaseId` en `firebase-applet-config.json`. Solo se despliega `functions/`, así que ese JSON no existe para las Functions.
- `functions/tsconfig.json` tiene `include: ["src"]`, sin excluir tests, y `noUnusedLocals: true`.
- El Jest de la raíz (preset `jest-expo`) corre cualquier `*.test.ts` fuera de `node_modules`, salvo `*.emulator.test.ts`.
- `tsconfig.json` de la raíz excluye `functions`, pero TypeScript igual revisa los archivos que la app importe desde ahí.

**Comportamientos actuales que esta fase corrige**

- **Comida:** `FoodDialog.updateIngredient` pone `macros = null` ante cualquier cambio, y `handleSave` llama entonces a `calculateMacrosFromIngredients`.
- **Plan:** `plan.tsx > handleRegisterMeal` llama a `calculateMacrosFromIngredients` si la opción no trae macros. `handleUpload` guarda `nutritionalPlan` (con `meals` y `exchanges`) y `macroGoals`.
- **Rutina:**
  - el esquema exige `youtubeUrl`, **pero la app no lo usa**: `ActiveWorkout` llama a `openYouTubeSearch(exercise.name)` (`src/lib/youtube.ts`);
  - `coach.tsx` guarda el resultado directo con `saveWorkoutPlan`.
- **Consejo:** `getPiveAdvice` manda `bodyMetrics`, y la regla 5 del prompt prohíbe usarlas.
- **Composición corporal:** `BodyCompositionDialog` guarda el historial con `date: new Date().toISOString()`.
- **Grupos musculares:** los válidos están en `RecordDialog` (`MUSCLE_GROUPS`): Pecho, Espalda, Piernas, Hombros, Brazos, Core.

---

## Contratos que crea esta fase

### Código compartido (`functions/src/shared/`, TypeScript puro)

```ts
// macros.ts
export interface Macros { calories: number; protein: number; carbs: number; fats: number }
export const ZERO_MACROS: Macros;
export function sumMacros(list: Macros[]): Macros;
export function scaleMacros(m: Macros, factor: number): Macros;
export function subtractMacros(a: Macros, b: Macros): Macros;
export function roundMacros(m: Macros): Macros; // todo a enteros

// meals/slots.ts (solo los enums; la lógica llega en la Fase 1)
export const MEAL_SLOTS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'extra'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export type PlannedSlot = Exclude<MealSlot, 'extra'>;
export const PLANNED_SLOTS: readonly PlannedSlot[];
export const MEAL_SLOT_LABELS: Record<MealSlot, string>;
// { breakfast: 'Desayuno', morning_snack: 'Merienda AM', lunch: 'Almuerzo',
//   afternoon_snack: 'Merienda PM', dinner: 'Cena', extra: 'Snack' }
export function slotFromLabel(label: string): PlannedSlot | null;
// "Media mañana" → morning_snack, "Comida" → lunch, etc. Para planes viejos sin `slot`.

// ingredients.ts
export const INGREDIENT_UNITS = ['g', 'ml', 'unidad', 'taza', 'cucharada', 'cucharadita', 'rebanada', 'porcion'] as const;
export interface IngredientWithMacros { name: string; quantity: number; unit: string; macros?: Macros }
export function rescaleIngredient(prev: IngredientWithMacros, nextQuantity: number): IngredientWithMacros;
// Proporcional si hay macros y quantity > 0; si no, devuelve sin macros
export function mealMacrosFromIngredients(list: IngredientWithMacros[]): Macros | null;
// null si alguno no tiene macros

// workouts/exercises.ts
export const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'] as const;
export function canonicalExerciseName(name: string): string;
// Mapa de alias → nombre canónico en español ("bench press" → "Press de banca")

// config.ts
export const FIRESTORE_DATABASE_ID: string; // igual a firestoreDatabaseId de firebase-applet-config.json (un test lo garantiza)
```

### Respuestas de los endpoints

Los cambios son compatibles: casi todo agrega campos.

| Endpoint | Cambio |
|---|---|
| `obtenerConsejoPive` | **Request:** sin `bodyMetrics`, con `localDate: 'YYYY-MM-DD'` (de ahí se deriva el día de la semana). **Response:** sin cambios, `{ advice }` |
| `analizarImagenComida` | `{ name, macros, ingredients: IngredientWithMacros[], assumptions: string[], mentionedSlot: MealSlot \| null }`. `macros` se calcula **en código** como la suma de los ingredientes |
| `calcularMacrosIngredientes` | `{ calories, protein, carbs, fats, ingredients: IngredientWithMacros[] }`. Se mantienen los campos de primer nivel |
| `analizarPlanNutricional` | `meals[].slot: PlannedSlot`. `options[].macros` **obligatorio**. `options[].ingredients[].macros` **obligatorio**. `restrictions: string[]`. `equivalences?: { group, food, quantity, unit }[]` |
| `analizarComposicionCorporal` | + `measuredAt: 'YYYY-MM-DD' \| null`; `weight` obligatorio |
| `analizarPlanEntrenamiento` | Sin `youtubeUrl`. `muscleGroups` con `enum`. Nombres pasados por `canonicalExerciseName` |

### Tipos de la app (`src/types.ts`)

Todos son opcionales, para que los datos viejos sigan siendo válidos:

- `PlanMealCategory.slot?: PlannedSlot`
- `PlanIngredient.macros?: Macros`
- `NutritionalPlan.restrictions?: string[]`
- `NutritionalPlan.equivalences?: PlanEquivalence[]`
- `WorkoutExercise.youtubeUrl?: string` (pasa a opcional)
- Donde hoy hay objetos de macros escritos a mano, usar `Macros`.

### Uso por usuario (`users/{uid}/usage/{YYYY-MM-DD}`, solo lo escribe el servidor)

```ts
type UsageFeature = 'advice' | 'food' | 'ingredients' | 'nutritionPlan' | 'bodyComposition' | 'workoutPlan';
// Fases siguientes agregan 'chat', 'memory', 'routine', 'location'

interface FeatureUsage {
  calls: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  estCostUsd: number;
}

interface DailyUsage {
  date: string;                                       // YYYY-MM-DD
  updatedAt: number;
  features: Partial<Record<UsageFeature, FeatureUsage>>;
}
```

---

## Tareas

### PR A: infraestructura y refactor (sin cambios de comportamiento)

**A1. Carpeta compartida**
- Crear `functions/src/shared/` con los módulos de arriba y sus tests (`*.test.ts` al lado del código).
- Agregar `"exclude": ["src/**/*.test.ts"]` a `functions/tsconfig.json`.
- **Comprobar las cuatro vías antes de seguir** (si alguna falla, es lo primero que se resuelve):
  1. `npm test` corre los tests de `functions/src/shared/`;
  2. `npx tsc --noEmit` compila la app importando, por ejemplo, `../functions/src/shared/macros` desde `src/types.ts`;
  3. `npx tsc --noEmit -p functions` compila;
  4. `npm run build` empaqueta la web con ese import.
- **Regla:** `shared/` no importa nada de npm, ni de React Native, ni de Node.

**A2. Firestore en Functions**
- `functions/src/firestore.ts`: `export const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID)` (de `firebase-admin/firestore`).
- Un test en la raíz verifica que `FIRESTORE_DATABASE_ID` coincida con `firebase-applet-config.json`.

**A3. Partir `index.ts`**

```
functions/src/
├── http.ts              # verifyAuthToken + CORS
├── ai/gemini.ts         # getAi(), MODELS, generateContentWithRetry
├── ai/prompts/core.ts   # PIVE_CORE (por ahora: la personalidad actual del consejo)
├── ai/prompts/nutrition.ts
├── ai/prompts/training.ts
├── ai/schemas.ts        # esquemas de Gemini (usa `Type` del SDK)
├── ai/tasks/*.ts        # instrucciones de cada endpoint
├── endpoints/*.ts       # un archivo por endpoint
└── index.ts             # solo re-exporta; los nombres de los endpoints no cambian
```

- Instrucciones en `systemInstruction`; datos en `contents`.
- El comportamiento de este PR es idéntico al actual: mismos prompts, solo reubicados.

**A4. Registro de uso**
- `functions/src/usage.ts`: `recordUsage(uid, feature, response.usageMetadata, model, localDate?)`.
  - Suma con `FieldValue.increment`.
  - Calcula el costo con una tabla `MODEL_PRICES`. Comenta que sus valores hay que verificarlos en la página oficial de precios.
  - Usa `localDate` si viene y es válida; si no, la fecha UTC.
  - **Nunca rompe la respuesta:** `try/catch` y log.
- Lo llaman todos los endpoints.
- `firestore.rules`, dentro de `match /users/{userId}`:
  ```
  match /usage/{docId} {
    allow read: if isOwner(userId);
    allow write: if false;
  }
  ```
- Test de emulador: el dueño lee, el cliente no escribe y otro usuario no lee.

### PR B: prompts, esquemas y app

**B1. Bloques de prompt**
- `PIVE_CORE`:
  - la personalidad actual;
  - seguridad (no es consejo médico, compensar no es castigar);
  - "no inventes ni recalcules números que vengan en el contexto";
  - idioma.
- `NUTRITION_RULES`:
  - preferir gramos;
  - decir si se asume crudo o cocido;
  - suponer aceite o grasa de cocción cuando no se ve;
  - porciones más grandes en restaurantes y comida de la calle;
  - kcal y gramos en enteros.
- `TRAINING_RULES`:
  - nombres canónicos en español (la misma lista de `canonicalExerciseName`);
  - grupos musculares de `MUSCLE_GROUPS`.

**B2. Consejo**
- Quitar `bodyMetrics` del cliente (`getPiveAdvice` y su llamada en `index.tsx`) y del servidor.
- Mandar `localDate`.
- `systemInstruction` = `PIVE_CORE` + `NUTRITION_RULES` + tarea.

**B3. Comida (`analizarImagenComida`)**
- Nuevo esquema; `macros` = `sumMacros(ingredients)`.
- `mentionedSlot` solo si el usuario dice explícitamente qué comida es. Instrucción explícita: "no lo deduzcas de la foto".

**B4. Ingredientes (`calcularMacrosIngredientes`)**
- Mismas reglas, desglose por ingrediente y respuesta compatible.

**B5. `FoodDialog`**
- Guardar los macros por ingrediente.
- Al cambiar **solo la cantidad** de un ingrediente con macros: `rescaleIngredient`.
- Los macros del plato salen de `mealMacrosFromIngredients`; solo si da `null` se llama a la IA.
- Los favoritos (`savedMeals`) guardan también los macros por ingrediente; los viejos siguen funcionando.

**B6. Plan nutricional**
- Nuevo esquema; `plan.tsx` guarda `slot`, `restrictions` y `equivalences`.
- `handleRegisterMeal` usa los macros de la opción. La IA queda solo para planes viejos.

**B7. Composición corporal**
- Agregar `measuredAt`. Si viene, `BodyCompositionDialog` lo usa como `date` del historial.

**B8. Rutina**
- Quitar `youtubeUrl` del esquema y de la instrucción.
- `enum` en `muscleGroups`.
- Pasar los nombres por `canonicalExerciseName` antes de responder.

**B9. Evals (opcional; requiere `GEMINI_API_KEY` en local)**
- `functions/evals/food.json`: 15 descripciones de comida con rangos esperados de kcal y proteína.
- Un script `functions/evals/run.mjs` que, tras `npm run --prefix functions build`, llama a la lógica del endpoint y reporta qué casos salen de rango.
- `functions/evals/README.md` explica cómo correrlo.
- **En una sesión en la nube sin key, se deja listo y no se corre.**

**B10. Documentación**
- Actualizar la sección de Cloud Functions del `README.md` de la raíz con el registro de uso y los cambios de respuesta.

---

## Tests a escribir

| Archivo | Casos |
|---|---|
| `shared/macros.test.ts` | Suma vacía = 0. Escala ×1.5. Resta. Redondeo. |
| `shared/ingredients.test.ts` | 100 g → 150 g multiplica por 1.5. Cantidad 0 → sin macros. Sin macros → `mealMacrosFromIngredients` da `null`. Mezcla con y sin macros → `null`. |
| `shared/meals/slots.test.ts` | `slotFromLabel`: "Desayuno", "Media mañana", "Almuerzo", "Comida", "Merienda", "Cena", "Snack nocturno", desconocido → `null`. |
| `shared/workouts/exercises.test.ts` | "bench press" / "Press banca" → "Press de banca". "Sentadillas" → "Sentadilla". Desconocido → mismo nombre, sin espacios sobrantes. |
| `shared/config.test.ts` | Coincide con `firebase-applet-config.json`. |
| `src/services/geminiService.test.ts` | El payload del consejo no lleva `bodyMetrics` y lleva `localDate`. |
| Emulador | Reglas de `usage`. |

---

## Verificación

```bash
npm run lint && npx tsc --noEmit && npx tsc --noEmit -p functions && npm test
npm run build            # la web empaqueta functions/src/shared
npm run test:emulator    # si la sesión no tiene Java 21, lo corre la CI
```

**Manual** (en local, con `GEMINI_API_KEY`): `npm run --prefix functions serve` + `npm run web`.

1. Foto de comida: ver ingredientes con macros y supuestos.
2. Cambiar una cantidad: los macros cambian sin llamar a la IA.
3. Subir un plan: guarda `slot` y `restrictions`.
4. Subir una rutina: sin `youtubeUrl` y el botón de YouTube sigue funcionando.
5. Revisar `users/{uid}/usage/{hoy}` en Firestore.

---

## Fuera de alcance

- Tiempos de comida en la UI y presupuesto (fase 1).
- Memoria y ubicación (fase 2).
- Chat y límites (fase 3). Aquí solo se **mide**, no se limita.
- Rutinas por bloques (fase 4).

---

## Al terminar

- [ ] `docs/plan/README.md`: fase 0 = Hecha, con PRs y entrada en la bitácora.
- [ ] Notas para la fase 1 en la bitácora: cómo se importa `functions/src/shared` desde la app (ruta exacta usada) y cualquier detalle de build.
- [ ] **Deploy** (lo hace el usuario):
  1. `npm run deploy:functions`;
  2. `npm run deploy:rules`;
  3. mergear a `main` (Vercel despliega la app).

---

## Prompt de arranque

```
Vamos a implementar la Fase 0 del plan de Pive Coach (base común de prompts y medición).

1. Lee CLAUDE.md, docs/plan/README.md y docs/plan/fase-0-base-prompts.md completo, y las secciones §1 y §2 de docs/plan/diseno.md.
2. Revisa el "Punto de partida" contra el código actual. Si algo no coincide, dímelo y propón el ajuste antes de cambiar nada.
3. Marca la fase como "En curso" en docs/plan/README.md.
4. Empieza por el PR A. Lo primero es comprobar que la app, la web, Jest y las Functions pueden usar functions/src/shared (tarea A1). Si eso no funciona, para y cuéntame.
5. Implementa las tareas en orden, con commits pequeños, y corre las verificaciones de la fase.
6. Al terminar: actualiza el estado y la bitácora en docs/plan/README.md, deja notas para la Fase 1 y abre el PR.
```
