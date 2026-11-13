# Plan: Pive Coach (nutrición + entrenamiento híbrido)

> Estado: propuesta con decisiones tomadas · 13 de noviembre de 2026

## 0. Resumen

Vamos a construir tres cosas que se apoyan entre sí:

1. **Un chat con Pive** para preguntas del día a día ("Hoy estoy fuera, comí X, ¿qué hago ahora?"). Se abre desde la tarjeta del consejo del día.
2. **Un generador de rutinas híbridas** (fuerza + carrera), además del extractor de rutinas que ya existe.
3. **Un contexto del usuario** que se mantiene solo:
   - una **memoria** de hechos cortos y duraderos ("alérgico al maní", "entrena a las 6am"), sin basura;
   - su **ubicación** (ciudad y país) para sugerencias locales.

**El principio:** el modelo no guarda el contexto entre llamadas. En cada llamada lo armamos barato con tres capas:

- un **núcleo fijo** igual para todos (se cachea y cuesta ~10%);
- un **contexto corto** del usuario (memoria + ubicación);
- los **datos que el modelo pide** con herramientas, solo cuando los necesita.

### Decisiones tomadas

| # | Tema | Decisión | Sección |
|---|---|---|---|
| 1 | Acceso al chat | Desde la tarjeta del consejo del día | 5.1 |
| 2 | Premium | No hay ahora, pero todo se diseña para soportarlo | 6 |
| 3 | Memoria | Activa por defecto, el usuario la puede desactivar | 3.8 |
| 4 | Apple Health | Sí leerá actividad, pero es baja prioridad (hoy se usa como PWA) | 7.4 |
| 5 | Ubicación | Se pide con aviso; se puede cambiar en el perfil; modo automático; iOS y web primero, Android si sale barato | 4 |

### Fases

| Fase | Qué | Depende de |
|---|---|---|
| 0 | Base común de prompts + medición de tokens por usuario | — |
| 1 | Contexto del usuario: memoria + ubicación | 0 |
| 2 | Chat desde el consejo + planes y límites | 0, 1 |
| 3 | Rutinas híbridas + registro manual de carreras | 0 |
| 4 | Actividad de Apple Health (baja prioridad, requiere app nativa) | 3 |

---

## 1. Diagnóstico de los prompts actuales

Todas las funciones viven en `functions/src/index.ts`.

### Por función

| Función | Lo que está bien | Problemas | Mejora |
|---|---|---|---|
| `obtenerConsejoPive` | Personalidad clara. Los macros restantes se calculan en código (bien: el modelo suma mal). Usa la hora del día. | Manda `bodyMetrics` y la regla 5 le prohíbe usarlas: tokens pagados para que los ignore. No conoce tu plan nutricional, ni tu entreno del día, ni tus gustos. La personalidad solo existe aquí. | Quitar `bodyMetrics`. Añadir las opciones del plan para el siguiente tiempo de comida, el entreno de hoy, la memoria y la ubicación. La personalidad pasa al núcleo compartido. |
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
6. **No medimos nada.** No sabemos cuántos tokens usa cada función, cuánto cuesta cada usuario ni si el caché está funcionando.

---

## 2. Arquitectura de prompts objetivo

### Bloques compartidos

```
functions/src/ai/
├── nucleo.ts        # Personalidad de Pive + reglas de seguridad + estilo + idioma
├── nutricion.ts     # Unidades, crudo vs. cocido, aceite por defecto, porciones fuera de casa, redondeo
├── entrenamiento.ts # Nombres canónicos, grupos musculares, principios de entrenamiento híbrido
├── esquemas.ts      # Macros, Ingrediente, enums (MealSlot, MuscleGroup, Unidad), WorkoutPlan v2
├── contexto.ts      # Convierte memoria + ubicación + resumen del día + plan en texto compacto
├── gemini.ts        # Cliente, reintentos (lo que hoy está en index.ts) + registro de uso por usuario
└── tareas/          # Instrucciones específicas de cada función
```

**El núcleo** incluye:

- **Personalidad:** la de hoy. Fresca, directa, de tú, español latinoamericano.
- **Seguridad:**
  - no es consejo médico; si hay dolor, síntomas o una condición médica, recomienda a un profesional;
  - **compensar no es castigar**: nunca sugiere saltarse comidas, ayunos de compensación ni ejercicio como castigo;
  - las alergias de la memoria se respetan siempre.
- **Ubicación:** sugerir comidas, productos y tipos de tienda comunes en ese país. Si no conoce bien la zona, sugerir categorías genéricas (supermercado, tienda de conveniencia, panadería) en vez de **inventar marcas o locales**.
- **Métricas corporales:** una sola política para todo. Se pueden usar para cálculos (por ejemplo, proteína por kg), pero no se comentan salvo que el usuario pregunte.

### Qué bloque usa cada función

| Función | Núcleo | Nutrición | Entrenamiento | Contexto del usuario |
|---|:-:|:-:|:-:|:-:|
| Consejo del día | ✓ | ✓ | resumen | ✓ |
| Chat Pive | ✓ | ✓ | ✓ | ✓ |
| Estimar comida (foto/texto) | — | ✓ | — | solo país (porciones típicas) |
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
│ Ubicación + memoria (~800 tokens)  │  cambia por usuario
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
- Objetivos declarados ("correr 10k en marzo")
- Contexto de vida ("almuerza en la oficina de lunes a viernes", "viaja esta semana")

**No**:
- Lo que comiste hoy: ya está en `dailyLogs`.
- Métricas corporales, metas de macros y plan: ya tienen su lugar en el perfil.
- **Ubicación**: vive en el perfil (sección 4), no en la memoria.
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
  enabled: boolean;              // true por defecto (si el documento no existe, se trata como true)
  noticeSeenAt?: number;         // cuándo vio el aviso de memoria (3.8)
  facts: Record<string, MemoryFact>;
  updatedAt: number;
}
```

### 3.3 De dónde entra la información

| Fuente | Cuándo | Cómo |
|---|---|---|
| **Chat** | Al cerrar cada sesión | Consolidación (3.4) |
| **Plan nutricional** | Al subir un plan | `restricciones` del plan → hechos con `source: 'plan'`. **Al subir un plan nuevo se borran todos los hechos `plan` anteriores.** Lo que viene de un documento muere con el documento. |
| **App** | Cuando el usuario edita | Pantalla "Lo que Pive sabe de ti" (3.8) |

### 3.4 Consolidación: la memoria se ordena "mientras duermes"

**Analogía:** el cerebro no guarda cada cosa en la memoria de largo plazo en el momento. Durante el día usa la memoria de corto plazo y la consolida al dormir.

- **Corto plazo = la conversación.** Dentro de una sesión el historial ya contiene todo lo que dijiste, así que Pive lo usa al instante sin tocar la memoria.
- **Largo plazo = el documento de memoria.** Se actualiza **después** de la sesión, con una sola llamada barata que ve la conversación completa.

Por qué después y no durante: no frena el chat, ve el contexto completo ("no me gusta… bueno, en realidad sí") y cuesta una llamada por sesión en lugar de una por mensaje.

**Disparador:** una función programada (`onSchedule`, cada 30 min) busca sesiones con `consolidated == false` y sin mensajes en los últimos 30 min. Como respaldo, al abrir una sesión nueva se consolida la anterior si quedó pendiente. **Si la memoria está desactivada, la sesión se marca como `consolidated: 'skipped'` sin llamar al modelo.**

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
9. No guardar nada de lo que está en la lista "No" de 3.1.

### 3.5 Validación en código: el filtro anti-basura

Nada de lo que devuelve el modelo se escribe sin pasar por estos filtros determinísticos:

1. **La evidencia tiene que existir.** `evidence` debe aparecer en los mensajes del usuario (comparando sin mayúsculas, acentos ni espacios dobles). Si no aparece, el modelo la inventó y la operación se descarta. Este es el filtro más importante contra hechos inventados.
2. **Formato:** la clave cumple `^[a-z]+\.[a-z0-9_]{2,40}$`, el prefijo coincide con la categoría y el texto tiene ≤ 120 caracteres.
3. **Normalización:** `crear` sobre una clave existente se trata como `actualizar`, y `actualizar` sobre una clave que no existe se trata como `crear`.
4. **Se aplica en una transacción** de Firestore, guardando `previous`.
5. **Tope por plan** (sección 6; 40 hechos en beta). Si se pasa, se eliminan primero los `alimento`/`horario`/`equipo` con el `lastConfirmedAt` más viejo. `alergia` y `lesion` nunca se eliminan por tope.

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
| `contexto` | Viaja esta semana | Permanente o `expiresAt` | Consolidación o app |

### 3.7 Ejemplo completo: el pan cuadrado

1. **Lunes, chat:** "No me gusta el pan cuadrado, ¿con qué lo cambio?" Pive responde con lo que hay en la conversación.
2. **Lunes, 30 min después:** la consolidación hace `crear alimento.pan_cuadrado` con el texto "No le gusta el pan cuadrado" y la evidencia "no me gusta el pan cuadrado". La validación encuentra la cita y lo guarda.
3. **Martes:** la memoria se inyecta en el chat, así que Pive no te sugiere pan cuadrado.
4. **Martes, chat:** "Ya me gusta el pan cuadrado, compré uno integral que está buenísimo." Pive lo usa al instante porque está en la conversación.
5. **Martes, consolidación:** la clave ya existe y el tema es el mismo. Como el usuario lo dijo con entusiasmo, hace `actualizar` → "Le gusta el pan cuadrado integral" (`previous` guarda el texto anterior). Si solo hubiera dicho "ya no me molesta", sería `borrar`.
6. **Miércoles:** "Hoy no quiero pan." Es un antojo de un día, así que no hay ninguna operación.

### 3.8 Activa por defecto, con control del usuario

**Aviso (una sola vez):** el primer mensaje del primer chat es una burbuja informativa, no del modelo:

> Pive recuerda cosas importantes que le cuentas (alergias, gustos, horarios) para aconsejarte mejor. Puedes verlas, editarlas o desactivar la memoria en **Perfil → Lo que Pive sabe de ti**.

Al mostrarse se guarda `noticeSeenAt`.

**Pantalla "Lo que Pive sabe de ti"** (en el perfil):

- Hechos agrupados por categoría, con opción de editar o borrar cada uno.
- **Interruptor "Memoria activa"** (encendido por defecto). Apagado significa:
  - no se inyecta en ningún prompt;
  - no se consolida (no hay llamada al modelo);
  - los hechos se conservan por si la vuelve a encender.
- **Botón "Borrar todo"**, separado del interruptor y con confirmación.
- Son datos de salud: el usuario debe poder verlos y borrarlos siempre. Además, el usuario es el mejor recolector de basura.

**Reglas de Firestore:** el dueño puede leer `coach/memory`, editar o borrar hechos y cambiar `enabled`. Las escrituras de la IA van por las funciones (Admin SDK).

### 3.9 Formato al inyectarla en el prompt

```
UBICACIÓN: Guadalajara, México (automática, hace 2 h)
MEMORIA DEL USUARIO (respétala; las alergias son absolutas):
- [alergia] Alérgico al maní
- [alimento] Le gusta el pan cuadrado integral
- [horario] Entrena L-M-V a las 6am
```

Cada hecho son ~20 tokens, así que 40 hechos son ~800 tokens.

---

## 4. Ubicación

Su propósito principal es que Pive sugiera **comidas, productos y tipos de tienda de tu zona** ("¿qué me compro de camino?"). Solo se guardan **ciudad, región y país**, nunca coordenadas.

### 4.1 Modelo de datos

En el perfil (`users/{uid}`). El usuario la puede editar, así que va en su propio documento:

```ts
interface UserLocation {
  mode: 'auto' | 'manual' | 'off';
  city?: string;          // "Guadalajara"
  region?: string;        // estado / provincia
  country?: string;       // "México"
  countryCode?: string;   // "MX" (ISO 3166-1)
  source?: 'gps' | 'manual';
  updatedAt?: number;
  askedAt?: number;       // cuándo se mostró el aviso (para no insistir)
}

// UserProfile gana:
location?: UserLocation;
timeZone?: string;        // "America/Mexico_City", del dispositivo; sirve para fechas y límites diarios
```

### 4.2 El aviso

Se muestra **una vez**, con el mismo estilo que el banner "¡Completa tu perfil!" del dashboard. Si se ignoró, aparece una vez más al abrir el chat por primera vez.

> 📍 **¿Dónde estás?**
> Pive usa tu ubicación principalmente para sugerirte comidas y tiendas de tu zona. Solo guardamos tu ciudad y país, y lo puedes cambiar cuando quieras en tu perfil.
>
> [Usar mi ubicación] · [Elegir manualmente] · [Ahora no]

- **Usar mi ubicación** → `mode: 'auto'` y se pide el permiso del sistema **en ese momento**: el toque del usuario es lo que dispara el permiso. Nunca se pide el permiso al cargar la app sin que el usuario lo haya pedido.
- **Elegir manualmente** → abre la sección de ubicación del perfil.
- **Ahora no** → se guarda `askedAt` y no se vuelve a mostrar en 30 días.

### 4.3 Sección "Ubicación" en el perfil

- Selector: **Automática** / **Manual** / **Desactivada**.
- **Manual:** país (lista en español) + ciudad (texto libre).
- **Automática:** muestra "Detectada: Guadalajara, México · hace 2 h" y un botón "Actualizar ahora".
- **Desactivada:** no se envía nada a los prompts.

### 4.4 Modo automático: cómo funciona

1. **Obtener coordenadas** con precisión baja, según la plataforma (tabla 4.5). El patrón `*.web.ts` que ya usa el repo sirve para separar web de nativo: `locationService.ts` / `locationService.web.ts`.
2. **Redondear a 2 decimales (~1 km) en el dispositivo** antes de mandarlas.
3. **Cloud Function `resolverUbicacion`** → API de Geocoding de Google (`language=es`) → `{ city, region, country, countryCode }`. No guarda ni registra las coordenadas.
4. **Guardar solo ciudad y país** en el perfil.

**¿Por qué una Cloud Function y no el dispositivo?** `expo-location` tiene `reverseGeocodeAsync`, pero **en web devuelve vacío** (lo quitaron en el SDK 49). Como hoy la app se usa como PWA, hace falta un servidor. Usamos el mismo camino en todas las plataformas para mantener un solo código.

**Cuándo se actualiza:**
- **Al abrir el chat**, si pasaron más de 6 h. Es el momento en que importa ("estoy fuera") y es una acción del usuario, así que un permiso pedido ahí no sorprende.
- **Al abrir la app**, solo si el permiso **ya está concedido**. Nunca se pide permiso en este caso.
- Las últimas coordenadas redondeadas se guardan **solo en el dispositivo**. Si no cambiaron, no se llama a la función.

**Si falla o se niega el permiso:** se queda el último valor. Si nunca hubo uno, pasa a manual con un aviso suave ("No pudimos detectar tu ubicación, elígela manualmente").

### 4.5 Permisos por plataforma

| Plataforma | Coordenadas | Permiso | Configuración | Notas |
|---|---|---|---|---|
| **Web / PWA** (prioridad) | `navigator.geolocation` con `enableHighAccuracy: false` y `maximumAge` de 1 h | Diálogo del navegador, solo tras un toque | Requiere HTTPS (Vercel ya lo da) | En iOS como PWA el comportamiento varía según la versión: puede volver a pedir el permiso, y la Permissions API puede responder `prompt` aunque ya esté concedido. Por eso en iOS no dependemos de esa API: la actualización automática se hace al abrir el chat. |
| **iOS nativo** | `expo-location` con precisión baja | "Mientras se usa la app" | Plugin `expo-location` en `app.json` con `locationWhenInUsePermission` (mismo texto del aviso) | Si el usuario desactiva "Ubicación exacta", nos sigue sirviendo. |
| **Android** (sin usuarios aún) | `expo-location`, el mismo código que iOS | Solo ubicación **aproximada** | Pedir `ACCESS_COARSE_LOCATION` y bloquear `ACCESS_FINE_LOCATION` en `app.json` | Sale casi gratis porque reutiliza el código de iOS. |

### 4.6 Costo

La API de Geocoding de Google es parte de "Essentials": unas **10,000 llamadas gratis al mes** y después ~$5 por cada 1,000. Con pocos usuarios y el caché del dispositivo, el costo es $0.

- Necesita una API key guardada como secreto de Functions (`GEOCODING_API_KEY`), **restringida solo a la API de Geocoding**.
- **Alternativa gratuita:** Nominatim (OpenStreetMap). Su política exige máximo 1 llamada por segundo e identificar la app, lo que alcanza para el volumen actual.

---

## 5. Chat "Pive"

### 5.1 Acceso desde la tarjeta del consejo

Hoy la tarjeta (`app/(tabs)/index.tsx`, "AI Coach Card") muestra el consejo, y tocar el ícono ✨ lo regenera, aunque nada indica que hace eso. La tarjeta pasa a ser **la puerta del chat**:

```
┌──────────────────────────────────────────┐
│ ✨  "Te faltan 45 g de proteína; para    │  ← tocar el texto abre el chat
│     la cena, pechuga o atún con arroz."  │
│                                      ↻   │  ← botón explícito "Actualizar consejo"
│ ┌──────────────────────────────────────┐ │
│ │ Pregúntale a Pive…                   │ │  ← parece un campo de texto; abre el chat
│ └──────────────────────────────────────┘ │     con el teclado listo
│ [Comí fuera] [¿Qué ceno?] [Me falta proteína] │  ← atajos
└──────────────────────────────────────────┘
```

- **Atajos calculados en código** (gratis, sin IA):
  - "Comí fuera" siempre aparece;
  - uno según la hora: "¿Qué desayuno?" / "¿Qué almuerzo?" / "¿Qué ceno?" (reutiliza `getTimeOfDayPeriod`);
  - "Me falta proteína" si queda más del ~30% de la meta;
  - "Entrené hoy" si hay un entreno completado hoy.
- **Tocar un atajo** abre el chat y **envía ese mensaje directamente**.
- **Si ya hay una conversación hoy**, el campo dice "Continuar conversación con Pive".
- **Solo en el día de hoy.** Si estás viendo un día pasado, la tarjeta muestra solo el consejo, sin campo ni atajos: el chat es sobre hoy.
- **El refresco del consejo pasa a un botón ↻ visible**, con etiqueta, en lugar del toque escondido en ✨.

**La pantalla del chat:**

- **Ruta `app/chat.tsx`**, registrada en el `Stack` raíz con `presentation: 'modal'`, igual que `profile`.
- **En la PWA es una página `/chat`.** El rewrite de `vercel.json` ya manda cualquier ruta a `index.html`, así que los enlaces directos funcionan. Acepta `?q=` para los atajos.
- **El primer mensaje de Pive es el consejo del día**, así la conversación continúa la tarjeta en vez de empezar de cero.
- **Tarjetas de propuesta:** "Registrar: Torta de pollo · 520 kcal" con dos botones:
  - [Registrar] guarda la comida directamente;
  - [Editar] abre el `FoodDialog` existente con `initialData`, para no duplicar pantallas.
- Teclado con `KeyboardAvoidingView`. En web, Enter envía y Shift+Enter hace salto de línea.
- **Accesibilidad:**
  - `accessibilityRole` y `accessibilityLabel` en atajos, campo y botones;
  - mensajes nuevos con `accessibilityLiveRegion="polite"` (en web se traduce a `aria-live`);
  - áreas táctiles de al menos 44 pt.
- **Cerca del límite diario** (sección 6), un aviso discreto: "Te quedan 3 mensajes hoy".

### 5.2 Flujo de una llamada (`coachChat`)

1. Verifica el token (igual que hoy). El `uid` sale **siempre del token**, nunca de lo que diga el modelo.
2. **Revisa el límite del plan** (sección 6). Si se pasó, responde `429` con `limit_reached`.
3. Carga en una sola pasada:
   - la memoria (si está activa) y la ubicación;
   - un resumen del perfil;
   - la sesión: últimos 10 turnos + resumen de los anteriores.
4. Llama al modelo con las herramientas. Si pide una herramienta, se ejecuta en el servidor y se le devuelve el resultado. Máximo 3 vueltas.
5. Registra el uso (tokens) y devuelve el texto y, si aplica, **propuestas**. **La IA nunca escribe sola en tu registro.**

### 5.3 Herramientas

| Herramienta | Qué devuelve | Reutiliza |
|---|---|---|
| `obtenerResumenDia(fecha?)` | Consumido, metas, restante, comidas (nombre/hora/macros), entreno del día | Lógica de `remaining` del consejo |
| `obtenerOpcionesPlan(slot)` | Opciones del plan para ese tiempo de comida, con macros | `slot` de la fase 0 |
| `estimarComida(descripcion)` | Ingredientes, macros y supuestos (no registra nada) | El mismo núcleo que `analizarImagenComida`: **una sola fuente de verdad** |
| `proponerRegistroComida(comida)` | Una propuesta que la app confirma | `FoodDialog` para editar |
| `obtenerEntrenamiento(fecha?)` | Día del plan + entrenos y carreras completados | `workoutHistory` |
| `generarRutina(parametros)` (fase 3) | Abre el generador con los parámetros prellenados | Fase 3 |

### 5.4 Instrucciones para "estoy fuera"

1. Estima lo que comiste (`estimarComida`) y muestra cómo queda lo que te falta del día.
2. Da 2–3 opciones concretas y con cantidades:
   - qué comprar en el camino, según la **ubicación** (con categorías genéricas si no conoce la zona);
   - qué comer al llegar a casa, prefiriendo opciones de **tu plan** (`obtenerOpcionesPlan`);
   - si ya estás cubierto, no hacer nada.
3. **Compensar ≠ castigar.** Si te pasaste, se ajusta lo que queda del día o mañana sigues normal.
4. Alergias y gustos de la memoria primero.
5. Respuestas cortas y accionables.

### 5.5 Sesiones y costo

- **Una sesión por día**, o una nueva tras 6 horas sin mensajes. Mantiene el historial corto.
- Si la sesión pasa de 10 turnos, los anteriores se resumen en un campo `summary`, con una llamada ligera.
- Datos en `users/{uid}/coachSessions/{id}`: `startedAt`, `lastMessageAt`, `messages`, `summary`, `consolidated`.
- `maxOutputTokens` y *thinking* bajo (se cobra como salida).
- **Modelo:** empezar con `gemini-3.5-flash-lite`. Si las herramientas no se usan bien, probar `gemini-3.8-flash` solo para el chat. Esto puede ser también una diferencia de plan (sección 6).
- **Opcional:** respuesta en streaming con `expo/fetch`.
- **Opcional:** guardar en la sesión los "acuerdos del día" (por ejemplo, "cena: opción 2 del plan") para que el consejo del dashboard no contradiga al chat.

---

## 6. Planes y límites (listo para premium)

Hoy no hay premium, pero **todo pasa por un solo lugar que decide qué puede hacer cada usuario**. Cuando llegue premium solo se cambia un dato del usuario, no el código de cada función.

### 6.1 Dónde vive el plan de cada usuario

`users/{uid}/private/entitlements`, **de solo lectura para el usuario**:

```ts
interface Entitlements {
  tier: 'beta' | 'free' | 'premium';   // si no existe el documento → 'beta'
  source: 'default' | 'manual' | 'stripe' | 'revenuecat';
  since: number;
  expiresAt?: number;
}
```

**Importante:** hoy la regla de `users/{uid}` deja que el dueño escriba **cualquier campo** de su documento. Si el plan viviera ahí, cualquiera podría darse premium a sí mismo. Por eso va en una subcolección donde el cliente no puede escribir:

```
match /private/{docId} { allow read: if isOwner(userId); allow write: if false; }
match /usage/{docId}   { allow read: if isOwner(userId); allow write: if false; }
```

Solo las funciones (Admin SDK) escriben ahí. Mientras no haya pagos, puedes dar premium a alguien a mano desde la consola de Firebase.

### 6.2 Límites en un solo archivo

`functions/src/planes.ts`. Los números son de ejemplo y se ajustan con el costo real medido:

| Límite | `beta` (hoy, todos) | `free` (futuro) | `premium` (futuro) |
|---|---|---|---|
| Mensajes de chat por día | 50 | 10 | 100 |
| Rutinas generadas por mes | 10 | 1 | 20 |
| Análisis de foto/documento por día | 40 | 15 | 80 |
| Hechos en memoria | 40 | 20 | 60 |
| Modelo del chat | ligero | ligero | ligero o pesado |

### 6.3 Medición y control de uso

- **`users/{uid}/usage/{YYYY-MM-DD}`**: contadores por función y tokens (entrada, cacheados, salida, *thinking*) con su costo estimado.
- **`users/{uid}/usage/{YYYY-MM}`**: contadores mensuales (rutinas).
- **El día se cuenta con la zona horaria del usuario** (`timeZone` del perfil).
- **Antes de llamar al modelo:** `verificarLimite(uid, funcion)`, en una transacción. Si se pasa, responde `429 { code: 'limit_reached', funcion, reiniciaEn }`.
- **Después:** `registrarUso(uid, funcion, usageMetadata)`.
- **En la app:**
  - un hook `useEntitlements()` muestra lo que queda ("Te quedan 3 mensajes hoy");
  - el control real siempre está en el servidor.
- **El registro de uso empieza en la fase 0.** Así, cuando decidas el precio de premium, sabrás cuánto cuesta de verdad cada usuario.

### 6.4 Cuando llegue el cobro (fuera de este plan)

- **PWA:** Stripe Checkout. Un webhook en una Cloud Function actualiza `entitlements`.
- **Si sale la app nativa en iOS:** Apple tiene reglas propias para suscripciones digitales. RevenueCat unifica App Store, Play y web.
- **En la app,** el error `limit_reached` ya tendrá dónde mostrar el botón "Mejorar plan".

---

## 7. Rutinas híbridas

### 7.1 Modelo de datos v2

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

### 7.2 Generador

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

### 7.3 Registro de carreras en la PWA (camino principal hoy)

- `ActiveWorkout` soporta bloques de carrera: marcar como hecho y anotar distancia, tiempo y, opcionalmente, sensación (RPE).
- **"Registrar actividad suelta"**, para una carrera que no estaba en el plan.
- `CompletedWorkout` gana `source: 'app' | 'manual' | 'healthkit'` y las métricas de carrera. Así, cuando llegue Apple Health, sus datos caen en la misma forma sin cambiar nada más.

### 7.4 Apple Health (fase 4, baja prioridad)

- **HealthKit no existe en web.** Una PWA nunca podrá leerlo, así que esto solo aplica cuando haya app nativa en iOS (TestFlight o App Store).
- **Cuando toque:**
  - ampliar los permisos de lectura de `react-native-health` a entrenamientos (carreras: distancia, duración, ritmo, frecuencia cardíaca);
  - actualizar el texto `healthSharePermission` de `app.json`;
  - importar al abrir la app como `CompletedWorkout` con `source: 'healthkit'`, sin duplicar lo registrado a mano.
- **Alternativa multiplataforma futura:** Strava, vía OAuth. Funciona también en la PWA, pero queda fuera de este plan.

---

## 8. Fases y entregables

### Fase 0: Base común de prompts

- [ ] Crear `functions/src/ai/` con el núcleo, las reglas, los esquemas y el cliente (sacarlos de `index.ts`).
- [ ] **Registrar el uso por usuario y función** (`usage/{fecha}`) con los tokens de `usageMetadata`. Todavía sin límites.
- [ ] **Consejo:** quitar `bodyMetrics`; añadir el día de la semana, las opciones del plan del próximo `slot` y el entreno de hoy.
- [ ] **Comida e ingredientes:** macros por ingrediente, `supuestos`, unidades con `enum` y reglas de porción fuera de casa.
- [ ] **`FoodDialog`:** si solo cambia la cantidad de un ingrediente con macros, recalcular en código y no llamar a la IA.
- [ ] **Plan:** `slot` normalizado, macros obligatorios por opción, campo `restricciones`.
- [ ] **Rutina:** URL de YouTube en código, `enum` de grupos musculares, nombres canónicos.
- [ ] **Casos de prueba por función** (por ejemplo, 15 comidas con rangos de macros esperados), para correrlos cada vez que cambie un prompt.

**Listo cuando:** las 6 funciones usan los bloques compartidos, los tests pasan y se ve el uso por usuario en Firestore.

### Fase 1: Contexto del usuario (memoria + ubicación)

**Memoria**
- [ ] Tipos `MemoryFact` / `CoachMemory`, reglas de Firestore y servicio para leer, limpiar y aplicar operaciones.
- [ ] Validación en código (evidencia, formato, tope, transacción) con tests unitarios.
- [ ] Hechos con fuente `plan` (se reemplazan al subir un plan nuevo).
- [ ] Pantalla "Lo que Pive sabe de ti", con interruptor (encendido por defecto) y "Borrar todo".
- [ ] Inyectar la memoria en el consejo del día.
- [ ] **Casos de prueba de consolidación** (entrada: memoria + conversación; salida esperada: operaciones):
  - el pan cuadrado (de no gustar a gustar);
  - una alergia dicha explícitamente;
  - un viaje temporal;
  - "hoy no quiero pollo" (no debe producir ninguna operación);
  - "olvida que…";
  - una evidencia inventada (debe descartarse);
  - memoria desactivada (debe saltarse sin llamar al modelo).

**Ubicación**
- [ ] `UserLocation` y `timeZone` en el perfil.
- [ ] `locationService.ts` / `locationService.web.ts` (coordenadas por plataforma).
- [ ] Cloud Function `resolverUbicacion` con la API key como secreto.
- [ ] Banner de aviso en el dashboard y sección "Ubicación" en el perfil.
- [ ] Plugin `expo-location` en `app.json` (texto de iOS; solo permiso aproximado en Android).
- [ ] Inyectar la ubicación en el consejo.

**Listo cuando:** los casos de consolidación pasan, el consejo respeta la memoria y la ubicación, y en la PWA de iOS se puede elegir modo automático, manual o desactivado.

### Fase 2: Chat + planes y límites

- [ ] Rediseño de la tarjeta del consejo: campo, atajos, botón ↻, solo en el día de hoy.
- [ ] Pantalla `app/chat.tsx` (modal, `/chat?q=`), con burbuja de aviso de memoria y tarjetas de propuesta.
- [ ] Función `coachChat` con el ciclo de herramientas y el límite de vueltas.
- [ ] Sesiones, historial recortado y resumen.
- [ ] Consolidación programada.
- [ ] `private/entitlements` + `planes.ts` + `verificarLimite`, con reglas de Firestore de solo lectura.
- [ ] `useEntitlements()` y mensajes de límite en la app.
- [ ] Botones 👍/👎 por respuesta, guardados para evaluar y, en el futuro, para un fine-tune si hace falta.

**Listo cuando:**
- el caso "estoy fuera, comí X" funciona de punta a punta desde un atajo de la tarjeta;
- la memoria se actualiza después de la sesión;
- un usuario no puede pasarse del límite ni cambiar su plan desde el cliente.

### Fase 3: Rutinas híbridas

- [ ] Tipos v2 con adaptador para planes viejos.
- [ ] El extractor devuelve v2.
- [ ] Generador con formulario y vista previa (cuenta en el límite mensual).
- [ ] `ActiveWorkout` con bloques de carrera y "Registrar actividad suelta".
- [ ] Herramienta `generarRutina` en el chat.

**Listo cuando:** se puede generar, guardar y ejecutar una semana de fuerza + carrera desde la PWA.

### Fase 4: Apple Health (baja prioridad, requiere app nativa)

- [ ] Permisos de lectura de entrenamientos e importación como `CompletedWorkout` (`source: 'healthkit'`).

---

## 9. Costos estimados

Precios de fuentes secundarias (no se pudo abrir la página oficial desde la sesión donde se escribió este plan). **Hay que confirmarlos en la página de precios de Gemini**, y la fase 0 deja medido el costo real por usuario.

- `gemini-3.5-flash-lite`: ~$0.30 por millón de tokens de entrada, ~$0.03 cacheados, ~$2.50 de salida.
- `gemini-3.8-flash`: ~$0.75 entrada / ~$3.75 salida (una sola fuente).

| Pieza | Modelo / servicio | Costo aprox. |
|---|---|---|
| Mensaje de chat (2 llamadas, con caché) | flash-lite | ~$0.003 |
| Consolidación de memoria (1 por sesión) | flash-lite | ~$0.0015 |
| Rutina generada | 3.8-flash | ~$0.02 |
| Ubicación automática | Geocoding (10k gratis/mes) | $0 con pocos usuarios |
| **Usuario muy activo al mes** (5 mensajes/día, 1 sesión/día, 4 rutinas) | | **~$0.60** |

**Dónde se va el dinero:** salida y *thinking*, historial y datos del usuario. El núcleo cacheado es ~9% del costo de un mensaje.

---

## 10. Riesgos

- **Herramientas en flash-lite:** puede que no las use bien. Mitigación: casos de prueba y probar 3.8-flash solo para el chat.
- **Datos de salud y ubicación:** privacidad. Mitigación:
  - memoria visible, editable y borrable, con interruptor;
  - ubicación con aviso, solo ciudad y país, desactivable;
  - reglas de Firestore.
- **Geolocalización en la PWA de iOS:** el comportamiento del permiso varía según la versión. Mitigación: actualizar al abrir el chat (acción del usuario) y conservar siempre el último valor.
- **Que el modelo invente tiendas o marcas locales:** regla explícita en el núcleo para usar categorías genéricas cuando no conozca la zona.
- **Consejos de entrenamiento:** las reglas híbridas deben validarse con un profesional, y la app debe aclarar que no es consejo médico.
- **Precios que cambian:** por eso medimos el uso por usuario desde la fase 0.
