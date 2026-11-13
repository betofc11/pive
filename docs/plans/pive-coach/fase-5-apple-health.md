# Fase 5: Apple Health (actividad)

**Objetivo:** importar entrenamientos de Apple Health (sobre todo carreras) al historial de Pive, con el mismo formato que las actividades registradas a mano.

> **Baja prioridad.** HealthKit no existe en web: una PWA nunca podrá leerlo. Esta fase solo tiene sentido cuando haya una **app nativa de iOS** (TestFlight o App Store), y no se puede probar en una sesión en la nube: necesita un iPhone.

| | |
|---|---|
| **Depende de** | Fase 4: `CompletedWorkout` con `source`, `summary` y `externalId` |
| **Requisito** | Build nativa de iOS instalada en un dispositivo |
| **Leer antes** | `diseno.md` §8 (último punto) |
| **PRs sugeridos** | Uno solo |

---

## Punto de partida (verifícalo contra el código)

**`src/services/healthKitService.ts`**

- **Permisos de lectura:** `Weight`, `BodyFatPercentage`, `LeanBodyMass`.
- **Permisos de escritura:** peso, grasa, masa magra, energía consumida, proteína, carbohidratos y grasas.
- **Funciones:** `isHealthKitAvailable`, `initHealthKit`, `saveMealToHealthKit`, `saveMetricsToHealthKit` y `getLatestMetricsFromHealthKit`.
- **Web:** `healthKitService.web.ts` es el reemplazo para web.

**Configuración y UI**

- `app.json`: plugin `react-native-health` con los textos `healthSharePermission` y `healthUpdatePermission`.
- Perfil: `src/components/profile/AppleHealthSection.tsx` y `HealthImportModal.tsx`.

---

## Contratos

```ts
// src/services/healthKitService.ts (y un reemplazo en .web.ts que devuelve [])
export async function importWorkoutsFromHealthKit(since: Date): Promise<CompletedWorkout[]>;
// Solo carreras (y opcionalmente caminatas). Cada una se convierte a:
// { source: 'healthkit', externalId: <UUID de HealthKit>, dayName: 'Carrera',
//   startedAt, finishedAt, date, blocks: [{ kind: 'run', runType: 'easy', done: true,
//   result: { distanceKm, durationMin } }], summary }

// Mapeo puro y testeable (functions/src/shared/workouts/healthkit.ts)
export function mapHealthKitWorkout(sample: HealthKitWorkoutLike): CompletedWorkout | null;
```

**Sin duplicados:**
- se omite cualquier entreno cuyo `externalId` ya exista en `workoutHistory`;
- si hay uno `manual` del mismo día, que empieza a ±30 min y tiene una distancia ±10% parecida, se marca como posible duplicado y la app pregunta.

---

## Tareas

1. **Permisos:**
   - agregar lectura de entrenamientos (y distancia de carrera; frecuencia cardíaca es opcional);
   - actualizar `healthSharePermission` en `app.json` para que mencione la actividad.
2. **Lectura de entrenamientos con `react-native-health`.** Verifica la API exacta en la versión instalada: entrenamientos, muestras o *anchored workouts*.
3. **Mapeo:** `mapHealthKitWorkout`, puro, con fixtures.
4. **Importación:**
   - al abrir la app en iOS nativo (desde la última importación, guardando la fecha en el perfil);
   - y con un botón "Importar actividad" en `AppleHealthSection`.
5. **Historial y contexto:** las carreras importadas aparecen en el historial y en `getTraining` del chat.

## Tests

- `mapHealthKitWorkout`: carrera con distancia y tiempo; un tipo no soportado → `null`.
- Duplicados: el mismo `externalId` se omite; uno manual parecido se marca.

## Verificación

```bash
npm run lint && npx tsc --noEmit && npx tsc --noEmit -p functions && npm test && npm run build
```

**Manual** (en un iPhone con la build nativa): conceder el permiso, importar y ver las carreras en el historial.

## Pasos del usuario

- **Generar la build nativa de iOS** (EAS o Xcode) e instalarla.
- **Probar en el dispositivo.**

---

## Al terminar

- [ ] `README.md` de la raíz: los permisos de Apple Health que se leen.
- [ ] `docs/plans/pive-coach/README.md`: estado, PR y bitácora.

---

## Prompt de arranque

```
Vamos a implementar la Fase 5 del plan de Pive Coach (importar actividad de Apple Health).

1. Lee CLAUDE.md, docs/plans/pive-coach/README.md (incluida la bitácora) y docs/plans/pive-coach/fase-5-apple-health.md completo.
2. Confirma en la tabla de estado que la Fase 4 esté hecha y que ya existe una build nativa de iOS. Si no, avísame antes de empezar.
3. Revisa el "Punto de partida" contra el código actual y la API de react-native-health instalada. Si algo no coincide, dímelo y propón el ajuste.
4. Implementa las tareas y los tests. La prueba real la haré yo en el iPhone: dime exactamente qué revisar.
5. Al terminar: actualiza el estado y la bitácora en docs/plans/pive-coach/README.md y abre el PR.
```
