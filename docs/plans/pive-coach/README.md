# Plan Pive Coach

> Parte de [`docs/plans/`](../README.md). Carpeta: `docs/plans/pive-coach/`.

Roadmap para convertir a Pive en un coach de nutrición y entrenamiento híbrido. Tiene cuatro partes:

- un chat con herramientas;
- comidas por tiempo, con el plan nutricional como base;
- memoria y ubicación del usuario;
- rutinas de fuerza + carrera.

| Archivo | Para qué |
|---|---|
| `README.md` (este) | Cómo usar el plan, estado, decisiones, glosario, reglas comunes y bitácora |
| `diseno.md` | Qué construimos y por qué. Diagnóstico, arquitectura, ejemplos y costos |
| `fase-N-*.md` | Todo lo que necesita un chat para implementar esa fase: punto de partida, contratos, tareas, tests, verificación y prompt de arranque |

**Si un archivo de fase y `diseno.md` no coinciden, manda el archivo de fase**: es el que tiene los contratos exactos.

---

## Cómo usar el plan: un chat por fase

1. **El plan tiene que estar en `main`.** Los chats nuevos parten de `main`, así que mergea el PR que trae `docs/plans/pive-coach/` antes de abrir el primero.
2. **Abre un chat nuevo por fase** y pega el *prompt de arranque* que está al final del archivo de la fase.
3. **El chat lee** `CLAUDE.md` (lo carga solo), este README, el archivo de la fase y las secciones de `diseno.md` que la fase indica.
4. **Si el punto de partida no coincide con el código**, el chat lo dice y propone el ajuste antes de tocar nada.
5. **Al terminar**, el chat:
   - actualiza la tabla de estado y la bitácora de este README;
   - deja notas para la siguiente fase;
   - abre el PR.
6. **Mergea y despliega antes de la siguiente fase** (Functions primero, luego reglas e índices, luego la app). La fase siguiente parte de lo que está en `main`.

Si una fase es grande, puede ir en varios PRs (cada archivo sugiere cómo partirla). Cada PR deja la app funcionando.

---

## Estado

| Fase | Archivo | Estado | PRs | Depende de |
|---|---|---|---|---|
| 0 · Base común de prompts y medición | `fase-0-base-prompts.md` | En curso | — | — |
| 1 · Comidas por tiempo + plan como base | `fase-1-comidas-por-tiempo.md` | Pendiente | — | 0 |
| 2 · Memoria + ubicación | `fase-2-memoria-ubicacion.md` | Pendiente | — | 0, 1 |
| 3 · Chat + planes y límites | `fase-3-chat-limites.md` | Pendiente | — | 1, 2 |
| 4 · Rutinas híbridas | `fase-4-rutinas-hibridas.md` | Pendiente | — | 0 (2 y 3 opcionales) |
| 5 · Apple Health | `fase-5-apple-health.md` | Pendiente (requiere app nativa) | — | 4 |

Estados posibles: **Pendiente**, **En curso**, **Hecha**, **Bloqueada** (con el motivo).

La fase 4 puede hacerse en paralelo a la 1–3. Si la fase 3 aún no está, la herramienta del chat y el límite mensual de rutinas se dejan para después.

---

## Decisiones tomadas

| # | Tema | Decisión | Dónde |
|---|---|---|---|
| 1 | Acceso al chat | Desde la tarjeta del consejo del día: campo "Pregúntale a Pive…" y atajos | Fase 3 |
| 2 | Premium | No hay ahora. Todos están en `beta`, pero los límites y el plan de cada usuario ya pasan por un solo lugar | Fase 3 |
| 3 | Memoria | Activa por defecto, con aviso. El usuario la puede ver, editar, desactivar y borrar | Fase 2 |
| 4 | Apple Health | Sí leerá actividad, pero es baja prioridad: hoy se usa como PWA y HealthKit no existe en web | Fase 5 |
| 5 | Ubicación | Se pide con aviso. Modos automático, manual o desactivado, cambiables en el perfil. Solo se guardan ciudad y país. Primero iOS y web; Android porque sale casi gratis | Fase 2 |
| 6 | Tiempo de cada comida | Lo sugiere el código por hora y cantidad. Se puede cambiar al registrar y después | Fase 1 |
| 7 | Plan nutricional como base | El consejo y el chat recomiendan las opciones del plan. Si hay que compensar, agregan un complemento o reducen una porción, con cantidades calculadas en código | Fase 1 |
| 8 | Números | Los calcula el código (presupuestos, brechas, gramos, sumas). El modelo elige y redacta | Todas |

---

## Glosario: nombres en el código

`diseno.md` explica los conceptos en español; en el código se llaman así.

| Concepto | Nombre | Dónde vive | Fase |
|---|---|---|---|
| Macros | `Macros`, `sumMacros`, `scaleMacros`… | `functions/src/shared/macros.ts` | 0 |
| Tiempo de comida | `MealSlot` (`breakfast`, `morning_snack`, `lunch`, `afternoon_snack`, `dinner`, `extra`), `PlannedSlot`, `MEAL_SLOT_LABELS` | `functions/src/shared/meals/slots.ts` | 0–1 |
| Origen del tiempo | `SlotSource` (`suggested`, `mentioned`, `plan`, `user`) | ídem | 1 |
| Estructura del día | `DayStructure`, `resolveDayStructure` | `functions/src/shared/meals/dayStructure.ts` | 1 |
| Sugerir tiempo | `suggestMealSlot` | `functions/src/shared/meals/slots.ts` | 1 |
| Presupuesto por tiempo | `computeSlotStatuses` | `functions/src/shared/meals/budget.ts` | 1 |
| Ajuste del plan | `fitPlanOptions`, `buildMealFromFit` | `functions/src/shared/meals/planFit.ts` | 1 |
| Complementos | `COMPLEMENTS` | `functions/src/shared/meals/complements.ts` | 1 |
| Bloques de prompt | `PIVE_CORE`, `NUTRITION_RULES`, `TRAINING_RULES` | `functions/src/ai/prompts/` | 0 |
| Contexto para la IA | `formatDayContext`, `formatMemoryContext`, `formatLocationContext` | `functions/src/ai/context/` | 1–2 |
| Uso y costo | `recordUsage` | `functions/src/usage.ts` | 0 |
| Límites y plan de pago | `PLAN_LIMITS`, `checkAndConsume`, `Entitlements` | `functions/src/limits.ts` | 3 |
| Memoria | `MemoryFact`, `CoachMemory`, `MemoryOp`, `validateMemoryOps`, `applyMemoryOps` | `functions/src/shared/memory/` | 2 |
| Consolidación | `consolidateSession` (lógica), `consolidarMemoria` (programada) | `functions/src/memory/` | 2–3 |
| Ubicación | `UserLocation`, `requestCoarsePosition`, endpoint `resolverUbicacion` | `src/services/locationService*.ts`, `functions/src/location/` | 2 |
| Chat | endpoint `chatPive`, `CoachSession`, herramientas `getDaySummary`, `getPlanOptions`, `estimateMeal`, `proposeMealLog`, `getTraining` | `functions/src/chat/` | 3 |
| Rutinas v2 | `WorkoutBlock` (`strength`, `run`, `mobility`), `normalizeWorkoutDay`, endpoint `generarPlanEntrenamiento` | `functions/src/shared/workouts/` | 4 |

### Firestore

| Ruta | Quién escribe | Fase |
|---|---|---|
| `users/{uid}` (+ `dayStructure`, `location`, `timeZone`) | Dueño | 1–2 |
| `users/{uid}/dailyLogs/{fecha}` (+ `meals[].slot`, `adviceSlot`, `adviceProposal`) | Dueño | 1 |
| `users/{uid}/usage/{YYYY-MM-DD}` y `{YYYY-MM}` | Solo servidor (el dueño lee) | 0 |
| `users/{uid}/coach/memory` | Dueño y servidor | 2 |
| `users/{uid}/private/entitlements` | Solo servidor (el dueño lee) | 3 |
| `users/{uid}/coachSessions/{id}` | Solo servidor (el dueño lee) | 3 |

---

## Reglas para todas las fases (definición de "hecho")

- [ ] Pasan `npm run lint`, `npx tsc --noEmit`, `npx tsc --noEmit -p functions` y `npm test`.
- [ ] `npm run test:emulator` pasa si se tocaron reglas o servicios de Firestore. Si la sesión no tiene Java 21, lo verifica la CI del PR.
- [ ] `npm run build` pasa si se tocó la app (es lo que despliega Vercel).
- [ ] Toda lógica nueva que calcule algo es una **función pura con tests**.
- [ ] Cada colección nueva tiene su regla en `firestore.rules` y un test de emulador.
- [ ] Se mantiene la compatibilidad con datos viejos (planes, comidas y sesiones guardados antes de la fase).
- [ ] Ningún secreto en el código. Los secretos van con `functions:secrets:set`.
- [ ] Textos de UI en español, de tú. Accesibilidad básica: `accessibilityRole`/`accessibilityLabel` y áreas táctiles de 44 pt.
- [ ] `README.md` de la raíz actualizado si cambian endpoints, secretos o comandos.
- [ ] Este README actualizado: estado, PRs y una entrada en la bitácora.

### Qué decide el chat solo y qué pregunta

- **Decide solo:** estructura interna de archivos, nombres privados, redacción de prompts dentro de las reglas del diseño y detalles de UI que sigan el estilo actual (`src/theme.ts`).
- **Pregunta antes:**
  - cambios de producto que no están en la fase;
  - cambiar modelos de IA;
  - cambiar un contrato marcado en la fase;
  - borrar datos de usuarios;
  - cualquier cosa que cueste dinero.

---

## Pasos que solo puedes hacer tú

| Cuándo | Qué |
|---|---|
| Antes de la fase 0 | Mergear el PR que trae `docs/plans/pive-coach/` y `CLAUDE.md` |
| Al final de cada fase | Revisar y mergear los PRs. Desplegar: `npm run deploy:functions`, luego `npm run deploy:rules` (e índices si la fase los trae), luego la app (Vercel despliega solo al mergear) |
| Fase 0 | Opcional: correr las evals con tu `GEMINI_API_KEY` en local |
| Fase 1 | Revisar la tabla de complementos, idealmente con tu nutricionista. Confirmar los pesos y horarios por defecto de los tiempos de comida |
| Fase 2 | Activar la API de Geocoding en Google Cloud, crear una API key restringida a esa API y guardarla con `npx firebase-tools functions:secrets:set GEOCODING_API_KEY`. Probar los permisos en la PWA del iPhone |
| Fase 3 | Desplegar los índices de Firestore (`npx firebase-tools deploy --only firestore:indexes`). Probar el chat en el iPhone |
| Fase 4 | Validar las reglas de entrenamiento híbrido con un entrenador |
| Fase 5 | Generar una build nativa de iOS y probarla en un dispositivo |

---

## Prompt de arranque (plantilla)

Cada archivo de fase trae el suyo ya rellenado. La forma general es:

```
Vamos a implementar la Fase N del plan de Pive Coach.

1. Lee CLAUDE.md, docs/plans/pive-coach/README.md y docs/plans/pive-coach/fase-N-….md completo, y las secciones de docs/plans/pive-coach/diseno.md que indica.
2. Confirma en la tabla de estado que las fases de las que depende estén hechas. Si no, avísame antes de empezar.
3. Revisa el "Punto de partida" contra el código actual. Si algo no coincide, dímelo y propón el ajuste antes de cambiar nada.
4. Marca la fase como "En curso" e implementa las tareas en orden, con commits pequeños. Corre las verificaciones de la fase.
5. Al terminar: actualiza el estado y la bitácora en docs/plans/pive-coach/README.md, deja notas para la siguiente fase y abre el PR.
```

---

## Bitácora

Una entrada por PR o por fase terminada. Lo importante son las **desviaciones del plan** y lo que la siguiente fase necesita saber.

<!-- Plantilla:
### AAAA-MM-DD · Fase N · PR <enlace>
- Qué se hizo:
- Desviaciones del plan (y por qué):
- Notas para la siguiente fase:
-->

### 2026-11-13 · Plan
- Se armó el plan completo en `docs/plans/pive-coach/` y se agregó `CLAUDE.md`.
- Notas para la fase 0:
  - el `youtubeUrl` que genera la IA no se usa en la app (`ActiveWorkout` usa `openYouTubeSearch(exercise.name)`);
  - las Functions todavía no usan Firestore.
