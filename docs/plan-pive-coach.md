# Plan: Pive Coach (nutrición + entrenamiento híbrido)

> Estado: propuesta · 13 de noviembre de 2026

## 0. Resumen

Vamos a construir tres cosas que se apoyan entre sí:

1. **Un chat con Pive** para preguntas del día a día ("Hoy estoy fuera, comí X, ¿qué hago ahora?").
2. **Un generador de rutinas híbridas** (fuerza + carrera), además del extractor de rutinas que ya existe.
3. **Una memoria por usuario**: hechos cortos y duraderos ("alérgico al maní", "entrena a las 6am") que se mantienen al día y no acumulan basura.

**El principio:** el modelo no guarda el contexto entre llamadas. En cada llamada lo armamos barato con tres capas:

- un **núcleo fijo** igual para todos (se cachea y cuesta ~10%);
- una **memoria corta** del usuario;
- los **datos que el modelo pide** con herramientas, solo cuando los necesita.

Antes de todo eso hay que ordenar los prompts actuales (fase 0). Hoy cada función tiene sus propias reglas, copiadas y distintas, y no se conectan entre sí.

| Fase | Qué | Depende de |
|---|---|---|
| 0 | Base común de prompts + medición de tokens | — |
| 1 | Memoria por usuario (modelo, reglas, pantalla) | 0 |
| 2 | Chat "Pive" con herramientas + consolidación de memoria | 0, 1 |
| 3 | Rutinas híbridas (modelo v2, extractor, generador) | 0 |

---

## 1. Diagnóstico de los prompts actuales

Todas las funciones viven en `functions/src/index.ts`.

### Por función

| Función | Lo que está bien | Problemas | Mejora |
|---|---|---|---|
| `obtenerConsejoPive` | Personalidad clara. Los macros restantes se calculan en código (bien: el modelo suma mal). Usa la hora del día. | Manda `bodyMetrics` y la regla 5 le prohíbe usarlas: tokens pagados para que los ignore. No conoce tu plan nutricional, ni tu entreno del día, ni tus gustos. La personalidad solo existe aquí. | Quitar `bodyMetrics`. Añadir las opciones del plan para el siguiente tiempo de comida, el entreno de hoy y la memoria. La personalidad pasa al núcleo compartido. |
| `analizarImagenComida` | La descripción manda sobre la foto. Salida estructurada. | Solo da macros totales. Si editas un ingrediente, `FoodDialog` pone `macros = null` y al guardar hace **otra llamada** (`calcularMacrosIngredientes`), que puede dar números distintos. Unidades libres ("taza", "pieza", "g"). No dice qué supuso (aceite, tamaño de porción). | Macros **por ingrediente** (así, si cambias la cantidad, se recalcula en código sin llamar a la IA). Unidades con `enum`. Campo `supuestos`. Reglas para comida de restaurante o de la calle, que sirven para el chat. |
| `calcularMacrosIngredientes` | Simple. | Prompt mínimo, sin reglas comunes (crudo vs. cocido, unidades), así que no es consistente con la función anterior. | Usar las mismas reglas nutricionales y devolver el desglose. Con el punto anterior se llama mucho menos. |
| `analizarPlanNutricional` | Extrae intercambios y opciones de menú. | Los macros por opción son opcionales, así que al registrar una opción hay otra llamada (`app/(tabs)/plan.tsx:167`). `type` es texto libre ("Merienda", "Snack", "Media mañana") y no se puede cruzar con la hora del día. No extrae las restricciones del plan ("sin lácteos", "evitar azúcar"). | Añadir `slot` normalizado. Macros **obligatorios** por opción. Nuevo campo `restricciones`, que alimenta la memoria (fuente: plan). |
| `analizarComposicionCorporal` | Reglas de unidades muy claras (kg, % → kg). | Ningún campo requerido. No extrae la fecha del reporte. | Añadir `measuredAt`. Probar si el modelo ligero alcanza (es más barato). |
| `analizarPlanEntrenamiento` | Estructura clara por días. | Solo soporta fuerza (series/reps). El modelo **escribe la URL de YouTube**: gasta tokens de salida y puede salir mal formada. Los nombres de ejercicio son libres y no se conectan con tus récords (`usePersonalRecords` los agrupa por nombre en minúsculas). Los grupos musculares van como texto en la descripción, no como `enum`. | Esquema v2 por bloques (fuerza / carrera). La URL se arma en código. Nombres canónicos de ejercicios. `enum` para los grupos musculares. |

### Problemas transversales

1. **Copiar y pegar que diverge.** La regla de idioma está 3 veces, el esquema de macros 4 y el de ingrediente 2. Cuando cambies una copia, las otras quedan viejas.
2. **Lo fijo y lo variable están mezclados.** En 5 de las 6 funciones las instrucciones van en `contents`, junto a los datos, en vez de en `systemInstruction`. Separarlos ordena el prompt y permite cachear lo fijo.
3. **Sin `enum` en los esquemas.** Tiempos de comida, grupos musculares y unidades son texto libre, así que no se pueden cruzar entre pantallas.
4. **El modelo hace cosas determinísticas** que debería hacer el código (URL de YouTube, totales a partir de ingredientes).
5. **Ninguna función conoce al usuario** más allá del input que recibe.
6. **No medimos nada.** No sabemos cuántos tokens usa cada función ni si el caché está funcionando.

---

## 2. Arquitectura de prompts objetivo

### Bloques compartidos

```
functions/src/ai/
├── nucleo.ts        # Personalidad de Pive + reglas de seguridad + estilo + idioma
├── nutricion.ts     # Unidades, crudo vs. cocido, aceite por defecto, porciones fuera de casa, redondeo
├── entrenamiento.ts # Nombres canónicos, grupos musculares, principios de entrenamiento híbrido
├── esquemas.ts      # Macros, Ingrediente, enums (MealSlot, MuscleGroup, Unidad), WorkoutPlan v2
├── contexto.ts      # Convierte memoria + resumen del día + plan en texto compacto
├── gemini.ts        # Cliente, reintentos (lo que hoy está en index.ts) + registro de usageMetadata
└── tareas/          # Instrucciones específicas de cada función
```

**El núcleo** incluye:

- **Personalidad:** la de hoy. Fresca, directa, de tú, español latinoamericano.
- **Seguridad:**
  - no es consejo médico; si hay dolor, síntomas o una condición médica, recomienda a un profesional;
  - **compensar no es castigar**: nunca sugiere saltarse comidas, ayunos de compensación ni ejercicio como castigo;
  - las alergias de la memoria se respetan siempre.
- **Métricas corporales:** una sola política para todo. Se pueden usar para cálculos (por ejemplo, proteína por kg), pero no se comentan salvo que el usuario pregunte.

### Qué bloque usa cada función

| Función | Núcleo | Nutrición | Entrenamiento | Contexto del usuario |
|---|:-:|:-:|:-:|:-:|
| Consejo del día | ✓ | ✓ | resumen | ✓ |
| Chat Pive | ✓ | ✓ | ✓ | ✓ |
| Estimar comida (foto/texto) | — | ✓ | — | — |
| Macros de ingredientes | — | ✓ | — | — |
| Plan nutricional | — | ✓ | — | — |
| Composición corporal | — | — | — | — |
| Rutina: extraer | — | — | ✓ | — |
| Rutina: generar | — | — | ✓ | ✓ |
| Consolidar memoria | — | — | — | memoria actual |

Las extracciones no llevan personalidad: son tareas de datos y la personalidad solo mete ruido.

### Orden dentro de cada llamada (para el caché)

```
┌────────────────────────────────────┐
│ Núcleo Pive                        │  idéntico en consejo y chat
│ Reglas de nutrición / entrenamiento│  → se cachea (~10% del precio)
├────────────────────────────────────┤
│ Instrucciones de la tarea          │
├────────────────────────────────────┤
│ Memoria del usuario (~800 tokens)  │  cambia por usuario
│ Resumen del día / datos            │
│ Historial (últimos 10 + resumen)   │
│ Mensaje nuevo                      │
└────────────────────────────────────┘
```

- El caché implícito de Gemini funciona **por modelo**. El consejo y el chat usan el mismo modelo ligero, así que comparten el prefijo.
- El mínimo para que entre al caché es de ~4,096 tokens (hay que verificarlo para Flash-Lite). **No se infla el prompt para llegar**: si con ejemplos útiles llega solo, mejor.

---

## 3. Memoria por usuario

**Analogía:** la memoria es una **agenda de contactos, no un diario**. En un diario cada día agregas páginas y lo viejo se queda ahí. En una agenda, si alguien cambia de número, editas el contacto: nunca tienes dos "Juan". Cada hecho tiene una **clave única** (`alimento.pan_cuadrado`). Lo nuevo sobre el mismo tema **reemplaza** lo anterior.

### 3.1 Qué se guarda y qué no

**Sí**: hechos duraderos que cambian cómo Pive te aconsejaría.
- Alergias e intolerancias, restricciones (vegetariano, sin lácteos)
- Alimentos que no comes o que te encantan
- Lesiones o limitaciones
- Horarios (entrena a las 6am, trabaja por turnos), equipo (gym completo, solo mancuernas)
- Objetivos declarados ("correr 10k en marzo"), contexto (país o ciudad, para sugerir tiendas y comidas locales)

**No**:
- Lo que comiste hoy: ya está en `dailyLogs`.
- Métricas corporales, metas de macros y plan: ya tienen su lugar en el perfil.
- Antojos o estados de un día ("hoy no quiero pollo").
- Información de otras personas.

### 3.2 Modelo de datos

Un solo documento por usuario: `users/{uid}/coach/memory`. Es una lectura por sesión y el mapa garantiza que no haya claves repetidas.

```ts
type MemoryCategory =
  | 'alergia' | 'restriccion' | 'alimento' | 'lesion'
  | 'horario' | 'equipo' | 'objetivo' | 'contexto';

interface MemoryFact {
  key: string;            // "alimento.pan_cuadrado" (también es la clave del mapa)
  category: MemoryCategory;
  text: string;           // "No le gusta el pan cuadrado" (≤ 120 caracteres)
  source: 'chat' | 'plan' | 'app';
  evidence?: string;      // cita textual corta del usuario que lo respalda
  createdAt: number;
  updatedAt: number;
  lastConfirmedAt: number;
  expiresAt?: number;     // solo hechos temporales
  previous?: { text: string; updatedAt: number }; // solo la versión anterior, para depurar
}

interface CoachMemory {
  enabled: boolean;
  facts: Record<string, MemoryFact>;
  updatedAt: number;
}
```

### 3.3 De dónde entra la información

| Fuente | Cuándo | Cómo |
|---|---|---|
| **Chat** | Al cerrar cada sesión | Consolidación (3.4) |
| **Plan nutricional** | Al subir un plan | `restricciones` del plan → hechos con `source: 'plan'`. **Al subir un plan nuevo se borran todos los hechos `plan` anteriores.** Lo que viene de un documento muere con el documento. |
| **App** | Cuando el usuario edita | Pantalla "Lo que Pive sabe de ti" (3.7) |

### 3.4 Consolidación: la memoria se ordena "mientras duermes"

**Analogía:** el cerebro no guarda cada cosa en la memoria de largo plazo en el momento. Durante el día usa la memoria de corto plazo y la consolida al dormir.

- **Corto plazo = la conversación.** Dentro de una sesión el historial ya contiene todo lo que dijiste, así que Pive lo usa al instante sin tocar la memoria.
- **Largo plazo = el documento de memoria.** Se actualiza **después** de la sesión, con una sola llamada barata que ve la conversación completa.

Por qué después y no durante: no frena el chat, ve el contexto completo ("no me gusta… bueno, en realidad sí") y cuesta una llamada por sesión en lugar de una por mensaje.

**Disparador:** una función programada (`onSchedule`, cada 30 min) busca sesiones con `consolidated == false` y sin mensajes en los últimos 30 min. Como respaldo, al abrir una sesión nueva se consolida la anterior si quedó pendiente.

**Entrada:** la memoria actual (claves + textos), los mensajes **del usuario** de la sesión y la fecha de hoy.

**Salida** (estructurada):

```ts
{
  operaciones: Array<{
    op: 'crear' | 'actualizar' | 'borrar' | 'confirmar';
    key: string;              // reutiliza claves existentes si es el mismo tema
    category?: MemoryCategory;
    text?: string;
    expiresAt?: string;       // YYYY-MM-DD, solo para temporales
    evidence: string;         // cita textual de lo que dijo el usuario
  }>
}
```

**Reglas del prompt de consolidación:**

1. Si no hay nada duradero nuevo, devuelve `operaciones: []`. Es el caso más común.
2. **Mismo tema = misma clave.** Si el hecho nuevo habla de algo que ya está en la memoria, `actualizar` o `borrar` esa clave. Nunca se crea otra.
3. **Lo más reciente gana**, también dentro de la misma sesión.
4. **Si vuelve a lo neutral, se borra.** "Ya no me molesta el pan" → `borrar`. No se guarda "no tiene problema con el pan" porque lo neutral no se recuerda. Si pasa a ser una preferencia fuerte ("me encanta"), entonces `actualizar`.
5. **Temporales con vencimiento:** viaje, lesión aguda, semana de exámenes → `expiresAt`.
6. **Las alergias nunca se infieren**: solo se guardan si el usuario las dice.
7. "Olvida que…" → `borrar`.
8. Si el usuario reafirma algo que ya está → `confirmar` (renueva `lastConfirmedAt`).

### 3.5 Validación en código: el filtro anti-basura

Nada de lo que devuelve el modelo se escribe sin pasar por estos filtros determinísticos:

1. **La evidencia tiene que existir.** `evidence` debe aparecer en los mensajes del usuario (comparando sin mayúsculas, acentos ni espacios dobles). Si no aparece, el modelo la inventó y la operación se descarta. Este es el filtro más importante contra hechos inventados.
2. **Formato:** la clave cumple `^[a-z]+\.[a-z0-9_]{2,40}$`, el prefijo coincide con la categoría y el texto tiene ≤ 120 caracteres.
3. **Normalización:** `crear` sobre una clave existente se trata como `actualizar`, y `actualizar` sobre una clave que no existe se trata como `crear`.
4. **Se aplica en una transacción** de Firestore, guardando `previous`.
5. **Tope de 40 hechos.** Si se pasa, se eliminan primero los `alimento`/`horario`/`equipo` con el `lastConfirmedAt` más viejo. `alergia` y `lesion` nunca se eliminan por tope.

### 3.6 Limpieza sin IA

Al cargar la memoria (en el chat o en el consejo):

- se filtran los hechos con `expiresAt` vencido y se borran en la misma escritura;
- los hechos `alimento`, `horario` y `equipo` sin confirmar en ~6 meses se marcan "por confirmar". Pive puede preguntarlos de forma natural ("¿Sigues entrenando a las 6am?") y, si no hay respuesta, se borran en la siguiente consolidación.

| Categoría | Ejemplo | Vence | Quién la puede borrar |
|---|---|---|---|
| `alergia` | Alérgico al maní | Nunca | Solo el usuario (dicho explícitamente o desde la app) |
| `restriccion` | Sin lácteos (del plan) | Con el plan, si viene de ahí | Consolidación, app o plan nuevo |
| `alimento` | No le gusta el pan cuadrado | Por confirmar a los ~6 meses | Consolidación o app |
| `lesion` | Molestia en la rodilla derecha | `expiresAt` (revisar a las 4–6 semanas) | Consolidación o app |
| `horario` / `equipo` | Entrena L-M-V a las 6am | Por confirmar a los ~6 meses | Consolidación o app |
| `objetivo` | Correr 10k en marzo | `expiresAt` = fecha objetivo + margen | Consolidación o app |
| `contexto` | Vive en X / viaja esta semana | Permanente o `expiresAt` | Consolidación o app |

### 3.7 Ejemplo completo: el pan cuadrado

1. **Lunes, chat:** "No me gusta el pan cuadrado, ¿con qué lo cambio?" Pive responde con lo que hay en la conversación.
2. **Lunes, 30 min después:** la consolidación hace `crear alimento.pan_cuadrado` con el texto "No le gusta el pan cuadrado" y la evidencia "no me gusta el pan cuadrado". La validación encuentra la cita y lo guarda.
3. **Martes:** la memoria se inyecta en el chat, así que Pive no te sugiere pan cuadrado.
4. **Martes, chat:** "Ya me gusta el pan cuadrado, compré uno integral que está buenísimo." Pive lo usa al instante porque está en la conversación.
5. **Martes, consolidación:** la clave ya existe y el tema es el mismo. Como el usuario lo dijo con entusiasmo, hace `actualizar` → "Le gusta el pan cuadrado integral" (`previous` guarda el texto anterior). Si solo hubiera dicho "ya no me molesta", sería `borrar`.
6. **Miércoles:** "Hoy no quiero pan." Es un antojo de un día, así que no hay ninguna operación.

### 3.8 Control del usuario

- Pantalla **"Lo que Pive sabe de ti"** en el perfil: hechos agrupados por categoría, con opción de editar y borrar, y un interruptor para desactivar la memoria.
- El usuario es el mejor recolector de basura. Además son datos de salud, así que debe poder verlos y borrarlos.
- **Reglas de Firestore:** el dueño puede leer y borrar `coach/memory`. Las escrituras de la IA van por las funciones (Admin SDK).

### 3.9 Formato al inyectarla en el prompt

```
MEMORIA DEL USUARIO (respétala; las alergias son absolutas):
- [alergia] Alérgico al maní
- [alimento] Le gusta el pan cuadrado integral
- [horario] Entrena L-M-V a las 6am
- [contexto] Vive en <ciudad>
```

Cada hecho son ~20 tokens, así que 40 hechos son ~800 tokens.

---

## 4. Chat "Pive"

Nombre a definir. La pestaña "Coach" ya es la de entrenamiento: el chat podría abrirse desde la tarjeta del consejo ("Habla con Pive").

### Flujo de una llamada (`coachChat`)

1. Verifica el token (igual que hoy). El `uid` sale **siempre del token**, nunca de lo que diga el modelo.
2. Carga la memoria (1 lectura), un resumen del perfil y la sesión (últimos 10 turnos + resumen de los anteriores).
3. Llama al modelo con las herramientas. Si pide una herramienta, se ejecuta en el servidor y se le devuelve el resultado. Máximo 3 vueltas.
4. Devuelve el texto y, si aplica, **propuestas** (por ejemplo, una comida para registrar) que la app muestra como tarjeta con botón "Registrar". **La IA nunca escribe sola en tu registro.**

### Herramientas

| Herramienta | Qué devuelve | Reutiliza |
|---|---|---|
| `obtenerResumenDia(fecha?)` | Consumido, metas, restante, comidas (nombre/hora/macros), entreno del día | Lógica de `remaining` del consejo |
| `obtenerOpcionesPlan(slot)` | Opciones del plan para ese tiempo de comida, con macros | `slot` de la fase 0 |
| `estimarComida(descripcion)` | Ingredientes, macros y supuestos (no registra nada) | El mismo núcleo que `analizarImagenComida`: **una sola fuente de verdad** |
| `proponerRegistroComida(comida)` | Una propuesta que la app confirma | — |
| `obtenerEntrenamiento(fecha?)` | Día del plan + entrenos completados | `workoutHistory` |
| `generarRutina(parametros)` (fase 3) | Abre el generador con los parámetros prellenados | Fase 3 |

### Instrucciones para "estoy fuera"

1. Estima lo que comiste (`estimarComida`) y muestra cómo queda lo que te falta del día.
2. Da 2–3 opciones concretas y con cantidades:
   - qué comprar en el camino (tiendas de conveniencia o supermercado, usando `contexto` de la memoria si hay país o ciudad);
   - qué comer al llegar a casa, prefiriendo opciones de **tu plan** (`obtenerOpcionesPlan`);
   - si ya estás cubierto, no hacer nada.
3. **Compensar ≠ castigar.** Si te pasaste, se ajusta lo que queda del día o mañana sigues normal.
4. Alergias y gustos de la memoria primero.
5. Respuestas cortas y accionables.

### Sesiones y costo

- **Una sesión por día**, o una nueva tras 6 horas sin mensajes. Mantiene el historial corto.
- Si la sesión pasa de 10 turnos, los anteriores se resumen en un campo `summary`, con una llamada ligera.
- Datos en `users/{uid}/coachSessions/{id}`: `startedAt`, `lastMessageAt`, `messages`, `summary`, `consolidated`.
- **Límites:**
  - mensajes por día por usuario (por ejemplo, 30), con un contador en Firestore;
  - `maxOutputTokens`;
  - *thinking* bajo (se cobra como salida).
- **Modelo:** empezar con `gemini-3.5-flash-lite`. Si las herramientas no se usan bien, probar `gemini-3.8-flash` solo para el chat.
- **Opcional:** respuesta en streaming con `expo/fetch`.
- **Opcional:** guardar en la sesión los "acuerdos del día" (por ejemplo, "cena: opción 2 del plan") para que el consejo del dashboard no contradiga al chat.

---

## 5. Rutinas híbridas

### Modelo de datos v2

Hoy `WorkoutExercise` (`src/types.ts:136`) solo tiene series y reps. Cada día pasa a tener **bloques**:

```ts
type WorkoutBlock =
  | { kind: 'fuerza'; exercises: WorkoutExercise[] }
  | {
      kind: 'carrera';
      tipo: 'suave' | 'tempo' | 'intervalos' | 'largo';
      duracionMin?: number;
      distanciaKm?: number;
      ritmoObjetivo?: string;   // "5:30/km"
      zona?: 1 | 2 | 3 | 4 | 5;
      intervalos?: { repeticiones: number; trabajo: string; descanso: string };
      notas?: string;
    }
  | { kind: 'movilidad'; duracionMin: number; notas?: string };

interface WorkoutDay {
  name: string;
  blocks?: WorkoutBlock[];        // nuevo
  exercises?: WorkoutExercise[];  // planes viejos: se leen como [{ kind: 'fuerza', exercises }]
}
```

- **Compatibilidad:** un adaptador convierte los planes viejos al leerlos, sin migrar datos.
- **El extractor y el generador devuelven el mismo esquema**, así que el resto de la app no distingue de dónde vino la rutina.

### Generador

- **Entrada (formulario):** objetivo (fuerza / 5k / 10k / medio maratón / mixto), días por semana, minutos por sesión, nivel y carrera actual (km por semana y ritmo cómodo).
- **Contexto automático:**
  - de la memoria: lesiones, horario y equipo;
  - de tus récords: mejores marcas por ejercicio.
- **Modelo pesado** con salida estructurada → vista previa → guardar como `workoutPlan`.
- **Reglas base** en `entrenamiento.ts` (**hay que validarlas con un entrenador**):
  - la mayoría de los km a ritmo suave, con 1–2 sesiones de calidad por semana;
  - subir el volumen de carrera de forma gradual y meter una semana de descarga cada 3–4;
  - no poner intervalos ni tempo el día después de pierna pesada;
  - respetar las lesiones de la memoria.
- **Nombres canónicos de ejercicios** ("Press de banca", no "Bench press") para que la rutina se conecte con `strengthRecords`.

### Sesión activa e historial

- `ActiveWorkout` soporta bloques de carrera: marcar como hecho y, opcionalmente, anotar distancia y tiempo.
- **Opcional:** leer carreras desde Apple Health (ya está integrado para comidas y métricas) como contexto para el chat y el generador.

---

## 6. Fases y entregables

### Fase 0: Base común de prompts

- [ ] Crear `functions/src/ai/` con el núcleo, las reglas, los esquemas y el cliente (sacarlos de `index.ts`).
- [ ] Registrar `usageMetadata` en cada llamada: tokens de entrada, cacheados, salida y *thinking*, por función.
- [ ] **Consejo:** quitar `bodyMetrics`; añadir el día de la semana, las opciones del plan del próximo `slot` y el entreno de hoy.
- [ ] **Comida e ingredientes:** macros por ingrediente, `supuestos`, unidades con `enum` y reglas de porción fuera de casa.
- [ ] **`FoodDialog`:** si solo cambia la cantidad de un ingrediente con macros, recalcular en código y no llamar a la IA.
- [ ] **Plan:** `slot` normalizado, macros obligatorios por opción, campo `restricciones`.
- [ ] **Rutina:** URL de YouTube en código, `enum` de grupos musculares, nombres canónicos.
- [ ] **Casos de prueba por función** (por ejemplo, 15 comidas con rangos de macros esperados), para correrlos cada vez que cambie un prompt.

**Listo cuando:** las 6 funciones usan los bloques compartidos, los tests pasan y se ven los tokens por función en los logs.

### Fase 1: Memoria

- [ ] Tipos `MemoryFact` / `CoachMemory`, reglas de Firestore y servicio para leer, limpiar y aplicar operaciones.
- [ ] Validación en código (evidencia, formato, tope, transacción) con tests unitarios.
- [ ] Hechos con fuente `plan` (se reemplazan al subir un plan nuevo).
- [ ] Pantalla "Lo que Pive sabe de ti".
- [ ] Inyectar la memoria en el consejo del día.
- [ ] **Casos de prueba de consolidación** (entrada: memoria + conversación; salida esperada: operaciones):
  - el pan cuadrado (de no gustar a gustar);
  - una alergia dicha explícitamente;
  - un viaje temporal;
  - "hoy no quiero pollo" (no debe producir ninguna operación);
  - "olvida que…";
  - una evidencia inventada (debe descartarse).

**Listo cuando:** los casos de consolidación pasan y el consejo respeta la memoria.

### Fase 2: Chat

- [ ] Función `coachChat` con el ciclo de herramientas y el límite de vueltas.
- [ ] Sesiones, historial recortado y resumen.
- [ ] Consolidación programada.
- [ ] Pantalla de chat con tarjetas de propuesta ("Registrar").
- [ ] Límite de mensajes diarios.
- [ ] Botones 👍/👎 por respuesta, guardados para evaluar y, en el futuro, para un fine-tune si hace falta.

**Listo cuando:** el caso "estoy fuera, comí X" funciona de punta a punta y la memoria se actualiza después de la sesión.

### Fase 3: Rutinas híbridas

- [ ] Tipos v2 con adaptador para planes viejos.
- [ ] El extractor devuelve v2.
- [ ] Generador con formulario y vista previa.
- [ ] `ActiveWorkout` con bloques de carrera.
- [ ] Herramienta `generarRutina` en el chat.

**Listo cuando:** se puede generar, guardar y ejecutar una semana de fuerza + carrera.

---

## 7. Costos estimados

Precios de fuentes secundarias (no se pudo abrir la página oficial desde la sesión donde se escribió este plan). **Hay que confirmarlos en la página de precios de Gemini**, y la fase 0 deja medido el costo real.

- `gemini-3.5-flash-lite`: ~$0.30 por millón de tokens de entrada, ~$0.03 cacheados, ~$2.50 de salida.
- `gemini-3.8-flash`: ~$0.75 entrada / ~$3.75 salida (una sola fuente).

| Pieza | Modelo | Costo aprox. |
|---|---|---|
| Mensaje de chat (2 llamadas, con caché) | flash-lite | ~$0.003 |
| Consolidación de memoria (1 por sesión) | flash-lite | ~$0.0015 |
| Rutina generada | 3.8-flash | ~$0.02 |
| **Usuario muy activo al mes** (5 mensajes/día, 1 sesión/día, 4 rutinas) | | **~$0.60** |

**Dónde se va el dinero:** salida y *thinking*, historial y datos del usuario. El núcleo cacheado es ~9% del costo de un mensaje.

---

## 8. Decisiones abiertas

1. ¿El chat va en una pestaña nueva o se abre desde la tarjeta del consejo?
2. ¿Cuál es el límite de mensajes diarios? ¿Habrá un plan premium?
3. ¿La memoria viene activada por defecto (con aviso) o el usuario la activa?
4. ¿Leemos carreras desde Apple Health?
5. ¿Pedimos país o ciudad en el perfil para las sugerencias locales, o dejamos que salga del chat?

## 9. Riesgos

- **Herramientas en flash-lite:** puede que no las use bien. Mitigación: casos de prueba y probar 3.8-flash solo para el chat.
- **Datos de salud:** privacidad. Mitigación: pantalla de memoria con opción de borrar todo, interruptor y reglas de Firestore.
- **Consejos de entrenamiento:** las reglas híbridas deben validarse con un profesional, y la app debe aclarar que no es consejo médico.
- **Precios que cambian:** por eso medimos `usageMetadata` desde la fase 0.
