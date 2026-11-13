# Fase 2: Memoria + ubicación

**Objetivo:**

1. **Memoria:** Pive recuerda hechos duraderos del usuario. Está activa por defecto, se puede ver, editar, desactivar y borrar, y no acumula basura.
2. **Ubicación:** Pive conoce la ciudad y el país del usuario, en modo automático, manual o desactivado.
3. Ambas entran al consejo del día, y la memoria filtra los complementos.

La **consolidación desde el chat** se construye y se prueba aquí, pero se programa en la Fase 3, cuando exista el chat.

| | |
|---|---|
| **Depende de** | Fase 0 (`shared/`, `db`, `recordUsage`) y Fase 1 (el consejo lee Firestore en el servidor; `fitPlanOptions` acepta `excludeFoods`) |
| **Desbloquea** | Fase 3 (el chat usa la memoria y la ubicación, y programa la consolidación) |
| **Leer antes** | `diseno.md` §4 (memoria) y §5 (ubicación) |
| **PRs sugeridos** | **A:** memoria. **B:** ubicación |

---

## Punto de partida (verifícalo contra el código y la bitácora)

- **Consejo:** el servidor de `obtenerConsejoPive` lee el perfil y el `dailyLog`, y arma el contexto con `formatDayContext` (Fase 1).
- **Perfil** (`app/profile.tsx`): secciones `PersonalInfoSection` y `AppleHealthSection` (esta solo en iOS), en `src/components/profile/`, con estilos en `sectionStyles.ts`.
- **Dashboard** (`app/(tabs)/index.tsx`): el banner "¡Completa tu perfil!" es el patrón visual para el aviso de ubicación.
- **Plan** (`app/(tabs)/plan.tsx > handleUpload`): guarda `nutritionalPlan.restrictions` (Fase 0).
- **`firestore.rules`:** `users/{uid}` lo escribe el dueño; las subcolecciones van explícitas; lo demás está denegado.
- **Dependencias:** `expo-location` **no está instalado**.

---

## Contratos

### Memoria (`functions/src/shared/memory/`, puro)

```ts
export type MemoryCategory =
  | 'allergy' | 'restriction' | 'food' | 'injury'
  | 'schedule' | 'equipment' | 'goal' | 'context';
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string>;
// Alergia, Restricción, Alimento, Lesión, Horario, Equipo, Objetivo, Contexto
export const MEMORY_KEY_RE = /^(allergy|restriction|food|injury|schedule|equipment|goal|context)\.[a-z0-9_]{2,40}$/;

export interface MemoryFact {
  key: string;                    // "food.pan_cuadrado"
  category: MemoryCategory;
  text: string;                   // ≤ 120 caracteres
  foods?: string[];               // alimentos normalizados que menciona
  stance?: 'avoid' | 'prefer';
  source: 'chat' | 'plan' | 'app';
  evidence?: string;
  createdAt: number;
  updatedAt: number;
  lastConfirmedAt: number;
  expiresAt?: number;
  previous?: { text: string; updatedAt: number };
}

export interface CoachMemory {
  enabled: boolean;               // si el documento no existe → se trata como { enabled: true, facts: {} }
  noticeSeenAt?: number;
  facts: Record<string, MemoryFact>;
  updatedAt: number;
}

export type MemoryOp =
  | { op: 'create' | 'update'; key: string; category: MemoryCategory; text: string;
      foods?: string[]; stance?: 'avoid' | 'prefer'; expiresAt?: string | null; evidence: string }
  | { op: 'delete' | 'confirm'; key: string; evidence: string };

export const DEFAULT_MAX_FACTS = 40;    // en la Fase 3 sale de PLAN_LIMITS
export const STALE_AFTER_DAYS = 180;

export function normalizeText(s: string): string;
// minúsculas, sin acentos, espacios colapsados

export function validateMemoryOps(
  ops: MemoryOp[], memory: CoachMemory, userMessages: string[], now: number,
): { accepted: MemoryOp[]; rejected: Array<{ op: MemoryOp; reason: string }> };
// Reglas: la evidencia aparece en los mensajes; la clave cumple MEMORY_KEY_RE y coincide con la categoría;
// el texto tiene ≤ 120 caracteres; create sobre clave existente → update; update sin clave → create;
// allergy solo con evidencia explícita.

export function applyMemoryOps(memory: CoachMemory, ops: MemoryOp[], now: number, source: MemoryFact['source']): CoachMemory;
// Guarda `previous` y aplica el tope.

export function pruneMemory(memory: CoachMemory, now: number, maxFacts: number): {
  memory: CoachMemory;
  removed: string[];
  toConfirm: string[];
};
// Quita los vencidos; marca los viejos de food/schedule/equipment; el tope nunca borra allergy ni injury.

export function replacePlanFacts(memory: CoachMemory, restrictions: string[], now: number): CoachMemory;
// Borra todos los hechos source='plan' y crea `restriction.plan_<slug>` por cada restricción.

export function avoidedFoods(memory: CoachMemory): string[];
// foods de los hechos con stance 'avoid', más las alergias
```

**Contexto** (`functions/src/ai/context/memory.ts`, puro):

```ts
export function formatMemoryContext(memory: CoachMemory, now: number): string; // formato de diseno.md §4.8
```

**Consolidación** (`functions/src/memory/consolidate.ts`, servidor):

```ts
export async function consolidateSession(uid: string, userMessages: string[], localDate: string): Promise<'applied' | 'skipped' | 'empty'>;
// 1. Lee users/{uid}/coach/memory. Si enabled === false → 'skipped' (no llama al modelo).
// 2. Llama al modelo ligero con salida estructurada { operations: MemoryOp[] }.
// 3. validateMemoryOps → applyMemoryOps en una transacción.
// 4. recordUsage(uid, 'memory', …).
```

### Ubicación

```ts
// src/types.ts
export interface UserLocation {
  mode: 'auto' | 'manual' | 'off';
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;           // ISO 3166-1 alfa-2
  source?: 'gps' | 'manual';
  updatedAt?: number;
  askedAt?: number;
}
// UserProfile gana: location?: UserLocation; timeZone?: string

// src/services/locationService.ts (nativo, expo-location) y locationService.web.ts (navigator.geolocation)
export function getPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'>;
export function requestCoarsePosition(): Promise<{ lat: number; lng: number } | null>;
// Puede pedir permiso: llamar solo tras un toque del usuario
export function getCoarsePositionIfGranted(): Promise<{ lat: number; lng: number } | null>;
// Nunca pide permiso
export function roundCoords(p: { lat: number; lng: number }, decimals?: number): { lat: number; lng: number };
// 2 decimales por defecto

// src/services/locationProfileService.ts
export async function refreshAutoLocation(uid: string, opts: { allowPrompt: boolean }): Promise<UserLocation | null>;
// Coordenadas → redondeo → caché local (AsyncStorage, también funciona en web) → resolverUbicacion si cambiaron → guarda en el perfil
```

**Endpoint `resolverUbicacion`** (POST, autenticado):
- Request `{ lat: number; lng: number }`.
- El servidor valida los rangos y vuelve a redondear a 2 decimales.
- Response `{ city, region, country, countryCode }`, o 404 si no hay resultado.
- **Nunca registra coordenadas en los logs.**

**Parser** (`functions/src/location/parseGeocoding.ts`, puro): extrae `locality`, `administrative_area_level_1` y `country` (`long_name` / `short_name`) de la respuesta de la API de Geocoding.

### Reglas de Firestore

```
match /coach/{docId} {
  allow read, write: if isOwner(userId); // el dueño edita su memoria; el servidor escribe con Admin SDK
}
```

`users/{uid}.location` y `.timeZone` ya quedan cubiertos por la regla del documento del usuario.

---

## Tareas

### PR A: memoria

1. **Módulo puro** `functions/src/shared/memory/`, con los tests de abajo.
2. **Reglas de `coach/`** y test de emulador: el dueño lee y escribe; otro usuario no.
3. **Servicio de la app** (`src/services/memoryService.ts`):
   - suscripción con `onSnapshot`;
   - `setMemoryEnabled`, `updateFactText`, `deleteFact`, `deleteAllFacts`;
   - `applyPlanRestrictions(uid, restrictions)` usa `replacePlanFacts` en una transacción.
4. **Plan nutricional:** después de guardar un plan, `plan.tsx` llama a `applyPlanRestrictions`.
5. **Consolidación:**
   - `consolidateSession` con su prompt (reglas de `diseno.md` §4.3) y esquema;
   - **todavía no se programa** (Fase 3);
   - opcional: evals locales con key, con las conversaciones de los tests.
6. **Consejo:**
   - cargar la memoria si está activa;
   - `pruneMemory` (si cambió algo, se escribe de vuelta: limpieza perezosa);
   - `formatMemoryContext` en el prompt;
   - `excludeFoods: avoidedFoods(memory)` en `fitPlanOptions`.
7. **UI "Lo que Pive sabe de ti"** (`src/components/profile/MemorySection.tsx`, o una pantalla `app/memory.tsx` si queda larga):
   - hechos agrupados por `MEMORY_CATEGORY_LABELS`;
   - editar el texto y borrar cada hecho;
   - interruptor "Memoria activa";
   - "Borrar todo", con confirmación;
   - estado vacío ("Todavía no sé nada de ti. Cuéntame en el chat…").

### PR B: ubicación

1. **Instalar y configurar `expo-location`:**
   - `npx expo install expo-location`;
   - en `app.json`, el plugin con `locationWhenInUsePermission` = el texto del aviso;
   - en Android, solo ubicación aproximada: `android.permissions: ["ACCESS_COARSE_LOCATION"]` y `android.blockedPermissions: ["android.permission.ACCESS_FINE_LOCATION"]`. **Verifica la configuración exacta en la documentación de Expo SDK 54.**
2. **`locationService.ts` (nativo):** `Location.Accuracy.Low`; el permiso es "mientras se usa la app".
3. **`locationService.web.ts`:**
   - `navigator.geolocation.getCurrentPosition` con `enableHighAccuracy: false`, `maximumAge: 3600000` y `timeout: 10000`;
   - `getPermissionState` usa `navigator.permissions` si existe. **En iOS como PWA puede responder `prompt` aunque el permiso esté concedido**, así que no hay que basarse en eso para decidir.
4. **Endpoint `resolverUbicacion`:**
   - `https://maps.googleapis.com/maps/api/geocode/json?latlng=…&language=es&key=…`;
   - secreto `GEOCODING_API_KEY`;
   - `recordUsage(uid, 'location')` (solo cuenta llamadas).
5. **`timeZone`:** al abrir la app, si `Intl.DateTimeFormat().resolvedOptions().timeZone` es distinto del guardado, actualizar el perfil.
6. **Banner en el dashboard:**
   - se muestra si no hay `location` y `askedAt` no existe o tiene más de 30 días;
   - **[Usar mi ubicación]** → `mode: 'auto'` + `refreshAutoLocation({ allowPrompt: true })`;
   - **[Elegir manualmente]** → perfil;
   - **[Ahora no]** → guarda `askedAt`.
7. **Sección "Ubicación" en el perfil:**
   - selector Automática / Manual / Desactivada;
   - Manual: país (lista estática en `src/lib/countries.ts` con Latinoamérica, España, EE. UU., Canadá y "Otro") + ciudad;
   - Automática: "Detectada: Ciudad, País · hace X" y [Actualizar ahora].
8. **Refresco automático al abrir la app:** si el modo es `auto`, pasaron más de 6 h y `getPermissionState() === 'granted'` → `refreshAutoLocation({ allowPrompt: false })`. En cualquier otro caso no hace nada; el refresco al abrir el chat llega en la Fase 3.
9. **Consejo:**
   - `formatLocationContext` (`functions/src/ai/context/location.ts`);
   - la regla del núcleo: categorías genéricas si no conoce la zona; no inventar marcas ni locales.

---

## Tests a escribir

**Memoria, con conversaciones de ejemplo como entrada y operaciones esperadas como salida:**

| Caso | Entrada | Esperado |
|---|---|---|
| Pan cuadrado (crear) | Memoria vacía; "no me gusta el pan cuadrado" | `create food.pan_cuadrado`, `stance: avoid` |
| Pan cuadrado (actualizar) | Con el hecho; "ya me gusta el pan cuadrado, compré uno integral" | `update` del mismo key, guarda `previous` |
| Pan cuadrado (neutral) | Con el hecho; "ya no me molesta el pan cuadrado" | `delete` |
| Alergia | "soy alérgico al maní" | `create allergy.mani` |
| Alergia inferida | El modelo propone `allergy` sin evidencia explícita | Se rechaza |
| Viaje | "esta semana estoy de viaje en Lima" | `create context.viaje` con `expiresAt` |
| Antojo | "hoy no quiero pollo" | Sin operaciones |
| Olvidar | "olvida que no me gusta el atún" | `delete food.atun` |
| Evidencia inventada | La cita no está en los mensajes | Se rechaza |
| Clave inválida | `Food.Pan` o una categoría distinta al prefijo | Se rechaza |
| Duplicado | `create` sobre una clave existente | Se trata como `update` |

**Otros:**
- `pruneMemory`: vencidos fuera; tope de 41 → elimina el `food` menos confirmado y nunca `allergy` ni `injury`; a los 181 días → `toConfirm`.
- `replacePlanFacts`: un plan nuevo borra los hechos del plan viejo y no toca los del chat.
- `avoidedFoods` + `fitPlanOptions`: un complemento evitado no aparece.
- `formatMemoryContext`: snapshot.
- `parseGeocoding`: fixture con una respuesta real anonimizada; sin resultados → `null`.
- `roundCoords`.
- Emulador: reglas de `coach/`.

---

## Verificación

```bash
npm run lint && npx tsc --noEmit && npx tsc --noEmit -p functions && npm test && npm run build
npm run test:emulator
```

**Manual** (después del deploy, en la PWA del iPhone):

1. Subir un plan con "sin lácteos": aparece el hecho con origen "plan". Subir otro plan: el hecho viejo desaparece.
2. Desactivar la memoria: el consejo ya no la usa (revisar el log del prompt en el emulador o en los logs de Functions).
3. Ubicación:
   - "Usar mi ubicación": sale el permiso del navegador y luego la ciudad;
   - negar el permiso: pasa a manual con un aviso suave;
   - modo manual: guarda país y ciudad;
   - modo desactivado: no se manda al prompt.

---

## Pasos del usuario

1. **Activar la API de Geocoding** en el proyecto de Google Cloud de Firebase.
2. **Crear una API key restringida** solo a la API de Geocoding.
3. **Guardarla como secreto:** `npx firebase-tools functions:secrets:set GEOCODING_API_KEY`.
4. **Desplegar:** Functions → reglas → app.

## Fuera de alcance

- El chat.
- Programar `consolidarMemoria` (Fase 3).
- Refrescar la ubicación al abrir el chat (Fase 3).
- Aprender gustos sin chat.

---

## Al terminar

- [ ] `README.md` de la raíz: endpoint `resolverUbicacion` y secreto `GEOCODING_API_KEY`.
- [ ] `docs/plan/README.md`: estado, PRs y bitácora.
- [ ] Notas para la Fase 3:
  - `consolidateSession` está lista para programarse;
  - `refreshAutoLocation({ allowPrompt: true })` se llama al abrir el chat.

---

## Prompt de arranque

```
Vamos a implementar la Fase 2 del plan de Pive Coach (memoria + ubicación).

1. Lee CLAUDE.md, docs/plan/README.md (incluida la bitácora de las fases 0 y 1) y docs/plan/fase-2-memoria-ubicacion.md completo, y las secciones §4 y §5 de docs/plan/diseno.md.
2. Confirma en la tabla de estado que las Fases 0 y 1 estén hechas. Si no, avísame antes de empezar.
3. Revisa el "Punto de partida" contra el código actual. Si algo no coincide, dímelo y propón el ajuste antes de cambiar nada.
4. Marca la fase como "En curso". Haz primero el PR A (memoria, empezando por el módulo puro y todos los casos de la tabla de tests) y luego el PR B (ubicación).
5. Corre las verificaciones de la fase.
6. Al terminar: actualiza el estado y la bitácora en docs/plan/README.md, deja notas para la Fase 3, recuérdame los pasos que tengo que hacer yo (API key de Geocoding) y abre el PR.
```
