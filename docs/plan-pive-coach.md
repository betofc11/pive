# Plan: Pive Coach (nutrición + entrenamiento híbrido)

> Estado: propuesta con decisiones tomadas · 13 de noviembre de 2026

## 0. Resumen

Vamos a construir tres cosas que se apoyan entre sí:

1. **Un chat con Pive** para preguntas del día a día ("Hoy estoy fuera, comí X, ¿qué hago ahora?"). Se abre desde la tarjeta del consejo del día.
2. **Un generador de rutinas híbridas** (fuerza + carrera), además del extractor de rutinas que ya existe.
3. **Un contexto del usuario** que se mantiene solo:
   - la **estructura del día**: cada comida registrada en su tiempo (desayuno, almuerzo, cena…), con un presupuesto para los tiempos que faltan y **tu plan nutricional como base** de cada recomendación;
   - una **memoria** de hechos cortos y duraderos ("alérgico al maní", "entrena a las 6am"), sin basura;
   - tu **ubicación** (ciudad y país) para sugerencias locales.

**Los principios:**

- **El modelo no guarda el contexto entre llamadas.** En cada llamada lo armamos barato con tres capas:
  - un **núcleo fijo** igual para todos (se cachea y cuesta ~10%);
  - un **contexto corto** del usuario;
  - los **datos que el modelo pide** con herramientas, solo cuando los necesita.
- **Los números los calcula el código; el modelo redacta y elige.** Presupuestos, brechas, gramos de un complemento y sumas salen de funciones con tests. Así el consejo, el chat y la pantalla siempre dicen lo mismo.

### Decisiones tomadas

| # | Tema | Decisión | Sección |
|---|---|---|---|
| 1 | Acceso al chat | Desde la tarjeta del consejo del día | 6.1 |
| 2 | Premium | No hay ahora, pero todo se diseña para soportarlo | 7 |
| 3 | Memoria | Activa por defecto, el usuario la puede desactivar | 4.8 |
| 4 | Apple Health | Sí leerá actividad, pero es baja prioridad (hoy se usa como PWA) | 8.4 |
| 5 | Ubicación | Se pide con aviso; se puede cambiar en el perfil; modo automático; iOS y web primero, Android si sale barato | 5 |
| 6 | Tiempo de cada comida | Se sugiere por hora y cantidad, y el usuario lo puede cambiar al registrar o después | 3.2–3.5 |
| 7 | Plan nutricional como base | El consejo y el chat recomiendan las opciones de tu plan y, si hay que compensar, agregan un complemento o ajustan una porción con cantidades | 3.7 |

### Fases

| Fase | Qué | Depende de |
|---|---|---|
| 0 | Base común de prompts + medición de tokens por usuario | — |
| 1 | Comidas por tiempo + el plan como base del consejo | 0 |
| 2 | Memoria + ubicación | 0 |
| 3 | Chat desde el consejo + planes y límites | 1, 2 |
| 4 | Rutinas híbridas + registro manual de carreras | 0 |
| 5 | Actividad de Apple Health (baja prioridad, requiere app nativa) | 4 |

---

## 1. Diagnóstico de los prompts actuales

Todas las funciones viven en `functions/src/index.ts`.

### Por función

| Función | Lo que está bien | Problemas | Mejora |
|---|---|---|---|
| `obtenerConsejoPive` | Personalidad clara. Los macros restantes se calculan en código (bien: el modelo suma mal). Usa la hora del día. | Manda `bodyMetrics` y la regla 5 le prohíbe usarlas: tokens pagados para que los ignore. **No ve tu plan nutricional.** Solo distingue mañana/tarde/noche (`getTimeOfDayPeriod`), así que no sabe qué comidas faltan: "te faltan 700 kcal" puede ser una cena o tres comidas. No conoce tu entreno del día ni tus gustos. La personalidad solo existe aquí. | Quitar `bodyMetrics`. Recibe el bloque **COMIDAS DE HOY** con presupuesto por tiempo y las **opciones de tu plan** para la próxima comida, ya ajustadas (sección 3). Más el entreno de hoy, la memoria y la ubicación. La personalidad pasa al núcleo compartido. |
| `analizarImagenComida` | La descripción manda sobre la foto. Salida estructurada. | Solo da macros totales. Si editas un ingrediente, `FoodDialog` pone `macros = null` y al guardar hace **otra llamada** (`calcularMacrosIngredientes`), que puede dar números distintos. Unidades libres ("taza", "pieza", "g"). No dice qué supuso (aceite, tamaño de porción). | Macros **por ingrediente** (así, si cambias la cantidad, se recalcula en código sin llamar a la IA). Unidades con `enum`. Campo `supuestos`. Reglas para comida de restaurante o de la calle. **`slotMencionado`**: solo si dices explícitamente qué comida es ("mi almuerzo"); el tiempo lo sugiere el código (3.4). |
| `calcularMacrosIngredientes` | Simple. | Prompt mínimo, sin reglas comunes (crudo vs. cocido, unidades), así que no es consistente con la función anterior. | Usar las mismas reglas nutricionales y devolver el desglose. Con el punto anterior se llama mucho menos. |
| `analizarPlanNutricional` | Extrae intercambios y opciones de menú. | Los macros por opción son opcionales, así que al registrar una opción hay otra llamada (`app/(tabs)/plan.tsx:167`). Tampoco hay macros **por ingrediente**, así que no se puede ajustar una porción ("arroz de 150 a 100 g"). `type` es texto libre ("Merienda", "Snack", "Media mañana") y no se puede cruzar con la hora del día. No extrae las restricciones del plan ("sin lácteos", "evitar azúcar"). | Añadir `slot` normalizado. Macros **obligatorios** por opción **y por ingrediente**. Nuevo campo `restricciones`, que alimenta la memoria (fuente: plan). Opcional: lista de equivalencias si el plan la trae. |
| `analizarComposicionCorporal` | Reglas de unidades muy claras (kg, % → kg). | Ningún campo requerido. No extrae la fecha del reporte. | Añadir `measuredAt`. Probar si el modelo ligero alcanza (es más barato). |
| `analizarPlanEntrenamiento` | Estructura clara por días. | Solo soporta fuerza (series/reps). El modelo **escribe la URL de YouTube**: gasta tokens de salida y puede salir mal formada. Los nombres de ejercicio son libres y no se conectan con tus récords (`usePersonalRecords` los agrupa por nombre en minúsculas). Los grupos musculares van como texto en la descripción, no como `enum`. | Esquema v2 por bloques (fuerza / carrera). La URL se arma en código. Nombres canónicos de ejercicios. `enum` para los grupos musculares. |

### Problemas transversales

1. **Copiar y pegar que diverge.** La regla de idioma está 3 veces, el esquema de macros 4 y el de ingrediente 2. Cuando cambies una copia, las otras quedan viejas.
2. **Lo fijo y lo variable están mezclados.** En 5 de las 6 funciones las instrucciones van en `contents`, junto a los datos, en vez de en `systemInstruction`. Separarlos ordena el prompt y permite cachear lo fijo.
3. **Sin `enum` en los esquemas.** Tiempos de comida, grupos musculares y unidades son texto libre, así que no se pueden cruzar entre pantallas.
4. **El modelo hace cosas determinísticas** que debería hacer el código (URL de YouTube, totales a partir de ingredientes).
5. **Ninguna función conoce al usuario** más allá del input que recibe: ni su plan, ni qué comidas le faltan, ni sus gustos.
6. **No medimos nada.** No sabemos cuántos tokens usa cada función, cuánto cuesta cada usuario ni si el caché está funcionando.

---

## 2. Arquitectura de prompts objetivo

### Bloques compartidos

```
functions/src/ai/
├── nucleo.ts        # Personalidad de Pive + reglas de seguridad + estilo + idioma + reglas del plan (3.7)
├── nutricion.ts     # Unidades, crudo vs. cocido, aceite por defecto, porciones fuera de casa, redondeo
├── entrenamiento.ts # Nombres canónicos, grupos musculares, principios de entrenamiento híbrido
├── esquemas.ts      # Macros, Ingrediente, enums (MealSlot, MuscleGroup, Unidad), WorkoutPlan v2
├── contexto.ts      # Arma el texto compacto: comidas de hoy + plan ajustado + memoria + ubicación
├── gemini.ts        # Cliente, reintentos (lo que hoy está en index.ts) + registro de uso por usuario
└── tareas/          # Instrucciones específicas de cada función

shared/comidas/      # Funciones puras usadas por la app y por las funciones (sección 3.10)
├── slots.ts         # sugerirSlot, ventanas, estructura del día
├── presupuesto.ts   # presupuestoPorSlot
└── ajuste.ts        # ajustarOpcionesPlan (brecha, complementos, reducción de porciones)
```

**El núcleo** incluye:

- **Personalidad:** la de hoy. Fresca, directa, de tú, español latinoamericano.
- **Seguridad:**
  - no es consejo médico; si hay dolor, síntomas o una condición médica, recomienda a un profesional;
  - **compensar no es castigar**: nunca sugiere saltarse comidas, ayunos de compensación ni ejercicio como castigo;
  - las alergias de la memoria se respetan siempre.
- **Plan primero:** las reglas de la sección 3.7.
- **No inventar números:** las cantidades, presupuestos y macros vienen en el contexto; el modelo los usa y no los recalcula.
- **Ubicación:** sugerir comidas, productos y tipos de tienda comunes en ese país. Si no conoce bien la zona, sugerir categorías genéricas (supermercado, tienda de conveniencia, panadería) en vez de **inventar marcas o locales**.
- **Métricas corporales:** una sola política para todo. Se pueden usar para cálculos (por ejemplo, proteína por kg), pero no se comentan salvo que el usuario pregunte.

### Qué bloque usa cada función

| Función | Núcleo | Nutrición | Entrenamiento | Contexto del usuario |
|---|:-:|:-:|:-:|:-:|
| Consejo del día | ✓ | ✓ | resumen | ✓ (comidas de hoy + plan ajustado + memoria + ubicación) |
| Chat Pive | ✓ | ✓ | ✓ | ✓ (igual, más herramientas) |
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
┌──────────────────────────────────────┐
│ Núcleo Pive                          │  idéntico en consejo y chat
│ Reglas de nutrición / entrenamiento  │  → se cachea (~10% del precio)
├──────────────────────────────────────┤
│ Instrucciones de la tarea            │
├──────────────────────────────────────┤
│ Ubicación + memoria (~800 tokens)    │  cambia por usuario
│ Comidas de hoy + plan ajustado       │
│ Historial (últimos 10 + resumen)     │
│ Mensaje nuevo                        │
└──────────────────────────────────────┘
```

- El caché implícito de Gemini funciona **por modelo**. El consejo y el chat usan el mismo modelo ligero, así que comparten el prefijo.
- El mínimo para que entre al caché es de ~4,096 tokens (hay que verificarlo para Flash-Lite). **No se infla el prompt para llegar**: si con ejemplos útiles llega solo, mejor.

---

## 3. Comidas por tiempo y el plan como base

### 3.1 El problema

**Analogía:** es como el dinero que te queda para la semana. Si solo te falta pagar una cuenta, puedes usar en ella todo lo que queda. Si te faltan tres, lo repartes. Hoy Pive solo ve "te quedan 700 kcal": no sabe si es para la cena o para almuerzo, merienda y cena. Por eso a veces recomienda un almuerzo muy pesado y después una cena normal.

**La solución tiene tres piezas, todas calculadas en código:**

1. **Cada comida registrada tiene un tiempo** (3.2–3.5).
2. **Lo que falta del día se reparte entre los tiempos pendientes** (3.6).
3. **Para la próxima comida se toman las opciones de tu plan**, se mide cuánto se alejan de su presupuesto y se calcula cómo compensar (3.7).

El modelo recibe todo esto ya calculado y solo redacta.

### 3.2 Cada comida registrada tiene un tiempo

```ts
type MealSlot = 'desayuno' | 'merienda_am' | 'almuerzo' | 'merienda_pm' | 'cena' | 'snack';

interface Meal {
  // ...lo de hoy (id, name, time, macros, imageUrl)
  slot?: MealSlot;   // las comidas viejas no lo tienen: se infiere al leer (3.10)
  slotSource?: 'sugerido' | 'mencionado' | 'plan' | 'usuario';
}
```

- **`snack`** es algo fuera de tu estructura: un café con galleta si no haces merienda, un antojo nocturno. Cuenta en el total del día pero **no reserva presupuesto**.
- **Puede haber varias comidas en el mismo tiempo** (almuerzo + postre). El tiempo cuenta como hecho si tiene al menos una.

### 3.3 La estructura del día

Qué tiempos haces, en qué horario y cuánto pesa cada uno en el día:

```ts
interface DayStructure {
  source: 'plan' | 'usuario' | 'default';
  slots: Array<{
    slot: Exclude<MealSlot, 'snack'>;
    peso: number;               // % del día; entre todos suman 100
    ventana: [string, string];  // "11:00"–"15:30"
  }>;
}
// En users/{uid}: dayStructure?: DayStructure
```

**De dónde sale, en orden de prioridad:**

1. **Tu plan nutricional.** Sus tiempos de comida (con el `slot` normalizado de la fase 0) definen cuántas comidas haces. El peso de cada tiempo sale del promedio de calorías de sus opciones. Se recalcula al subir un plan nuevo.
2. **Lo que configures en el perfil** ("Mis comidas del día"): agregar o quitar una merienda, mover horarios. Si lo editas, pasa a `source: 'usuario'` y el plan nuevo no te lo pisa sin preguntar.
3. **Por defecto:** desayuno 25% · almuerzo 35% · merienda de la tarde 10% · cena 30%.

| Tiempo | Ventana por defecto |
|---|---|
| Desayuno | 05:00–10:30 |
| Merienda AM | 10:00–11:30 |
| Almuerzo | 11:00–15:30 |
| Merienda PM | 15:00–18:30 |
| Cena | 18:30–23:00 |

- Las ventanas se pisan a propósito (10:00–11:30 puede ser merienda o almuerzo). **Ahí decide la cantidad** (3.4).
- **Opcional, más adelante:** aprender tus horarios reales del historial (la hora típica de cada tiempo en las últimas 2 semanas, más tus correcciones) y ajustar las ventanas. Es estadística simple en código, sin IA.

### 3.4 Sugerir el tiempo al registrar (en código)

**¿Por qué en código y no con IA?** Es instantáneo, gratis y predecible. Además funciona igual para fotos, entradas manuales, favoritos y opciones del plan. La IA solo aporta cuando el usuario lo dice con palabras.

**Orden de decisión** (`sugerirSlot`):

1. **Lo dijiste:** "mi almuerzo", "de cena" → `analizarImagenComida` devuelve `slotMencionado` y se usa ese. Si no lo mencionaste, es `null`: **el modelo no adivina por la foto.**
2. **Viene del plan:** al registrar una opción del plan, se usa el tiempo de esa opción.
3. **Por hora:** los tiempos pendientes cuya ventana contiene la hora actual (con ±30 min de tolerancia).
4. **Por cantidad**, comparando las calorías de la comida con el presupuesto de ese tiempo (3.6):
   - **Muy poco para ser comida principal** (< 30% del presupuesto de desayuno, almuerzo o cena) → la merienda más cercana, o `snack` si no haces merienda. Una manzana a las 12:00 no es tu almuerzo.
   - **Un tiempo ya registrado y algo chico en su misma ventana** → el mismo tiempo. El postre cuenta con el almuerzo.
   - **Fuera de horario pero grande** (≥ 60% del presupuesto de un tiempo que ya pasó sin registrarse) → ese tiempo. Un plato fuerte a las 16:30 sin almuerzo registrado es un almuerzo tardío.
5. **Si nada encaja** → `snack`.

**Ejemplos:**

| Hora | Qué registras | Ya registrado | Sugerencia |
|---|---|---|---|
| 12:20 | Foto de un almuerzo de restaurante, ~950 kcal | Desayuno | **Almuerzo** |
| 11:15 | Yogur con fruta, ~180 kcal | Desayuno | **Merienda** (si la haces) o **Snack** |
| 16:30 | Plato fuerte, ~900 kcal | Desayuno | **Almuerzo** (tarde) |
| 13:10 | Postre, ~200 kcal | Desayuno, almuerzo (12:30) | **Almuerzo** (se suma) |
| 22:30 | Galletas, ~150 kcal | Todo | **Snack** |

**Días pasados:** si registras en un día anterior, la hora actual no sirve. Se sugiere el primer tiempo sin registrar de ese día y el usuario confirma.

### 3.5 Cambiarlo al registrar o después

- **Al registrar** (`FoodDialog`, paso de edición): una fila de chips con el tiempo sugerido preseleccionado y una nota de por qué ("Sugerido por la hora", "Lo dijiste en la descripción", "De tu plan"). Tocar otro chip → `slotSource: 'usuario'`.
- **Después:** en la tarjeta de la comida del dashboard (`MealCard`), tocar el tiempo abre un selector. Se guarda con una función nueva `updateMealInDailyLog` en `dailyLogService.ts`, en transacción como las que ya existen.
  - Opcional: ajustar la hora de la comida en el mismo selector.
- **En el chat:** las tarjetas de propuesta muestran el tiempo sugerido y se puede cambiar antes de registrar.
- **Tus correcciones sirven de señal:** si siempre mueves lo de las 11:00 a "almuerzo", las ventanas se pueden ajustar (3.3, opcional).

### 3.6 Presupuesto por tiempo (en código)

Lo que queda del día se reparte entre los tiempos **pendientes**, según su peso:

```
presupuesto(tiempo) = restante del día × peso(tiempo) / suma de pesos de los pendientes
```

Se calcula igual para calorías, proteína, carbohidratos y grasas.

- **Pendiente:** sin registrar y con su ventana sin pasar (o en curso).
- **Pasó sin registrar** ("¿almorzaste?"): no recibe presupuesto y se marca `sin registrar`. Pive pregunta una vez en vez de asumir.
- **Si el restante es ≤ 0:** los tiempos pendientes se marcan "ligero" (prioridad proteína y verduras). **Nunca "sáltate la cena".**
- `snack` nunca reserva presupuesto.

**Tus ejemplos con números:**

- **Solo falta la cena** y quedan 600 kcal → la cena recibe las 600 → "Para cerrar el día con la cena…".
- **Faltan almuerzo, merienda y cena**, quedan 1,100 kcal porque desayunaste fuerte (pesos 35 / 10 / 30, que suman 75):
  - almuerzo ≈ 513;
  - merienda ≈ 147;
  - cena ≈ 440.

  Resultado: **almuerzo y cena algo más ligeros**, en lugar de un almuerzo muy pesado y luego una cena normal.

### 3.7 El plan como base: recomendar sus opciones y compensar

**La regla de oro:** primero lo que dijo tu nutricionista. Si hay que compensar, se **agrega** algo concreto o se **ajusta una porción** de su opción. Nunca se reemplaza el plan sin razón.

**Lo que hace el código** (`ajustarOpcionesPlan`) para el próximo tiempo pendiente (en el chat, para cualquier tiempo):

1. Toma las opciones de tu plan para ese tiempo, con los macros por ingrediente de la fase 0.
2. Calcula la **brecha** de cada opción: presupuesto del tiempo − macros de la opción.
3. Las ordena por ajuste: primero proteína, después calorías.
4. Para la mejor opción:
   - **Brecha chica** (±10% de las calorías y ±5 g de proteína) → **tal cual**.
   - **Falta** → busca **complementos** que cierren el macro que más falta sin pasarse en los otros:
     - candidatos, en este orden: **alimentos que ya están en tu plan** (con sus macros por gramo) y después una **tabla curada de complementos**;
     - calcula los gramos para cerrar la brecha, redondeados a porciones razonables (múltiplos de 5–10 g, con mínimo y máximo por alimento);
     - devuelve los 3 mejores.
   - **Sobra** (por ejemplo, comiste fuera de más) → **reduce la porción** del ingrediente que más aporta del macro que sobra ("arroz de 150 g a 100 g"). Nunca la deja en cero ni elimina la comida.

**La tabla curada de complementos** (`shared/comidas/complementos.ts`):

- unos 30–40 alimentos comunes, con macros por 100 g, nombres regionales (queso tierno / fresco / blanco), grupo (proteína, carbohidrato, grasa, lácteo, fruta) y porción mínima y máxima;
- valores de tablas públicas de composición de alimentos; conviene que los revise tu nutricionista;
- **opcional:** si tu plan trae lista de equivalencias o intercambios, la fase 0 la extrae y los complementos salen primero de ahí ("1 intercambio de proteína = 30 g de queso fresco"). Es el lenguaje de tu nutricionista.

**Lo que hace el modelo:**

- elige **una** opción y **un** complemento (o el ajuste de porción) de los que le pasamos;
- tiene en cuenta la memoria: no te sugiere queso si no te gusta y nunca algo de tus alergias;
- redacta usando **las cantidades que le dimos, sin recalcular**.

**Reglas que van en el núcleo:**

1. Si hay plan, recomienda primero una opción del plan para el tiempo que toca, con sus cantidades.
2. Si hay brecha, agrega UNO de los complementos dados o aplica el ajuste de porción.
3. Prefiere complementos que ya están en el plan.
4. Si quedan varios tiempos, el consejo habla del **próximo**; el chat puede hablar de varios.
5. Si sobra, reduce porciones de la opción del plan. Nunca sugiere saltarse la comida.
6. Sale del plan solo si ninguna opción encaja ni con ajuste, y lo dice claro ("hoy tu plan no alcanza para…, te sugiero…").
7. Sin plan: recomendaciones generales que respetan el presupuesto del tiempo.

**Para que pueda registrarse con un toque**, el consejo devuelve una salida estructurada, no solo texto:

```ts
{
  texto: string;                    // máximo 2 frases, como hoy
  opcionElegida?: number;           // índice de la opción del plan
  complementoElegido?: number | null;
  ajusteElegido?: number | null;
}
```

Con esos índices, el código arma la comida exacta (macros sumados en código) y la tarjeta del consejo puede mostrar **[Registrar así]**.

### 3.8 Cómo lo ve la IA

`contexto.ts` arma este bloque. Lo usan el consejo, el chat (con `obtenerResumenDia` y `obtenerOpcionesPlan`) y cualquier función que necesite contexto del día.

Valores ilustrativos; en la versión real cada línea trae también carbohidratos y grasas:

```
COMIDAS DE HOY (martes, ahora 11:50):
- Desayuno ✓ 07:30 · 380 kcal · P 22
- Almuerzo · PRÓXIMA · presupuesto ~600 kcal · P 45
- Merienda PM · pendiente · ~170 kcal · P 13
- Cena · pendiente · última del día · ~515 kcal · P 39
RESTANTE DEL DÍA: 1,290 kcal · P 97

TU PLAN PARA EL ALMUERZO (de mejor a peor ajuste):
1. Opción 2: arroz 100 g + carne molida 120 g → ~500 kcal · P 35
   Falta: P +10 · ~100 kcal
   Complementos:
   a) queso tierno 40 g → +7 P · +100 kcal (está en tu plan, en el desayuno)
   b) claras de huevo 3 → +11 P · +50 kcal
   c) atún en agua 50 g → +13 P · +60 kcal
2. Opción 1: pollo 120 g + papa 150 g + ensalada → ~430 kcal · P 38
   Falta: P +7 · ~170 kcal
   ...
```

**Consejo resultante:**

> "Para el almuerzo haz tu opción 2: 100 g de arroz y 120 g de carne molida, y agrégale 40 g de queso tierno para llegar a tu proteína sin pasarte."

### 3.9 Efecto en el consejo del día y en el chat

**Consejo del día:**

- **Cuándo se regenera:** hoy es cuando cambia mañana/tarde/noche (`getTimeOfDayPeriod`), cuando cambian los macros o cada 3 h. Pasa a regenerarse cuando **cambia la próxima comida pendiente** o cuando cambian los macros. Registras el almuerzo y el consejo pasa a hablar de la merienda o la cena. Es más útil y probablemente genera menos llamadas.
- Siempre habla del próximo tiempo. Si es el último, lo dice ("para cerrar el día").

**Chat:**

- `obtenerResumenDia` devuelve el bloque 3.8.
- `obtenerOpcionesPlan(slot)` devuelve las opciones ajustadas de cualquier tiempo, no solo el próximo.
- **En "estoy fuera":**
  1. lo que comiste recibe su tiempo con `sugerirSlot`;
  2. se recalculan los presupuestos;
  3. Pive te propone los tiempos que quedan con las opciones de tu plan ya ajustadas, casi siempre con reducciones si comiste de más.

**Pantalla (opcional, recomendado):** el dashboard muestra los tiempos del día:

```
✓ Desayuno · Almuerzo ~600 · Merienda ~170 · Cena ~515
```

Son los mismos números que ve Pive, así que la pantalla y el consejo nunca se contradicen.

### 3.10 Comidas viejas y código compartido

- **Comidas sin `slot`:** no se migran. Al leerlas se infiere su tiempo con la misma función (por hora y tamaño) y se marcan `slotSource: 'sugerido'`. El usuario puede corregirlas.
- **Un solo código:** `sugerirSlot`, `presupuestoPorSlot` y `ajustarOpcionesPlan` son **funciones puras** (sin Firebase), en `shared/comidas/`.
  - La app las usa en `FoodDialog`, el dashboard y la pantalla del plan.
  - Las funciones las usan para armar el contexto.
  - Tienen tests unitarios con los ejemplos de esta sección.
  - Hay que incluir esa carpeta en el `tsconfig` de `functions/`.

---

## 4. Memoria por usuario

**Analogía:** la memoria es una **agenda de contactos, no un diario**. En un diario cada día agregas páginas y lo viejo se queda ahí. En una agenda, si alguien cambia de número, editas el contacto: nunca tienes dos "Juan". Cada hecho tiene una **clave única** (`alimento.pan_cuadrado`). Lo nuevo sobre el mismo tema **reemplaza** lo anterior.

### 4.1 Qué se guarda y qué no

**Sí**: hechos duraderos que cambian cómo Pive te aconsejaría.
- Alergias e intolerancias, restricciones (vegetariano, sin lácteos)
- Alimentos que no comes o que te encantan (también filtran los complementos de 3.7)
- Lesiones o limitaciones
- Horarios de entrenamiento y trabajo (entrena a las 6am, trabaja por turnos), equipo (gym completo, solo mancuernas)
- Objetivos declarados ("correr 10k en marzo")
- Contexto de vida ("almuerza en la oficina de lunes a viernes", "viaja esta semana")

**No**:
- Lo que comiste hoy: ya está en `dailyLogs`.
- Métricas corporales, metas de macros y plan: ya tienen su lugar en el perfil.
- **Horarios de comida**: van en la estructura del día (sección 3).
- **Ubicación**: vive en el perfil (sección 5).
- Antojos o estados de un día ("hoy no quiero pollo").
- Información de otras personas.

### 4.2 Modelo de datos

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
  noticeSeenAt?: number;         // cuándo vio el aviso de memoria (4.8)
  facts: Record<string, MemoryFact>;
  updatedAt: number;
}
```

### 4.3 De dónde entra la información

| Fuente | Cuándo | Cómo |
|---|---|---|
| **Chat** | Al cerrar cada sesión | Consolidación (4.4) |
| **Plan nutricional** | Al subir un plan | `restricciones` del plan → hechos con `source: 'plan'`. **Al subir un plan nuevo se borran todos los hechos `plan` anteriores.** Lo que viene de un documento muere con el documento. |
| **App** | Cuando el usuario edita | Pantalla "Lo que Pive sabe de ti" (4.8) |

### 4.4 Consolidación: la memoria se ordena "mientras duermes"

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
9. No guardar nada de lo que está en la lista "No" de 4.1.

### 4.5 Validación en código: el filtro anti-basura

Nada de lo que devuelve el modelo se escribe sin pasar por estos filtros determinísticos:

1. **La evidencia tiene que existir.** `evidence` debe aparecer en los mensajes del usuario (comparando sin mayúsculas, acentos ni espacios dobles). Si no aparece, el modelo la inventó y la operación se descarta. Este es el filtro más importante contra hechos inventados.
2. **Formato:** la clave cumple `^[a-z]+\.[a-z0-9_]{2,40}$`, el prefijo coincide con la categoría y el texto tiene ≤ 120 caracteres.
3. **Normalización:** `crear` sobre una clave existente se trata como `actualizar`, y `actualizar` sobre una clave que no existe se trata como `crear`.
4. **Se aplica en una transacción** de Firestore, guardando `previous`.
5. **Tope por plan** (sección 7; 40 hechos en beta). Si se pasa, se eliminan primero los `alimento`/`horario`/`equipo` con el `lastConfirmedAt` más viejo. `alergia` y `lesion` nunca se eliminan por tope.

### 4.6 Limpieza sin IA

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

### 4.7 Ejemplo completo: el pan cuadrado

1. **Lunes, chat:** "No me gusta el pan cuadrado, ¿con qué lo cambio?" Pive responde con lo que hay en la conversación.
2. **Lunes, 30 min después:** la consolidación hace `crear alimento.pan_cuadrado` con el texto "No le gusta el pan cuadrado" y la evidencia "no me gusta el pan cuadrado". La validación encuentra la cita y lo guarda.
3. **Martes:** la memoria se inyecta en el chat, así que Pive no te sugiere pan cuadrado, ni como complemento.
4. **Martes, chat:** "Ya me gusta el pan cuadrado, compré uno integral que está buenísimo." Pive lo usa al instante porque está en la conversación.
5. **Martes, consolidación:** la clave ya existe y el tema es el mismo. Como el usuario lo dijo con entusiasmo, hace `actualizar` → "Le gusta el pan cuadrado integral" (`previous` guarda el texto anterior). Si solo hubiera dicho "ya no me molesta", sería `borrar`.
6. **Miércoles:** "Hoy no quiero pan." Es un antojo de un día, así que no hay ninguna operación.

### 4.8 Activa por defecto, con control del usuario

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

### 4.9 Formato al inyectarla en el prompt

```
UBICACIÓN: Guadalajara, México (automática, hace 2 h)
MEMORIA DEL USUARIO (respétala; las alergias son absolutas):
- [alergia] Alérgico al maní
- [alimento] Le gusta el pan cuadrado integral
- [horario] Entrena L-M-V a las 6am
```

Cada hecho son ~20 tokens, así que 40 hechos son ~800 tokens.

---

## 5. Ubicación

Su propósito principal es que Pive sugiera **comidas, productos y tipos de tienda de tu zona** ("¿qué me compro de camino?"). Solo se guardan **ciudad, región y país**, nunca coordenadas.

### 5.1 Modelo de datos

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

### 5.2 El aviso

Se muestra **una vez**, con el mismo estilo que el banner "¡Completa tu perfil!" del dashboard. Si se ignoró, aparece una vez más al abrir el chat por primera vez.

> 📍 **¿Dónde estás?**
> Pive usa tu ubicación principalmente para sugerirte comidas y tiendas de tu zona. Solo guardamos tu ciudad y país, y lo puedes cambiar cuando quieras en tu perfil.
>
> [Usar mi ubicación] · [Elegir manualmente] · [Ahora no]

- **Usar mi ubicación** → `mode: 'auto'` y se pide el permiso del sistema **en ese momento**: el toque del usuario es lo que dispara el permiso. Nunca se pide el permiso al cargar la app sin que el usuario lo haya pedido.
- **Elegir manualmente** → abre la sección de ubicación del perfil.
- **Ahora no** → se guarda `askedAt` y no se vuelve a mostrar en 30 días.

### 5.3 Sección "Ubicación" en el perfil

- Selector: **Automática** / **Manual** / **Desactivada**.
- **Manual:** país (lista en español) + ciudad (texto libre).
- **Automática:** muestra "Detectada: Guadalajara, México · hace 2 h" y un botón "Actualizar ahora".
- **Desactivada:** no se envía nada a los prompts.

### 5.4 Modo automático: cómo funciona

1. **Obtener coordenadas** con precisión baja, según la plataforma (tabla 5.5). El patrón `*.web.ts` que ya usa el repo sirve para separar web de nativo: `locationService.ts` / `locationService.web.ts`.
2. **Redondear a 2 decimales (~1 km) en el dispositivo** antes de mandarlas.
3. **Cloud Function `resolverUbicacion`** → API de Geocoding de Google (`language=es`) → `{ city, region, country, countryCode }`. No guarda ni registra las coordenadas.
4. **Guardar solo ciudad y país** en el perfil.

**¿Por qué una Cloud Function y no el dispositivo?** `expo-location` tiene `reverseGeocodeAsync`, pero **en web devuelve vacío** (lo quitaron en el SDK 49). Como hoy la app se usa como PWA, hace falta un servidor. Usamos el mismo camino en todas las plataformas para mantener un solo código.

**Cuándo se actualiza:**
- **Al abrir el chat**, si pasaron más de 6 h. Es el momento en que importa ("estoy fuera") y es una acción del usuario, así que un permiso pedido ahí no sorprende.
- **Al abrir la app**, solo si el permiso **ya está concedido**. Nunca se pide permiso en este caso.
- Las últimas coordenadas redondeadas se guardan **solo en el dispositivo**. Si no cambiaron, no se llama a la función.

**Si falla o se niega el permiso:** se queda el último valor. Si nunca hubo uno, pasa a manual con un aviso suave ("No pudimos detectar tu ubicación, elígela manualmente").

### 5.5 Permisos por plataforma

| Plataforma | Coordenadas | Permiso | Configuración | Notas |
|---|---|---|---|---|
| **Web / PWA** (prioridad) | `navigator.geolocation` con `enableHighAccuracy: false` y `maximumAge` de 1 h | Diálogo del navegador, solo tras un toque | Requiere HTTPS (Vercel ya lo da) | En iOS como PWA el comportamiento varía según la versión: puede volver a pedir el permiso, y la Permissions API puede responder `prompt` aunque ya esté concedido. Por eso en iOS no dependemos de esa API: la actualización automática se hace al abrir el chat. |
| **iOS nativo** | `expo-location` con precisión baja | "Mientras se usa la app" | Plugin `expo-location` en `app.json` con `locationWhenInUsePermission` (mismo texto del aviso) | Si el usuario desactiva "Ubicación exacta", nos sigue sirviendo. |
| **Android** (sin usuarios aún) | `expo-location`, el mismo código que iOS | Solo ubicación **aproximada** | Pedir `ACCESS_COARSE_LOCATION` y bloquear `ACCESS_FINE_LOCATION` en `app.json` | Sale casi gratis porque reutiliza el código de iOS. |

### 5.6 Costo

La API de Geocoding de Google es parte de "Essentials": unas **10,000 llamadas gratis al mes** y después ~$5 por cada 1,000. Con pocos usuarios y el caché del dispositivo, el costo es $0.

- Necesita una API key guardada como secreto de Functions (`GEOCODING_API_KEY`), **restringida solo a la API de Geocoding**.
- **Alternativa gratuita:** Nominatim (OpenStreetMap). Su política exige máximo 1 llamada por segundo e identificar la app, lo que alcanza para el volumen actual.

---

## 6. Chat "Pive"

### 6.1 Acceso desde la tarjeta del consejo

Hoy la tarjeta (`app/(tabs)/index.tsx`, "AI Coach Card") muestra el consejo, y tocar el ícono ✨ lo regenera, aunque nada indica que hace eso. La tarjeta pasa a ser **la puerta del chat**:

```
┌──────────────────────────────────────────────┐
│ ✨  "Para el almuerzo haz tu opción 2 y       │  ← tocar el texto abre el chat
│     agrégale 40 g de queso tierno."          │
│                      [Registrar así]    ↻    │  ← registra la propuesta (3.7) · actualizar consejo
│ ┌──────────────────────────────────────────┐ │
│ │ Pregúntale a Pive…                       │ │  ← parece un campo de texto; abre el chat
│ └──────────────────────────────────────────┘ │     con el teclado listo
│ [Comí fuera] [¿Qué almuerzo?] [Me falta proteína] │  ← atajos
└──────────────────────────────────────────────┘
```

- **Atajos calculados en código** (gratis, sin IA):
  - "Comí fuera" siempre aparece;
  - uno según la **próxima comida pendiente** de la estructura del día (sección 3): "¿Qué desayuno?" / "¿Qué almuerzo?" / "¿Qué ceno?";
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
- **Tarjetas de propuesta:** "Almuerzo · Opción 2 + 40 g queso tierno · 600 kcal", con el tiempo editable y dos botones:
  - [Registrar] guarda la comida directamente;
  - [Editar] abre el `FoodDialog` existente con `initialData`, para no duplicar pantallas.
- Teclado con `KeyboardAvoidingView`. En web, Enter envía y Shift+Enter hace salto de línea.
- **Accesibilidad:**
  - `accessibilityRole` y `accessibilityLabel` en atajos, campo y botones;
  - mensajes nuevos con `accessibilityLiveRegion="polite"` (en web se traduce a `aria-live`);
  - áreas táctiles de al menos 44 pt.
- **Cerca del límite diario** (sección 7), un aviso discreto: "Te quedan 3 mensajes hoy".

### 6.2 Flujo de una llamada (`coachChat`)

1. Verifica el token (igual que hoy). El `uid` sale **siempre del token**, nunca de lo que diga el modelo.
2. **Revisa el límite del plan** (sección 7). Si se pasó, responde `429` con `limit_reached`.
3. Carga en una sola pasada:
   - la memoria (si está activa) y la ubicación;
   - el bloque de comidas de hoy (3.8);
   - la sesión: últimos 10 turnos + resumen de los anteriores.
4. Llama al modelo con las herramientas. Si pide una herramienta, se ejecuta en el servidor y se le devuelve el resultado. Máximo 3 vueltas.
5. Registra el uso (tokens) y devuelve el texto y, si aplica, **propuestas**. **La IA nunca escribe sola en tu registro.**

### 6.3 Herramientas

| Herramienta | Qué devuelve | Reutiliza |
|---|---|---|
| `obtenerResumenDia(fecha?)` | El bloque COMIDAS DE HOY: tiempos hechos y pendientes, presupuesto de cada uno, restante, entreno del día | `presupuestoPorSlot` (3.6) |
| `obtenerOpcionesPlan(slot)` | Opciones del plan para ese tiempo, ordenadas por ajuste, con brecha, complementos o reducción | `ajustarOpcionesPlan` (3.7) |
| `estimarComida(descripcion)` | Ingredientes, macros, supuestos y tiempo sugerido (no registra nada) | El mismo núcleo que `analizarImagenComida` + `sugerirSlot`: **una sola fuente de verdad** |
| `proponerRegistroComida(comida)` | Una propuesta, con su tiempo, que la app confirma | `FoodDialog` para editar |
| `obtenerEntrenamiento(fecha?)` | Día del plan + entrenos y carreras completados | `workoutHistory` |
| `generarRutina(parametros)` (fase 4) | Abre el generador con los parámetros prellenados | Fase 4 |

### 6.4 Instrucciones para "estoy fuera"

1. Estima lo que comiste (`estimarComida`), con su tiempo sugerido. Muestra cómo quedan los tiempos que faltan.
2. Da 2–3 opciones concretas y con cantidades:
   - qué comprar en el camino, según la **ubicación** (con categorías genéricas si no conoce la zona);
   - qué comer al llegar a casa: **la opción de tu plan para ese tiempo, ajustada** (`obtenerOpcionesPlan`), casi siempre con una porción reducida si comiste de más;
   - si ya estás cubierto, no hacer nada.
3. **Compensar ≠ castigar.** Si te pasaste, se ajusta lo que queda del día o mañana sigues normal.
4. Alergias y gustos de la memoria primero.
5. Respuestas cortas y accionables.

### 6.5 Sesiones y costo

- **Una sesión por día**, o una nueva tras 6 horas sin mensajes. Mantiene el historial corto.
- Si la sesión pasa de 10 turnos, los anteriores se resumen en un campo `summary`, con una llamada ligera.
- Datos en `users/{uid}/coachSessions/{id}`: `startedAt`, `lastMessageAt`, `messages`, `summary`, `consolidated`.
- `maxOutputTokens` y *thinking* bajo (se cobra como salida).
- **Modelo:** empezar con `gemini-3.5-flash-lite`. Si las herramientas no se usan bien, probar `gemini-3.8-flash` solo para el chat. Esto puede ser también una diferencia de plan (sección 7).
- **Opcional:** respuesta en streaming con `expo/fetch`.
- **Opcional:** guardar en la sesión los "acuerdos del día" (por ejemplo, "cena: opción 2 del plan") para que el consejo del dashboard no contradiga al chat.

---

## 7. Planes y límites (listo para premium)

Hoy no hay premium, pero **todo pasa por un solo lugar que decide qué puede hacer cada usuario**. Cuando llegue premium solo se cambia un dato del usuario, no el código de cada función.

### 7.1 Dónde vive el plan de cada usuario

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

### 7.2 Límites en un solo archivo

`functions/src/planes.ts`. Los números son de ejemplo y se ajustan con el costo real medido:

| Límite | `beta` (hoy, todos) | `free` (futuro) | `premium` (futuro) |
|---|---|---|---|
| Mensajes de chat por día | 50 | 10 | 100 |
| Rutinas generadas por mes | 10 | 1 | 20 |
| Análisis de foto/documento por día | 40 | 15 | 80 |
| Hechos en memoria | 40 | 20 | 60 |
| Modelo del chat | ligero | ligero | ligero o pesado |

### 7.3 Medición y control de uso

- **`users/{uid}/usage/{YYYY-MM-DD}`**: contadores por función y tokens (entrada, cacheados, salida, *thinking*) con su costo estimado.
- **`users/{uid}/usage/{YYYY-MM}`**: contadores mensuales (rutinas).
- **El día se cuenta con la zona horaria del usuario** (`timeZone` del perfil).
- **Antes de llamar al modelo:** `verificarLimite(uid, funcion)`, en una transacción. Si se pasa, responde `429 { code: 'limit_reached', funcion, reiniciaEn }`.
- **Después:** `registrarUso(uid, funcion, usageMetadata)`.
- **En la app:**
  - un hook `useEntitlements()` muestra lo que queda ("Te quedan 3 mensajes hoy");
  - el control real siempre está en el servidor.
- **El registro de uso empieza en la fase 0.** Así, cuando decidas el precio de premium, sabrás cuánto cuesta de verdad cada usuario.

### 7.4 Cuando llegue el cobro (fuera de este plan)

- **PWA:** Stripe Checkout. Un webhook en una Cloud Function actualiza `entitlements`.
- **Si sale la app nativa en iOS:** Apple tiene reglas propias para suscripciones digitales. RevenueCat unifica App Store, Play y web.
- **En la app,** el error `limit_reached` ya tendrá dónde mostrar el botón "Mejorar plan".

---

## 8. Rutinas híbridas

### 8.1 Modelo de datos v2

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

### 8.2 Generador

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

### 8.3 Registro de carreras en la PWA (camino principal hoy)

- `ActiveWorkout` soporta bloques de carrera: marcar como hecho y anotar distancia, tiempo y, opcionalmente, sensación (RPE).
- **"Registrar actividad suelta"**, para una carrera que no estaba en el plan.
- `CompletedWorkout` gana `source: 'app' | 'manual' | 'healthkit'` y las métricas de carrera. Así, cuando llegue Apple Health, sus datos caen en la misma forma sin cambiar nada más.

### 8.4 Apple Health (fase 5, baja prioridad)

- **HealthKit no existe en web.** Una PWA nunca podrá leerlo, así que esto solo aplica cuando haya app nativa en iOS (TestFlight o App Store).
- **Cuando toque:**
  - ampliar los permisos de lectura de `react-native-health` a entrenamientos (carreras: distancia, duración, ritmo, frecuencia cardíaca);
  - actualizar el texto `healthSharePermission` de `app.json`;
  - importar al abrir la app como `CompletedWorkout` con `source: 'healthkit'`, sin duplicar lo registrado a mano.
- **Alternativa multiplataforma futura:** Strava, vía OAuth. Funciona también en la PWA, pero queda fuera de este plan.

---

## 9. Fases y entregables

### Fase 0: Base común de prompts

- [ ] Crear `functions/src/ai/` con el núcleo, las reglas, los esquemas y el cliente (sacarlos de `index.ts`).
- [ ] **Registrar el uso por usuario y función** (`usage/{fecha}`) con los tokens de `usageMetadata`. Todavía sin límites.
- [ ] **Consejo:** quitar `bodyMetrics`; añadir el día de la semana y el entreno de hoy.
- [ ] **Comida e ingredientes:** macros por ingrediente, `supuestos`, unidades con `enum`, reglas de porción fuera de casa y `slotMencionado`.
- [ ] **`FoodDialog`:** si solo cambia la cantidad de un ingrediente con macros, recalcular en código y no llamar a la IA.
- [ ] **Plan:** `slot` normalizado, macros obligatorios por opción **y por ingrediente**, campo `restricciones` y, opcionalmente, `equivalencias`.
- [ ] **Rutina:** URL de YouTube en código, `enum` de grupos musculares, nombres canónicos.
- [ ] **Casos de prueba por función** (por ejemplo, 15 comidas con rangos de macros esperados), para correrlos cada vez que cambie un prompt.

**Listo cuando:** las 6 funciones usan los bloques compartidos, los tests pasan y se ve el uso por usuario en Firestore.

### Fase 1: Comidas por tiempo + el plan como base

- [ ] `shared/comidas/` con `sugerirSlot`, `presupuestoPorSlot`, `ajustarOpcionesPlan` y la tabla de complementos, **con tests unitarios** que cubran:
  - todos los ejemplos de 3.4 y 3.6;
  - el almuerzo con queso tierno de 3.8;
  - una reducción de porción cuando sobra;
  - un día sin plan.
- [ ] `Meal.slot` / `slotSource` y `DayStructure` (del plan, del perfil o por defecto).
- [ ] `FoodDialog`: chips de tiempo con la sugerencia y su razón.
- [ ] `MealCard`: cambiar el tiempo después (`updateMealInDailyLog`).
- [ ] Pantalla del plan: registrar una opción usa su tiempo.
- [ ] Perfil: "Mis comidas del día".
- [ ] **Consejo:**
  - recibe el bloque 3.8;
  - devuelve salida estructurada (`opcionElegida`, `complementoElegido`, `ajusteElegido`);
  - se regenera cuando cambia la próxima comida pendiente;
  - botón [Registrar así].
- [ ] Opcional: los tiempos del día con su presupuesto en el dashboard.

**Listo cuando:**
- al subir un almuerzo a las 12:20 la app propone "Almuerzo" y se puede cambiar al registrar o después;
- con plan cargado, el consejo recomienda una opción del plan con el complemento o el ajuste, y se puede registrar con un toque.

### Fase 2: Memoria + ubicación

**Memoria**
- [ ] Tipos `MemoryFact` / `CoachMemory`, reglas de Firestore y servicio para leer, limpiar y aplicar operaciones.
- [ ] Validación en código (evidencia, formato, tope, transacción) con tests unitarios.
- [ ] Hechos con fuente `plan` (se reemplazan al subir un plan nuevo).
- [ ] Pantalla "Lo que Pive sabe de ti", con interruptor (encendido por defecto) y "Borrar todo".
- [ ] Inyectar la memoria en el consejo del día y usarla para filtrar complementos.
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

### Fase 3: Chat + planes y límites

- [ ] Rediseño de la tarjeta del consejo: campo, atajos, botón ↻, solo en el día de hoy.
- [ ] Pantalla `app/chat.tsx` (modal, `/chat?q=`), con burbuja de aviso de memoria y tarjetas de propuesta con tiempo editable.
- [ ] Función `coachChat` con el ciclo de herramientas y el límite de vueltas.
- [ ] Sesiones, historial recortado y resumen.
- [ ] Consolidación programada.
- [ ] `private/entitlements` + `planes.ts` + `verificarLimite`, con reglas de Firestore de solo lectura.
- [ ] `useEntitlements()` y mensajes de límite en la app.
- [ ] Botones 👍/👎 por respuesta, guardados para evaluar y, en el futuro, para un fine-tune si hace falta.

**Listo cuando:**
- el caso "estoy fuera, comí X" funciona de punta a punta desde un atajo de la tarjeta, con los tiempos que quedan recalculados y opciones del plan ajustadas;
- la memoria se actualiza después de la sesión;
- un usuario no puede pasarse del límite ni cambiar su plan desde el cliente.

### Fase 4: Rutinas híbridas

- [ ] Tipos v2 con adaptador para planes viejos.
- [ ] El extractor devuelve v2.
- [ ] Generador con formulario y vista previa (cuenta en el límite mensual).
- [ ] `ActiveWorkout` con bloques de carrera y "Registrar actividad suelta".
- [ ] Herramienta `generarRutina` en el chat.

**Listo cuando:** se puede generar, guardar y ejecutar una semana de fuerza + carrera desde la PWA.

### Fase 5: Apple Health (baja prioridad, requiere app nativa)

- [ ] Permisos de lectura de entrenamientos e importación como `CompletedWorkout` (`source: 'healthkit'`).

---

## 10. Costos estimados

Precios de fuentes secundarias (no se pudo abrir la página oficial desde la sesión donde se escribió este plan). **Hay que confirmarlos en la página de precios de Gemini**, y la fase 0 deja medido el costo real por usuario.

- `gemini-3.5-flash-lite`: ~$0.30 por millón de tokens de entrada, ~$0.03 cacheados, ~$2.50 de salida.
- `gemini-3.8-flash`: ~$0.75 entrada / ~$3.75 salida (una sola fuente).

| Pieza | Modelo / servicio | Costo aprox. |
|---|---|---|
| Mensaje de chat (2 llamadas, con caché) | flash-lite | ~$0.003 |
| Consejo del día (con bloque de comidas y plan, ~1,500 tokens) | flash-lite | < $0.001 |
| Tiempos, presupuestos, ajustes y complementos | código | $0 |
| Consolidación de memoria (1 por sesión) | flash-lite | ~$0.0015 |
| Rutina generada | 3.8-flash | ~$0.02 |
| Ubicación automática | Geocoding (10k gratis/mes) | $0 con pocos usuarios |
| **Usuario muy activo al mes** (5 mensajes/día, 1 sesión/día, 4 rutinas) | | **~$0.60** |

**Dónde se va el dinero:** salida y *thinking*, historial y datos del usuario. El núcleo cacheado es ~9% del costo de un mensaje.

---

## 11. Riesgos

- **Herramientas en flash-lite:** puede que no las use bien. Mitigación: casos de prueba y probar 3.8-flash solo para el chat.
- **Ventanas de horario que no coinciden con tu día:** se pueden editar en el perfil, el tiempo siempre se puede corregir y, más adelante, se aprende de tus correcciones.
- **Tabla de complementos:** los valores nutricionales deben revisarse, idealmente con tu nutricionista. Si el plan trae equivalencias, se usan esas primero.
- **Que el modelo recalcule o invente cantidades:** el núcleo le prohíbe recalcular, y la salida estructurada del consejo hace que lo que se registra salga del código, no del texto.
- **Datos de salud y ubicación:** privacidad. Mitigación:
  - memoria visible, editable y borrable, con interruptor;
  - ubicación con aviso, solo ciudad y país, desactivable;
  - reglas de Firestore.
- **Geolocalización en la PWA de iOS:** el comportamiento del permiso varía según la versión. Mitigación: actualizar al abrir el chat (acción del usuario) y conservar siempre el último valor.
- **Que el modelo invente tiendas o marcas locales:** regla explícita en el núcleo para usar categorías genéricas cuando no conozca la zona.
- **Consejos de entrenamiento:** las reglas híbridas deben validarse con un profesional, y la app debe aclarar que no es consejo médico.
- **Precios que cambian:** por eso medimos el uso por usuario desde la fase 0.
