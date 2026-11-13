# Fase 3: Chat + planes y límites

**Objetivo:**

1. **Chat con Pive**, que se abre desde la tarjeta del consejo, con herramientas que leen tu día y tu plan.
2. **Sesiones**, y una memoria que se consolida sola después de cada conversación.
3. **Límites por plan de usuario:** hoy todos son `beta`, pero queda listo para un premium futuro.

| | |
|---|---|
| **Depende de** | Fase 1: `computeSlotStatuses`, `fitPlanOptions`, `buildMealFromFit`, `formatDayContext`, `suggestMealSlot`. Fase 2: memoria, `consolidateSession`, ubicación |
| **Desbloquea** | Herramienta de rutinas en el chat (Fase 4) |
| **Leer antes** | `diseno.md` §6 (chat), §7 (planes y límites), §4.3 (consolidación) y §5 (ubicación) |
| **PRs sugeridos** | **A:** planes y límites. **B:** backend del chat + consolidación programada. **C:** UI del chat y tarjeta del consejo |

---

## Punto de partida (verifícalo contra el código y la bitácora)

**Lo que dejaron las fases anteriores**

- `recordUsage` y `users/{uid}/usage/{fecha}` (Fase 0).
- `db` en Functions con la base con nombre (Fase 0).
- El consejo devuelve `{ advice, slot, proposal }`, y la tarjeta tiene [Registrar así] (Fase 1).
- Hay un `TODO(fase-3)` con la ruta vieja de `obtenerConsejoPive`.
- `consolidateSession(uid, userMessages, localDate)` existe pero no está programada (Fase 2).
- `refreshAutoLocation({ allowPrompt })` existe (Fase 2).

**App**

- `app/_layout.tsx`: un `Stack` con `auth`, `(tabs)` y `profile` (`presentation: 'modal'`).
- `vercel.json` reescribe cualquier ruta a `index.html`, así que `/chat` funciona como enlace directo en la PWA.
- `src/services/geminiService.ts > callCloudFunction`: ante una respuesta no OK lanza `Error(texto)`, sin distinguir códigos.
- `FoodDialog` acepta `initialData` (hoy se renderiza en `app/(tabs)/_layout.tsx`).

**Infraestructura**

- `firebase.json` **no tiene `firestore.indexes.json`**.

---

## Contratos

### Planes y límites (`functions/src/limits.ts`)

```ts
export type Tier = 'beta' | 'free' | 'premium';

export interface Entitlements {           // users/{uid}/private/entitlements (solo servidor)
  tier: Tier;
  source: 'default' | 'manual' | 'stripe' | 'revenuecat';
  since: number;
  expiresAt?: number;
}

export type LimitedFeature = 'chat' | 'routine' | 'analysis';
// 'analysis' = comida, plan, composición y rutina subidas

export const PLAN_LIMITS: Record<Tier, {
  chatPerDay: number;
  routinesPerMonth: number;
  analysesPerDay: number;
  memoryFacts: number;
  chatModel: 'light' | 'heavy';
}>;
// beta:    { chatPerDay: 50,  routinesPerMonth: 10, analysesPerDay: 40, memoryFacts: 40, chatModel: 'light' }
// free:    { chatPerDay: 10,  routinesPerMonth: 1,  analysesPerDay: 15, memoryFacts: 20, chatModel: 'light' }
// premium: { chatPerDay: 100, routinesPerMonth: 20, analysesPerDay: 80, memoryFacts: 60, chatModel: 'light' }

export async function getTier(uid: string): Promise<Tier>; // sin documento → 'beta'
export async function checkAndConsume(uid: string, feature: LimitedFeature, localDate: string):
  Promise<{ ok: true; remaining: number } | { ok: false; resetAt: string }>;
// Transacción sobre usage/{YYYY-MM-DD} (diario) o usage/{YYYY-MM} (mensual)
```

**Cuando se pasa del límite:** HTTP **429** con `{ code: 'limit_reached', feature, resetAt }`.

**En la app:**
- `callCloudFunction` lanza `LimitReachedError { feature, resetAt }` ante un 429;
- `useEntitlements()` → `{ tier, remaining: { chat, analyses }, loading }`, leyendo `private/entitlements` y `usage/{hoy}`.

### Chat

```ts
// Endpoint chatPive (POST)
type ChatRequest = {
  sessionId?: string;
  message: string;
  localDate: string;       // YYYY-MM-DD
  localTime: string;       // HH:mm
  quickAction?: 'ate_out' | 'next_meal' | 'protein' | 'trained';
};
type ChatResponse = {
  sessionId: string;
  reply: ChatMessage;
  proposals: MealProposal[];
  remainingToday: number;
};

// Endpoint chatPiveAccion (POST): lo que el cliente no puede escribir directo
type ChatActionRequest =
  | { sessionId: string; action: 'feedback'; messageId: string; value: 'up' | 'down' | null }
  | { sessionId: string; action: 'proposal'; proposalId: string; status: 'logged' | 'dismissed' };

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'notice';
  text: string;
  createdAt: number;
  feedback?: 'up' | 'down';
}

interface MealProposal {
  id: string;
  slot: MealSlot;
  name: string;
  macros: Macros;
  ingredients: IngredientWithMacros[];
  status: 'pending' | 'logged' | 'dismissed';
}

// users/{uid}/coachSessions/{sessionId} (solo servidor; el dueño lee)
interface CoachSession {
  localDate: string;
  startedAt: number;
  lastMessageAt: number;
  messages: ChatMessage[];
  summary?: string;
  summarizedUpTo?: number;            // índice del último mensaje resumido
  proposals: MealProposal[];
  consolidated: boolean | 'skipped';
}
```

### Herramientas del modelo (`functions/src/chat/tools.ts`)

El `uid` **siempre sale del token**, nunca de los argumentos.

| Herramienta | Argumentos | Devuelve | Usa |
|---|---|---|---|
| `getDaySummary` | `date?` | Texto de `formatDayContext` sin las opciones | `computeSlotStatuses` |
| `getPlanOptions` | `slot` | Opciones ajustadas para ese tiempo (formato de diseno §3.8) | `fitPlanOptions` + `avoidedFoods` |
| `estimateMeal` | `description` | Ingredientes, macros, supuestos y tiempo sugerido | La lógica de `analizarImagenComida` (solo texto) + `suggestMealSlot` |
| `proposeMealLog` | `{ name, slot, ingredients }` | Crea una `MealProposal` pendiente. Los macros los suma el código | `mealMacrosFromIngredients` |
| `getTraining` | `date?` | El día del plan de entreno y los entrenos completados | `workoutPlan`, `workoutHistory` |

### Reglas e índices

```
match /coachSessions/{id} { allow read: if isOwner(userId); allow write: if false; }
match /private/{docId}    { allow read: if isOwner(userId); allow write: if false; }
```

**Índice** de grupo de colecciones `coachSessions`: `consolidated ASC, lastMessageAt ASC`.
- Va en un `firestore.indexes.json` nuevo.
- Hay que referenciarlo en la entrada `firestore` de `firebase.json`: es la de la base con nombre.

---

## Tareas

### PR A: planes y límites

1. `limits.ts` según el contrato.
2. **Contar `analysis`** en los 4 endpoints de análisis, antes de llamar al modelo.
3. **Reglas de `private/`** + tests de emulador: el cliente no escribe en `private` ni en `usage`; el dueño lee.
4. **App:**
   - `LimitReachedError` en `callCloudFunction`;
   - `useEntitlements()`;
   - mensajes amables en `FoodDialog`, el plan, la rutina y la composición: "Llegaste al límite de hoy, se reinicia mañana".

### PR B: backend del chat

1. **`chatPive`:**
   1. auth;
   2. `checkAndConsume('chat')`;
   3. sesión: se reutiliza la del día si `lastMessageAt` tiene menos de 6 h; si no, se crea una nueva;
   4. carga memoria, ubicación y contexto del día;
   5. bucle de herramientas, con máximo 3 vueltas; después se fuerza la respuesta final sin herramientas;
   6. guarda los mensajes y las propuestas;
   7. `recordUsage('chat')`.
   - `systemInstruction` = `PIVE_CORE` + `NUTRITION_RULES` + `TRAINING_RULES` + tarea del chat, que incluye las instrucciones de "estoy fuera" de diseno §6.3.
   - Modelo según `PLAN_LIMITS[tier].chatModel`. `maxOutputTokens` acotado y *thinking* bajo.
2. **Sesión nueva:**
   - si existe `dailyLog.aiAdvice`, el primer mensaje del asistente es el consejo del día;
   - si `memory.noticeSeenAt` no existe, se agrega un mensaje `notice` con el aviso de memoria y se guarda `noticeSeenAt`.
3. **Resumen:** con más de 10 turnos, los anteriores se resumen en `summary` con una llamada ligera, que cuenta como `chat` en el uso.
4. **`chatPiveAccion`:** feedback y estado de las propuestas.
5. **`consolidarMemoria`** (`onSchedule('every 30 minutes')`):
   - consulta de grupo `coachSessions` con `consolidated == false` y `lastMessageAt < now − 30 min`, hasta 50 por corrida;
   - `consolidateSession` con los mensajes `user`;
   - marca `consolidated: true`, o `'skipped'` si la memoria está apagada.
6. **Respaldo:** al crear una sesión nueva, si la anterior del usuario quedó sin consolidar, se consolida antes.
7. **Quitar la ruta vieja** de `obtenerConsejoPive` (`TODO(fase-3)`).
8. **Evals locales** (opcional, con key), 8 escenarios. Revisar las herramientas llamadas y que no haya números inventados:
   - "comí fuera" con descripción;
   - "¿qué ceno?" sin plan;
   - con plan cuando sobra;
   - alergia en la memoria;
   - fuera de tema;
   - pedir una receta;
   - "¿cómo voy hoy?";
   - pregunta de entreno.

### PR C: UI

1. **Tarjeta del consejo** (`app/(tabs)/index.tsx`), según diseno §6.1:
   - campo "Pregúntale a Pive…";
   - atajos calculados con `computeSlotStatuses` (próximo tiempo, proteína restante) y el historial de entrenos;
   - botón ↻ visible para regenerar, en lugar del toque escondido en ✨;
   - "Continuar conversación" si ya hay una sesión hoy;
   - **solo en el día de hoy.**
2. **Ruta `app/chat.tsx`:**
   - registrarla en el `Stack` de `app/_layout.tsx` con `presentation: 'modal'`;
   - acepta `?q=` (atajo, se envía solo) y `?focus=1` (abre el teclado).
3. **Componentes** (`src/components/chat/`): `ChatMessageList`, `ChatInput`, `ProposalCard`, `NoticeBubble`.
   - Hook `useChatSession` con `onSnapshot` sobre la sesión de hoy (lectura permitida).
4. **`ProposalCard`:**
   - tiempo editable (chips);
   - **[Registrar]** → `addMealToDailyLog` + `chatPiveAccion(proposal, 'logged')`;
   - **[Editar]** → `FoodDialog` renderizado dentro de la pantalla del chat con `initialData`.
5. **Al abrir el chat:**
   - si la ubicación está en modo `auto` y tiene más de 6 h → `refreshAutoLocation({ allowPrompt: true })`;
   - si no hay ubicación y no se preguntó → se muestra el aviso de ubicación (mismo componente del banner).
6. **Límites:**
   - con 3 o menos mensajes restantes: "Te quedan N mensajes hoy";
   - con `LimitReachedError`: una burbuja que dice cuándo se reinicia.
7. **Accesibilidad y teclado:**
   - `accessibilityRole` y `accessibilityLabel`;
   - mensajes nuevos con `accessibilityLiveRegion="polite"`;
   - 44 pt;
   - `KeyboardAvoidingView`;
   - en web, Enter envía y Shift+Enter hace salto de línea.
8. **👍/👎** en las respuestas del asistente (con `chatPiveAccion`).

---

## Tests a escribir

- **`checkAndConsume`** (emulador o lógica pura extraída): consume, se agota → `ok: false` con `resetAt` del día siguiente; los límites mensuales usan `YYYY-MM`.
- **Lógica de sesión** (pura): reutilizar si `lastMessageAt` tiene menos de 6 h; recortar a 10 turnos + `summary`; el primer mensaje es el consejo; el aviso de memoria sale una sola vez.
- **Herramientas** (puras, con datos de ejemplo):
  - `proposeMealLog` suma los macros en código e ignora macros que vengan del modelo;
  - `getPlanOptions` respeta `avoidedFoods`.
- **Selección de la consolidación** (pura): sesiones elegibles por estado y antigüedad.
- **Atajos de la tarjeta** (puros): dependen del próximo tiempo, de la proteína restante y de si hubo entreno.
- **Emulador:** reglas de `coachSessions` y `private`.

---

## Verificación

```bash
npm run lint && npx tsc --noEmit && npx tsc --noEmit -p functions && npm test && npm run build
npm run test:emulator
```

**Manual** (después del deploy, en la PWA del iPhone):

1. Tocar "Comí fuera" en la tarjeta: abre el chat, se envía el mensaje, Pive estima la comida, propone su tiempo y da opciones del plan ajustadas.
2. [Registrar] agrega la comida y la tarjeta del consejo se actualiza.
3. Al día siguiente (o 30 min después de la sesión): la memoria refleja lo dicho.
4. Forzar el límite (bajar `chatPerDay` en un entorno de prueba): sale el mensaje de límite.
5. Ruta `/chat` directa en la PWA.

---

## Pasos del usuario

1. **Desplegar:** Functions (incluida la programada) → reglas → índices (`npx firebase-tools deploy --only firestore:indexes`) → app.
2. **Comprobar en Google Cloud** que `consolidarMemoria` aparece en Cloud Scheduler.
3. **Dar un plan de pago a mano (opcional):** crear `users/{uid}/private/entitlements` desde la consola de Firebase.

## Fuera de alcance

- Cobro (Stripe o RevenueCat).
- Streaming (opcional).
- "Acuerdos del día" (opcional).
- Herramienta de rutinas (Fase 4).

---

## Al terminar

- [ ] `README.md` de la raíz:
  - endpoints `chatPive`, `chatPiveAccion` y `consolidarMemoria`;
  - límites;
  - índices y cómo desplegarlos.
- [ ] `docs/plan/README.md`: estado, PRs y bitácora.
- [ ] Notas para la Fase 4: cómo registrar una herramienta nueva en `functions/src/chat/tools.ts`.

---

## Prompt de arranque

```
Vamos a implementar la Fase 3 del plan de Pive Coach (chat + planes y límites).

1. Lee CLAUDE.md, docs/plan/README.md (incluida la bitácora de las fases 0–2) y docs/plan/fase-3-chat-limites.md completo, y las secciones §4.3, §5, §6 y §7 de docs/plan/diseno.md.
2. Confirma en la tabla de estado que las Fases 1 y 2 estén hechas. Si no, avísame antes de empezar.
3. Revisa el "Punto de partida" contra el código actual. Si algo no coincide, dímelo y propón el ajuste antes de cambiar nada.
4. Marca la fase como "En curso". Haz el PR A (planes y límites), luego el B (backend del chat y consolidación) y luego el C (UI).
5. Corre las verificaciones de la fase en cada PR.
6. Al terminar: actualiza el estado y la bitácora en docs/plan/README.md, deja notas para la Fase 4, recuérdame los pasos de deploy (incluidos los índices) y abre el PR.
```
