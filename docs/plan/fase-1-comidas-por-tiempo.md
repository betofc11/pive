# Fase 1: Comidas por tiempo + el plan como base

**Objetivo:**

1. Cada comida registrada tiene su tiempo (desayuno, almuerzo…), sugerido por hora y cantidad, y el usuario lo puede cambiar al registrar o después.
2. Lo que queda del día se reparte entre los tiempos pendientes.
3. El consejo del día recomienda la opción de tu plan para la próxima comida, con un complemento o una porción ajustada calculados en código.
4. El consejo se puede registrar con un toque.

| | |
|---|---|
| **Depende de** | Fase 0: `functions/src/shared/`, plan con `slot` y macros por ingrediente, `mentionedSlot`, `db` de Firestore en Functions, `recordUsage` |
| **Desbloquea** | Fase 2 (la memoria filtra complementos) y Fase 3 (el chat usa todo esto) |
| **Leer antes** | `diseno.md` §3 completa |
| **PRs sugeridos** | **A:** lógica pura + tests. **B:** datos y UI de tiempos. **C:** consejo nuevo |

---

## Punto de partida (verifícalo contra el código y la bitácora de la fase 0)

**Datos y servicios**

- `Meal` (`src/types.ts`): `id`, `name`, `time` (ISO), `macros` e `imageUrl?`. No tiene tiempo de comida.
- `src/services/dailyLogService.ts` tiene `addMealToDailyLog` y `removeMealFromDailyLog` (transacciones), pero **no hay update**. Tiene tests de emulador.

**UI de comidas**

- `src/components/FoodDialog.tsx` (`isOpen`, `onClose`, `initialData`):
  - flujo upload → análisis → edición → guardado;
  - registra con `time = now` en la fecha `selectedDate` del contexto `useHeaderScroll` (`app/(tabs)/_layout.tsx`), que es donde se renderiza el diálogo.
- `src/components/MealCard.tsx` (`meal`, `onDelete`) muestra la hora. `MealList.tsx` lista las comidas.
- `app/(tabs)/plan.tsx > handleRegisterMeal(categoryType, option)` registra una opción del plan.

**Consejo actual** (`app/(tabs)/index.tsx`)

- `fetchAdvice` regenera si:
  - cambian los macros;
  - cambia el periodo (`getTimeOfDayPeriod`: mañana/tarde/noche);
  - pasaron 3 h;
  - o se fuerza.
- Guarda `aiAdvice`, `aiAdviceUpdatedAt` y `adviceMacros` en el `dailyLog`.
- En la tarjeta "AI Coach Card", tocar ✨ fuerza la regeneración.

**Después de la fase 0**

- Los planes subidos de nuevo traen `meals[].slot`, `options[].macros` e `ingredients[].macros`. **Los planes viejos no**: hay que tolerarlo, usando `slotFromLabel` y saltándose el ajuste si faltan macros.
- `obtenerConsejoPive` recibe `localDate` y ya no `bodyMetrics`.

---

## Contratos

### Lógica pura (`functions/src/shared/meals/`)

```ts
// dayStructure.ts
export interface SlotWindow { start: string; end: string } // "HH:mm"
export interface DayStructureSlot { slot: PlannedSlot; weight: number; window: SlotWindow }
export interface DayStructure { source: 'plan' | 'user' | 'default'; slots: DayStructureSlot[] }
export const DEFAULT_WINDOWS: Record<PlannedSlot, SlotWindow>;
// breakfast 05:00–10:30 · morning_snack 10:00–11:30 · lunch 11:00–15:30
// afternoon_snack 15:00–18:30 · dinner 18:30–23:00
export const DEFAULT_DAY_STRUCTURE: DayStructure;
// breakfast 25 · lunch 35 · afternoon_snack 10 · dinner 30
export function deriveDayStructureFromPlan(plan: PlanLike): DayStructure | null;
// Pesos = promedio de kcal de las opciones de cada tiempo, normalizado a 100.
// Si faltan macros → pesos por defecto según el tiempo.
export function resolveDayStructure(p: { dayStructure?: DayStructure; nutritionalPlan?: PlanLike }): DayStructure;
// Prioridad: usuario > plan > defecto. La del plan NO se guarda: se calcula al vuelo.

// slots.ts (se suma a los enums de la fase 0)
export type SlotSource = 'suggested' | 'mentioned' | 'plan' | 'user';
export type SlotReason = 'mentioned' | 'plan' | 'time' | 'size' | 'late' | 'same_slot' | 'first_unlogged' | 'fallback';
export interface SuggestSlotInput {
  time: string;                       // "HH:mm" local
  isToday: boolean;
  calories: number;
  structure: DayStructure;
  goals: Macros;
  dayMeals: Array<{ slot?: MealSlot; time: string /* "HH:mm" */; macros: Macros }>;
  mentionedSlot?: MealSlot | null;
  planSlot?: PlannedSlot | null;
}
export function suggestMealSlot(input: SuggestSlotInput): { slot: MealSlot; reason: SlotReason };
export function inferSlot(meal: { time: string; macros: Macros }, ctx: Omit<SuggestSlotInput, 'time' | 'calories' | 'isToday'>): MealSlot;
// Para comidas viejas sin slot

// budget.ts
export type SlotState = 'logged' | 'next' | 'pending' | 'missed';
export interface SlotStatus {
  slot: PlannedSlot;
  state: SlotState;
  consumed: Macros;
  budget: Macros | null;  // null si logged o missed
  isLastOfDay: boolean;
  light: boolean;         // restante ≤ 0
}
export function computeSlotStatuses(input: {
  now: string;            // "HH:mm"
  isToday: boolean;       // en días pasados nada queda "pending" por hora
  structure: DayStructure;
  goals: Macros;
  meals: Array<{ slot: MealSlot; macros: Macros }>;
}): { slots: SlotStatus[]; remaining: Macros; extras: Macros; next: PlannedSlot | null };

// complements.ts
export interface Complement {
  id: string; name: string; aliases: string[];
  group: 'protein' | 'carb' | 'fat' | 'dairy' | 'fruit' | 'vegetable';
  per100g: Macros;
  minGrams: number; maxGrams: number; step: number;
  piece?: { label: string; grams: number }; // "clara" ≈ 33 g, para redactar "3 claras"
}
export const COMPLEMENTS: Complement[];
export const COMPLEMENTS_REVIEWED: boolean; // false hasta que el usuario o su nutricionista revise

// planFit.ts
export const FIT = {
  asIsKcalTolerance: 0.10,
  asIsProteinToleranceG: 5,
  maxSuggestions: 3,
} as const;
export interface ComplementSuggestion { complementId: string | null; name: string; grams: number; adds: Macros; fromPlan: boolean }
export interface PortionReduction { ingredientIndex: number; name: string; fromQuantity: number; toQuantity: number; unit: string; removes: Macros }
export interface PlanOptionFit {
  optionIndex: number;
  title: string;
  macros: Macros;
  gap: Macros;                 // presupuesto − opción
  verdict: 'as_is' | 'add' | 'reduce';
  complements: ComplementSuggestion[];
  reductions: PortionReduction[];
}
export function fitPlanOptions(input: {
  options: PlanOptionLike[];   // con macros por ingrediente
  budget: Macros;
  planFoods: IngredientWithMacros[]; // todos los ingredientes del plan → complementos "fromPlan"
  complements: Complement[];
  excludeFoods?: string[];     // la Fase 2 lo llena desde la memoria; aquí va vacío
}): PlanOptionFit[];           // ordenadas por ajuste (proteína, luego kcal)
export function buildMealFromFit(
  fit: PlanOptionFit,
  option: PlanOptionLike,
  choice: { complementIndex?: number | null; reductionIndex?: number | null },
  slot: MealSlot,
): { name: string; ingredients: IngredientWithMacros[]; macros: Macros; slot: MealSlot };
```

**Umbrales de `suggestMealSlot`** (constantes exportadas):
- tolerancia de ventana: ±30 min;
- una comida principal necesita ≥ 30% del presupuesto de su tiempo;
- un almuerzo o cena tardío necesita ≥ 60% del presupuesto de un tiempo que pasó sin registrarse.

### Contexto para la IA (`functions/src/ai/context/day.ts`, puro, sin SDK)

```ts
export function formatDayContext(input: {
  weekday: string; now: string;
  statuses: ReturnType<typeof computeSlotStatuses>;
  dayMeals: Array<{ slot: MealSlot; time: string; name: string; macros: Macros }>;
  nextSlotFits: PlanOptionFit[] | null;   // null si no hay plan para ese tiempo
}): string; // formato de diseno.md §3.8
```

### Datos

```ts
// src/types.ts
interface Meal { /* … */ slot?: MealSlot; slotSource?: SlotSource }
interface UserProfile { /* … */ dayStructure?: DayStructure }     // solo si el usuario la personalizó
interface DailyLog { /* … */ adviceSlot?: PlannedSlot | null; adviceProposal?: AdviceProposal | null }
interface AdviceProposal { slot: MealSlot; name: string; macros: Macros; ingredients: IngredientWithMacros[] }

// src/services/dailyLogService.ts
export const updateMealInDailyLog: (
  uid: string, date: string, mealId: string,
  patch: Partial<Pick<Meal, 'slot' | 'slotSource' | 'time'>>,
) => Promise<void>; // transacción; no toca los macros del día
```

### Consejo (`obtenerConsejoPive`)

```ts
// Request nuevo
{ localDate: 'YYYY-MM-DD'; localTime: 'HH:mm' }

// Response
{ advice: string; slot: PlannedSlot | null; proposal: AdviceProposal | null }
// Mantiene la clave `advice` por compatibilidad

// Esquema que devuelve el modelo (salida estructurada)
{ text: string; optionIndex: number | null; complementIndex: number | null; reductionIndex: number | null }
```

**El servidor:**

1. Lee `users/{uid}` y `users/{uid}/dailyLogs/{localDate}` con el `db` de la fase 0.
2. Resuelve la estructura del día e infiere el tiempo de las comidas viejas.
3. Calcula `computeSlotStatuses` y, si hay plan para el próximo tiempo, `fitPlanOptions`.
4. Arma `formatDayContext` y llama al modelo.
5. **Valida los índices**: si están fuera de rango, los pone en `null`.
6. Construye `proposal` con `buildMealFromFit` y registra el uso.

**Compatibilidad:** si llega el payload viejo (con `dailyMacros`), responde con la lógica anterior. Márcalo con `// TODO(fase-3): quitar ruta vieja`.

---

## Tareas

### PR A: lógica pura

1. `dayStructure.ts`, `slots.ts` (lógica), `budget.ts`, `planFit.ts` y `complements.ts`, con sus tests.
2. **Tabla de complementos:** 30–40 alimentos comunes en Latinoamérica, con valores por 100 g de tablas públicas de composición (por ejemplo, USDA FoodData Central). Deja `COMPLEMENTS_REVIEWED = false`.
   - **Proteína:** pechuga de pollo, atún en agua, claras, huevo, queso tierno / fresco / blanco, queso cottage, yogur griego natural, carne molida magra, frijoles cocidos, lentejas cocidas, tofu, jamón de pavo.
   - **Carbohidrato:** arroz cocido, tortilla de maíz, pan integral, avena, papa cocida, camote, plátano maduro, pasta cocida.
   - **Grasa:** aguacate, aceite de oliva, maní, almendras, mantequilla de maní.
   - **Lácteo:** leche descremada.
   - **Fruta:** banano, manzana, fresas, papaya.
   - **Verdura:** ensalada verde, brócoli, zanahoria.
3. `formatDayContext` con tests de snapshot.

### PR B: datos y UI de tiempos

1. **Tipos y servicio:** tipos nuevos; `updateMealInDailyLog` con test de emulador.
2. **`FoodDialog`:**
   - en el paso de edición, una fila de chips con `MEAL_SLOT_LABELS`, la sugerencia preseleccionada y su razón: "Sugerido por la hora", "Lo dijiste en la descripción", "De tu plan", "Por la cantidad";
   - necesita las comidas del día y la estructura: leer el `dailyLog` de `selectedDate` y el perfil (`useAuth`);
   - guarda `slot` y `slotSource` (`user` si se cambió el chip).
3. **Favoritos y entrada manual:** la sugerencia sale solo por hora y cantidad.
4. **`plan.tsx > handleRegisterMeal`:** usa `category.slot` (o `slotFromLabel(category.type)`) con `slotSource: 'plan'`.
5. **`MealCard`:**
   - muestra la etiqueta del tiempo;
   - al tocarla, un selector (reutilizar `src/components/Modal.tsx`) llama a `updateMealInDailyLog` con `slotSource: 'user'`;
   - opcional: editar la hora en el mismo selector.
6. **Perfil, "Mis comidas del día"** (`src/components/profile/MealStructureSection.tsx`):
   - muestra la estructura resuelta y su origen ("según tu plan" / "personalizada" / "por defecto");
   - permite activar o desactivar tiempos y editar horarios (HH:mm validado);
   - al guardar escribe `dayStructure` con `source: 'user'`;
   - botón "Volver a los tiempos de mi plan", que borra el campo.
7. **Subida de plan con estructura personalizada:** en `plan.tsx`, preguntar "¿Usar los tiempos de tu nuevo plan?". Si la respuesta es sí, borrar `dayStructure`.
8. **Opcional, recomendado:** una franja en el dashboard con los tiempos del día y su presupuesto (los mismos números que el consejo).

### PR C: consejo nuevo

1. **Servidor:** implementar según el contrato.
   - `systemInstruction` = `PIVE_CORE` (con las reglas de diseno §3.7) + `NUTRITION_RULES` + tarea.
   - La tarea dice: "habla de la próxima comida; si es la última del día, dilo; usa solo las cantidades del contexto; máximo 2 frases".
2. **Cliente** (`getPiveAdvice({ localDate, localTime })`):
   - devuelve `{ advice, slot, proposal }`;
   - `index.tsx` regenera cuando cambia `next` (calculado en el cliente con `computeSlotStatuses`), cuando cambian los macros, cuando pasan más de 3 h o cuando se fuerza;
   - guarda `adviceSlot` y `adviceProposal` junto a `aiAdvice`.
3. **Tarjeta del consejo:**
   - si hay `adviceProposal`, mostrar **[Registrar así]**;
   - al tocarlo: `addMealToDailyLog` con `slotSource: 'plan'`, háptica, y limpiar `adviceProposal`;
   - el resto de la tarjeta queda igual: el rediseño es de la fase 3.
4. **Mantener la ruta vieja** del servidor con el `TODO(fase-3)`.

---

## Tests a escribir

**`suggestMealSlot`** (con la estructura por defecto y metas de 2,000 kcal):

| Hora | kcal | Ya registrado | Esperado |
|---|---|---|---|
| 12:20 | 950 | breakfast | `lunch` (`time`) |
| 11:15 | 180 | breakfast | `extra` (`size`): la estructura por defecto no tiene `morning_snack` |
| 11:15 | 180 | breakfast, con `morning_snack` en la estructura | `morning_snack` |
| 16:30 | 900 | breakfast | `lunch` (`late`) |
| 13:10 | 200 | breakfast, lunch 12:30 | `lunch` (`same_slot`) |
| 22:30 | 150 | todo | `extra` (`fallback`) |
| cualquiera | — | con `mentionedSlot: 'dinner'` | `dinner` (`mentioned`) |
| cualquiera | — | con `planSlot: 'lunch'` | `lunch` (`plan`) |
| `isToday = false` | — | breakfast | `lunch` (`first_unlogged`) |

**`computeSlotStatuses`:**
- solo falta la cena con 600 kcal → cena 600, `isLastOfDay`;
- faltan almuerzo, merienda y cena con 1,100 → ≈ 513 / 147 / 440;
- un tiempo pasado sin registrar → `missed`, sin presupuesto;
- restante negativo → `light` en todos los pendientes;
- los `extra` cuentan en el consumo pero no reservan.

**`fitPlanOptions`:**
- el ejemplo de diseno §3.8 (falta proteína → queso tierno del plan primero);
- una opción dentro de la tolerancia → `as_is`;
- sobra → reducción del ingrediente que más aporta, sin llegar a 0;
- `excludeFoods` saca un complemento;
- un plan sin macros por ingrediente → no rompe (sin ajuste).

**Otros:**
- `buildMealFromFit`: macros = opción + complemento, o opción − reducción, sumados en código;
- `deriveDayStructureFromPlan`: pesos normalizados a 100;
- emulador: `updateMealInDailyLog` cambia el `slot` sin tocar los macros del día.

---

## Verificación

```bash
npm run lint && npx tsc --noEmit && npx tsc --noEmit -p functions && npm test && npm run build
npm run test:emulator
```

**Manual** (en local, con key; o después del deploy en la PWA):

1. A las 12:20, subir la foto de un almuerzo: el chip propone "Almuerzo". Cambiarlo a "Merienda" y luego corregirlo desde la tarjeta de la comida.
2. Con un plan cargado: el consejo nombra una opción del plan con su complemento o reducción, y [Registrar así] agrega la comida con los macros correctos.
3. Sin plan: el consejo respeta el presupuesto del próximo tiempo.
4. En un día pasado: se sugiere el primer tiempo sin registrar.
5. Opcional: capturas con Playwright a 390 px de ancho del `FoodDialog` con chips y de la tarjeta del consejo.

---

## Fuera de alcance

- Filtrar complementos por memoria: la Fase 2 llena `excludeFoods`.
- El chat y el rediseño de la tarjeta (Fase 3).
- Aprender horarios del historial (futuro, opcional).

## Preguntar al usuario

- Revisión de la tabla de complementos. Hasta entonces, `COMPLEMENTS_REVIEWED = false`.
- Si los pesos y ventanas por defecto no coinciden con su día.

---

## Al terminar

- [ ] `README.md` de la raíz: `obtenerConsejoPive` ahora lee Firestore y tiene un request nuevo.
- [ ] `docs/plan/README.md`: estado, PRs y bitácora.
- [ ] Notas para las fases 2 y 3 en la bitácora:
  - dónde quedó `formatDayContext`;
  - que `excludeFoods` está listo;
  - que existe el `TODO(fase-3)` de la ruta vieja.
- [ ] **Deploy** (lo hace el usuario): Functions → reglas → mergear la app.

---

## Prompt de arranque

```
Vamos a implementar la Fase 1 del plan de Pive Coach (comidas por tiempo + el plan como base del consejo).

1. Lee CLAUDE.md, docs/plan/README.md (incluida la bitácora de la Fase 0) y docs/plan/fase-1-comidas-por-tiempo.md completo, y la sección §3 de docs/plan/diseno.md.
2. Confirma en la tabla de estado que la Fase 0 esté hecha. Si no, avísame antes de empezar.
3. Revisa el "Punto de partida" contra el código actual. Si algo no coincide, dímelo y propón el ajuste antes de cambiar nada.
4. Marca la fase como "En curso". Empieza por el PR A (lógica pura con todos los tests de la tabla), luego el B (datos y UI) y luego el C (consejo).
5. Corre las verificaciones de la fase en cada PR.
6. Al terminar: actualiza el estado y la bitácora en docs/plan/README.md, deja notas para las Fases 2 y 3 y abre el PR.
```
