# Diseño de Pive Coach

> Qué construimos y por qué. Los contratos exactos (tipos, firmas, rutas, respuestas) están en cada archivo de fase, y **ahí mandan**. Este documento explica el razonamiento y trae los ejemplos.

## 0. Resumen

Pive pasa de dar consejos sueltos a ser un coach que conoce tu día, tu plan y a ti:

1. **Comidas por tiempo con tu plan como base.** Cada comida registrada cae en su tiempo (desayuno, almuerzo, cena…). Lo que queda del día se reparte entre los tiempos pendientes. Para la próxima comida, Pive recomienda la opción de tu plan, con un complemento o una porción ajustada si hay que compensar.
2. **Memoria y ubicación.** Hechos duraderos sobre ti ("alérgico al maní") que se mantienen al día solos, y tu ciudad y país para sugerencias locales.
3. **Chat.** Preguntas del día a día ("Estoy fuera, comí X, ¿qué hago?"), abierto desde la tarjeta del consejo.
4. **Rutinas híbridas.** Fuerza + carrera: extraerlas de un archivo, generarlas y ejecutarlas.

**Principios:**

- **El modelo no guarda contexto entre llamadas.** Cada llamada se arma barata con tres capas:
  - un núcleo fijo igual para todos (se cachea y cuesta ~10%);
  - un contexto corto del usuario;
  - los datos que el modelo pide con herramientas, solo cuando los necesita.
- **Los números los calcula el código; el modelo elige y redacta.** Así el consejo, el chat y la pantalla siempre dicen lo mismo, y esa parte cuesta $0.

---

## 1. Diagnóstico de los prompts actuales

Todo vive en `functions/src/index.ts`.

| Función | Lo que está bien | Problemas | Mejora |
|---|---|---|---|
| `obtenerConsejoPive` | Personalidad clara. Los restantes se calculan en código. Usa la hora del día. | Manda `bodyMetrics` y la regla 5 le prohíbe usarlas. No ve el plan nutricional. Solo distingue mañana/tarde/noche (`getTimeOfDayPeriod`), así que no sabe qué comidas faltan. No conoce el entreno ni los gustos. La personalidad solo existe aquí. | Quitar `bodyMetrics`. Recibe el bloque de comidas de hoy, con presupuesto por tiempo y opciones del plan ya ajustadas (§3), más memoria y ubicación. La personalidad pasa al núcleo. |
| `analizarImagenComida` | La descripción manda sobre la foto. Salida estructurada. | Solo da macros totales: al editar un ingrediente, `FoodDialog` llama otra vez a la IA (`calcularMacrosIngredientes`) y los números pueden cambiar. Unidades libres. No dice qué supuso. | Macros por ingrediente (reescalar en código). Unidades con `enum`. `assumptions`. Reglas de porción fuera de casa. `mentionedSlot`, solo si el usuario dice qué comida es. |
| `calcularMacrosIngredientes` | Simple. | Prompt mínimo, sin reglas comunes, así que no es consistente con la anterior. | Mismas reglas nutricionales. Desglose por ingrediente. Se llama mucho menos. |
| `analizarPlanNutricional` | Extrae intercambios y opciones. | Macros por opción opcionales, así que hay una llamada extra al registrar (`plan.tsx`). Sin macros por ingrediente: no se puede ajustar una porción. `type` libre, que no se cruza con la hora. No extrae restricciones. | `slot` normalizado. Macros obligatorios por opción y por ingrediente. `restrictions`. Opcional: `equivalences`. |
| `analizarComposicionCorporal` | Reglas de unidades claras. | Sin campos requeridos. No extrae la fecha del reporte. | `measuredAt`. Probar el modelo ligero. |
| `analizarPlanEntrenamiento` | Estructura clara por días. | Solo fuerza. El modelo genera `youtubeUrl` **y la app no lo usa** (`ActiveWorkout` busca por nombre con `openYouTubeSearch`). Nombres libres que no se conectan con los récords. Grupos musculares como texto. | Bloques fuerza / carrera / movilidad. Quitar `youtubeUrl` del esquema. Nombres canónicos. `enum` de grupos musculares. |

**Problemas transversales:**

1. Copiar y pegar que diverge: la regla de idioma ×3, el esquema de macros ×4, el de ingrediente ×2.
2. Instrucciones mezcladas con los datos en `contents` en lugar de `systemInstruction`.
3. Sin `enum` en los esquemas.
4. El modelo hace cosas determinísticas (URLs, totales).
5. Ninguna función conoce al usuario.
6. No se mide nada: ni tokens, ni costo por usuario, ni caché.

---

## 2. Arquitectura de prompts

### Dónde vive cada cosa

```
functions/src/
├── shared/            # TypeScript puro, usado por la app y por las Functions (sin dependencias npm)
│   ├── macros.ts
│   ├── ingredients.ts
│   ├── meals/         # slots, estructura del día, presupuesto, ajuste del plan, complementos
│   ├── memory/        # tipos y validación de la memoria
│   └── workouts/      # bloques de rutina, nombres canónicos
├── ai/
│   ├── gemini.ts      # cliente, modelos, reintentos
│   ├── prompts/       # PIVE_CORE, NUTRITION_RULES, TRAINING_RULES
│   ├── context/       # formatDayContext, formatMemoryContext, formatLocationContext (puros)
│   ├── schemas.ts     # esquemas de respuesta de Gemini
│   └── tasks/         # instrucciones de cada endpoint
├── endpoints/         # un archivo por endpoint HTTP
├── usage.ts           # registro de tokens y costo por usuario
└── index.ts           # solo exporta los endpoints
```

**¿Por qué `shared/` dentro de `functions/`?** Firebase solo despliega la carpeta `functions/`, así que las Functions no pueden importar de `src/`. La app sí puede importar de `functions/src/shared/`, porque Metro y Jest ven todo el proyecto.

### El núcleo (`PIVE_CORE`)

- **Personalidad:** la de hoy. Fresca, directa, de tú, español latinoamericano.
- **Seguridad:**
  - no es consejo médico; ante dolor, síntomas o una condición médica, recomienda un profesional;
  - **compensar no es castigar**: nunca saltarse comidas, ayunos de compensación ni ejercicio como castigo;
  - las alergias de la memoria son absolutas.
- **Plan primero:** reglas de §3.7.
- **No inventar números:** cantidades, presupuestos y macros vienen en el contexto; no se recalculan.
- **Ubicación:** sugerir comidas, productos y tipos de tienda del país. Si no conoce la zona, usar categorías genéricas (supermercado, tienda de conveniencia) en vez de **inventar marcas o locales**.
- **Métricas corporales:** se pueden usar para cálculos (proteína por kg), pero no se comentan salvo que el usuario pregunte.

### Qué bloque usa cada función

| Función | Núcleo | Nutrición | Entrenamiento | Contexto del usuario |
|---|:-:|:-:|:-:|:-:|
| Consejo del día | ✓ | ✓ | resumen | ✓ |
| Chat | ✓ | ✓ | ✓ | ✓ (+ herramientas) |
| Estimar comida | — | ✓ | — | solo país |
| Macros de ingredientes | — | ✓ | — | — |
| Plan nutricional | — | ✓ | — | — |
| Composición corporal | — | — | — | — |
| Rutina (extraer) | — | — | ✓ | — |
| Rutina (generar) | — | — | ✓ | ✓ |
| Consolidar memoria | — | — | — | memoria actual |

Las extracciones no llevan personalidad: son tareas de datos.

### Orden dentro de cada llamada (para el caché)

```
┌──────────────────────────────────────┐
│ Núcleo + reglas de nutrición/entreno │  idéntico en consejo y chat → se cachea (~10% del precio)
├──────────────────────────────────────┤
│ Instrucciones de la tarea            │
├──────────────────────────────────────┤
│ Ubicación + memoria (~800 tokens)    │  cambia por usuario
│ Comidas de hoy + plan ajustado       │
│ Historial (últimos 10 + resumen)     │
│ Mensaje nuevo                        │
└──────────────────────────────────────┘
```

- El caché implícito de Gemini funciona **por modelo** y pide un prefijo idéntico de ~4,096 tokens (hay que verificarlo para Flash-Lite).
- **No se infla el prompt para llegar** a ese mínimo.

---

## 3. Comidas por tiempo y el plan como base

### 3.1 El problema

**Analogía:** es como el dinero que te queda para la semana. Si solo falta una cuenta, usas en ella todo lo que queda; si faltan tres, lo repartes. Hoy Pive solo ve "te quedan 700 kcal" y no sabe si es para la cena o para almuerzo, merienda y cena. Por eso a veces recomienda un almuerzo muy pesado y después una cena normal.

**La solución tiene tres piezas, todas en código:**

1. Cada comida tiene un tiempo (§3.2–3.5).
2. Lo que queda se reparte entre los tiempos pendientes (§3.6).
3. Para la próxima comida se toman las opciones del plan y se calcula cómo compensar (§3.7).

### 3.2 Tiempos de comida

- **Tiempos:** `breakfast` (Desayuno), `morning_snack` (Merienda AM), `lunch` (Almuerzo), `afternoon_snack` (Merienda PM), `dinner` (Cena) y `extra` (Snack).
- **`extra`** es algo fuera de tu estructura: cuenta en el total, pero **no reserva presupuesto**.
- **Varias comidas pueden compartir tiempo** (almuerzo + postre).
- **Cada comida guarda de dónde salió su tiempo:** `suggested`, `mentioned`, `plan` o `user`.

### 3.3 La estructura del día

Define qué tiempos haces, en qué horario y cuánto pesa cada uno. Sale de, en orden de prioridad:

1. **Lo que configuraste** en "Mis comidas del día". Solo se guarda si lo editas.
2. **Tu plan nutricional:** sus tiempos definen cuántas comidas haces, y el peso de cada uno sale del promedio de calorías de sus opciones. Se calcula al vuelo, sin guardarse.
3. **Por defecto:** desayuno 25% · almuerzo 35% · merienda PM 10% · cena 30%.

| Tiempo | Ventana por defecto |
|---|---|
| Desayuno | 05:00–10:30 |
| Merienda AM | 10:00–11:30 |
| Almuerzo | 11:00–15:30 |
| Merienda PM | 15:00–18:30 |
| Cena | 18:30–23:00 |

- Las ventanas se pisan a propósito. **Donde se pisan, decide la cantidad.**
- **Más adelante (opcional):** aprender tus horarios reales del historial y de tus correcciones.

### 3.4 Sugerir el tiempo al registrar

En código, porque es instantáneo, gratis y predecible, y funciona igual para fotos, entradas manuales, favoritos y opciones del plan. La IA solo aporta cuando lo dices con palabras.

**Orden de decisión:**

1. **Lo dijiste** ("mi almuerzo") → `mentionedSlot`. Si no lo dijiste, el modelo devuelve `null`: **no adivina por la foto.**
2. **Viene del plan** → el tiempo de esa opción.
3. **Por hora:** un tiempo pendiente cuya ventana contiene la hora (±30 min).
4. **Por cantidad**, comparando con el presupuesto de ese tiempo:
   - menos del 30% del presupuesto de una comida principal → la merienda más cercana, o `extra`;
   - algo chico en la ventana de un tiempo ya registrado → ese mismo tiempo (el postre cuenta con el almuerzo);
   - fuera de horario pero al menos el 60% del presupuesto de un tiempo que pasó sin registrarse → ese tiempo (almuerzo tardío).
5. **Si nada encaja** → `extra`.
6. **Días pasados:** la hora no sirve, así que se sugiere el primer tiempo sin registrar de ese día.

| Hora | Qué registras | Ya registrado | Sugerencia |
|---|---|---|---|
| 12:20 | Almuerzo de restaurante, ~950 kcal | Desayuno | Almuerzo |
| 11:15 | Yogur con fruta, ~180 kcal | Desayuno | Merienda (o Snack) |
| 16:30 | Plato fuerte, ~900 kcal | Desayuno | Almuerzo (tarde) |
| 13:10 | Postre, ~200 kcal | Desayuno, almuerzo 12:30 | Almuerzo |
| 22:30 | Galletas, ~150 kcal | Todo | Snack |

### 3.5 Cambiarlo al registrar o después

- **En `FoodDialog`:** chips con la sugerencia preseleccionada y su razón ("Sugerido por la hora", "Lo dijiste", "De tu plan", "Por la cantidad").
- **Después:** tocando el tiempo en la tarjeta de la comida (`MealCard`).
- **En el chat:** se cambia en la tarjeta de propuesta antes de registrar.
- **Comidas viejas sin tiempo:** se infiere al leerlas, sin migrar datos.

### 3.6 Presupuesto por tiempo

```
presupuesto(tiempo) = restante del día × peso(tiempo) / suma de pesos de los pendientes
```

Se calcula para calorías y para cada macro.

| Estado | Significa | Presupuesto |
|---|---|---|
| `logged` | Tiene al menos una comida | — |
| `next` | Es el próximo pendiente | Sí |
| `pending` | Pendiente, ventana sin pasar | Sí |
| `missed` | Su ventana pasó sin registrarse | No. Pive pregunta una vez en vez de asumir |

- **Si el restante es ≤ 0:** los pendientes se marcan "ligero" (prioridad proteína y verduras). **Nunca "sáltate la cena".**

**Ejemplos:**

- **Solo falta la cena** y quedan 600 kcal → la cena se lleva las 600.
- **Faltan almuerzo, merienda y cena**, con 1,100 kcal porque desayunaste fuerte (pesos 35/10/30):
  - almuerzo ≈ 513;
  - merienda ≈ 147;
  - cena ≈ 440.

  Resultado: almuerzo y cena algo más ligeros, en vez de uno pesado y otro normal.

### 3.7 El plan como base: recomendar sus opciones y compensar

**Regla de oro:** primero lo que dijo tu nutricionista. Para compensar se **agrega** algo concreto o se **ajusta una porción**. No se reemplaza el plan sin razón.

**Lo que hace el código** para un tiempo:

1. Toma las opciones del plan, con macros por ingrediente.
2. Calcula la **brecha** de cada una: presupuesto − macros de la opción.
3. Las ordena por ajuste: proteína primero, luego calorías.
4. Para cada opción:
   - **Brecha chica** (±10% de las kcal y ±5 g de proteína) → **tal cual**.
   - **Falta** → **complementos**: primero alimentos que ya están en tu plan, luego la tabla curada. Calcula los gramos para cerrar el macro que más falta, redondeados a porciones razonables. Devuelve los 3 mejores.
   - **Sobra** → **reducir la porción** del ingrediente que más aporta del macro que sobra. Nunca a cero, nunca eliminar la comida.

**La tabla curada de complementos:**

- unos 30–40 alimentos con macros por 100 g, nombres regionales (queso tierno / fresco / blanco), grupo y porción mínima y máxima;
- conviene que la revise tu nutricionista;
- si tu plan trae equivalencias, se usan esas primero.

**Lo que hace el modelo:** elige UNA opción y UN complemento (o una reducción) de las que le pasamos, respetando la memoria (gustos, alergias), y redacta **sin recalcular**. El consejo devuelve los índices elegidos, y el código arma la comida exacta para el botón **[Registrar así]**.

**Reglas del núcleo:**

1. Si hay plan, recomendar primero una opción del plan con sus cantidades.
2. Si hay brecha, agregar UN complemento dado o aplicar la reducción.
3. Preferir complementos que ya están en el plan.
4. El consejo habla del **próximo** tiempo; el chat puede hablar de varios.
5. Si sobra, reducir porciones. Nunca saltarse la comida.
6. Salir del plan solo si nada encaja, y decirlo.
7. Sin plan: recomendaciones generales que respetan el presupuesto del tiempo.

### 3.8 Cómo lo ve la IA

Valores ilustrativos; en la versión real cada línea lleva también carbohidratos y grasas:

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
   b) claras de huevo 3 (~100 g) → +11 P · +50 kcal
   c) atún en agua 50 g → +13 P · +60 kcal
2. Opción 1: pollo 120 g + papa 150 g + ensalada → ~430 kcal · P 38
   Falta: P +7 · ~170 kcal
   ...
```

> "Para el almuerzo haz tu opción 2: 100 g de arroz y 120 g de carne molida, y agrégale 40 g de queso tierno para llegar a tu proteína sin pasarte."

### 3.9 Efecto en el consejo y el chat

- **Cuándo se regenera el consejo:** cuando cambia la próxima comida pendiente o cambian los macros, con un respaldo cada 3 h. Hoy depende de mañana/tarde/noche.
- **El consejo** siempre habla del próximo tiempo. Si es el último del día, lo dice.
- **El chat** usa las mismas funciones y puede hablar de cualquier tiempo. En "estoy fuera":
  1. lo que comiste recibe su tiempo;
  2. se recalculan los presupuestos;
  3. Pive propone los tiempos que quedan con opciones del plan ajustadas.
- **Opcional, recomendado:** el dashboard muestra los tiempos del día con su presupuesto. Son los mismos números que ve Pive.

---

## 4. Memoria por usuario

**Analogía:** una **agenda de contactos, no un diario**. Cada hecho tiene una clave única (`food.pan_cuadrado`), y lo nuevo sobre el mismo tema reemplaza lo anterior.

### 4.1 Qué se guarda

**Sí** (hechos duraderos que cambian el consejo):

| Categoría | Etiqueta |
|---|---|
| `allergy` | Alergias e intolerancias |
| `restriction` | Restricciones (vegetariano, sin lácteos) |
| `food` | Alimentos que no come o que le encantan |
| `injury` | Lesiones o limitaciones |
| `schedule` | Horarios de entreno y trabajo |
| `equipment` | Equipo disponible |
| `goal` | Objetivos declarados |
| `context` | Contexto de vida ("viaja esta semana") |

**No:**
- lo que comió hoy (está en `dailyLogs`);
- métricas, metas y plan (están en el perfil);
- **horarios de comida** (estructura del día, §3);
- **ubicación** (perfil, §5);
- antojos de un día;
- información de otras personas.

**Los hechos sobre alimentos se pueden filtrar en código.** Cada hecho puede llevar una lista de alimentos (`foods`) y una postura (`stance`: evitar o preferir). Así se filtran los complementos de §3.7 sin depender del texto libre.

### 4.2 De dónde entra

| Fuente | Cuándo | Cómo |
|---|---|---|
| Chat | Al cerrar cada sesión | Consolidación (§4.3) |
| Plan nutricional | Al subir un plan | Sus restricciones se vuelven hechos con fuente `plan`. **Un plan nuevo borra los hechos del plan anterior**: lo que viene de un documento muere con el documento. |
| App | Cuando el usuario edita | Pantalla "Lo que Pive sabe de ti" |

### 4.3 Consolidación: "mientras duermes"

**Analogía:** el cerebro usa la memoria de corto plazo durante el día y consolida al dormir.

- **Corto plazo = la conversación.** Pive usa al instante lo que dijiste.
- **Largo plazo = la memoria.** Se actualiza **después** de la sesión, con una sola llamada barata que ve toda la conversación.

**Disparador:** una función programada cada 30 min busca sesiones sin consolidar e inactivas por 30 min. Si la memoria está desactivada, se salta sin llamar al modelo.

**Reglas del prompt:**

1. Si no hay nada duradero, no devuelve operaciones (es lo normal).
2. **Mismo tema = misma clave**: actualizar o borrar, nunca duplicar.
3. Lo más reciente gana.
4. **Si vuelve a lo neutral, se borra.** "Ya no me molesta el pan" → borrar. Si pasa a gustarle mucho → actualizar.
5. Lo temporal lleva vencimiento.
6. Las alergias nunca se infieren.
7. "Olvida que…" → borrar.
8. Si lo reafirma → confirmar.
9. Nada de la lista "No".

### 4.4 Filtro anti-basura (en código)

1. **Evidencia obligatoria:** cada operación trae una cita textual del usuario, y el código verifica que exista en sus mensajes (sin mayúsculas ni acentos). Si no existe, el modelo la inventó y se descarta. **Es el filtro más importante.**
2. **Formato:** la clave es `categoría.tema` en snake_case, el texto tiene ≤ 120 caracteres y la categoría coincide con la clave.
3. **Normalización:** crear sobre una clave existente = actualizar, y viceversa.
4. **Transacción**, guardando solo la versión anterior.
5. **Tope por plan** (40 en beta). Se eliminan primero los hechos de `food`, `schedule` y `equipment` menos confirmados. Nunca `allergy` ni `injury`.

### 4.5 Limpieza sin IA

- **Al cargar la memoria** se borran los hechos vencidos.
- **Los de `food`, `schedule` y `equipment` sin confirmar en ~6 meses** pasan a "por confirmar". Pive puede preguntarlos de forma natural y, sin respuesta, se borran.

| Categoría | Vence |
|---|---|
| `allergy` | Nunca (solo la borra el usuario) |
| `restriction` | Con el plan, si viene de ahí |
| `food`, `schedule`, `equipment` | Por confirmar a los ~6 meses |
| `injury` | Revisar a las 4–6 semanas |
| `goal` | Fecha objetivo + margen |
| `context` | Permanente o con vencimiento |

### 4.6 Ejemplo: el pan cuadrado

1. **Lunes:** "No me gusta el pan cuadrado". Al consolidar se crea `food.pan_cuadrado`, porque la evidencia se encontró.
2. **Martes:** la memoria entra al chat, así que no se sugiere pan cuadrado ni como complemento.
3. **Martes:** "Ya me gusta el pan cuadrado, compré uno integral buenísimo". Pive lo usa al instante. Al consolidar se actualiza a "Le gusta el pan cuadrado integral". Si solo hubiera dicho "ya no me molesta", se borraba.
4. **Miércoles:** "Hoy no quiero pan" es un antojo, así que no hay operación.

### 4.7 Activa por defecto, con control del usuario

- **Aviso único** en el primer chat: Pive recuerda cosas importantes, y se pueden ver, editar o desactivar en *Perfil → Lo que Pive sabe de ti*.
- **Pantalla "Lo que Pive sabe de ti":** hechos por categoría (editar y borrar), interruptor "Memoria activa" y "Borrar todo" aparte, con confirmación.
- **Memoria apagada:** no se inyecta ni se consolida, y los hechos se conservan.

### 4.8 Formato en el prompt

```
UBICACIÓN: Guadalajara, México (automática, hace 2 h)
MEMORIA DEL USUARIO (respétala; las alergias son absolutas):
- [Alergia] Alérgico al maní
- [Alimento] Le gusta el pan cuadrado integral
- [Horario] Entrena L-M-V a las 6am
```

Unos 20 tokens por hecho, así que 40 hechos son ~800 tokens.

---

## 5. Ubicación

**Para qué:** sugerir comidas, productos y tipos de tienda de tu zona. Solo se guardan **ciudad, región y país**, nunca coordenadas.

- **Aviso único** (estilo del banner "¡Completa tu perfil!"):

  > 📍 ¿Dónde estás? Pive usa tu ubicación principalmente para sugerirte comidas y tiendas de tu zona. Solo guardamos tu ciudad y país.
  >
  > [Usar mi ubicación] · [Elegir manualmente] · [Ahora no]

  El permiso del sistema solo se pide al tocar "Usar mi ubicación". "Ahora no" lo pospone 30 días.
- **Perfil:** modo Automática / Manual / Desactivada. En manual: país y ciudad.
- **Automática:**
  1. coordenadas de baja precisión;
  2. redondeadas a 2 decimales (~1 km) en el dispositivo;
  3. una Cloud Function las traduce a ciudad con la API de Geocoding de Google;
  4. se guarda solo ciudad y país.
- **¿Por qué una Cloud Function?** `expo-location` no traduce coordenadas a ciudad en web (se quitó en el SDK 49), y hoy la app es una PWA.
- **Cuándo se actualiza:**
  - al abrir el chat, si pasaron más de 6 h;
  - al abrir la app, solo si el permiso ya está concedido.

  Nunca se pide el permiso sin un toque del usuario. Si falla, se queda el último valor.

| Plataforma | Cómo | Notas |
|---|---|---|
| Web/PWA (prioridad) | `navigator.geolocation` sin alta precisión | En iOS como PWA el permiso puede volver a pedirse, y la Permissions API puede mentir; por eso la actualización va ligada a abrir el chat |
| iOS nativo | `expo-location`, precisión baja, "mientras se usa la app" | Si el usuario desactiva "Ubicación exacta", sigue sirviendo |
| Android | `expo-location`, solo ubicación aproximada | Mismo código que iOS |

**Costo:** la API de Geocoding tiene ~10,000 llamadas gratis al mes, así que con pocos usuarios es $0. La alternativa gratis es Nominatim (OpenStreetMap), con un límite de 1 llamada por segundo.

---

## 6. Chat

### 6.1 Acceso desde la tarjeta del consejo

```
┌──────────────────────────────────────────────┐
│ ✨  "Para el almuerzo haz tu opción 2 y       │  ← tocar el texto abre el chat
│     agrégale 40 g de queso tierno."          │
│                      [Registrar así]    ↻    │  ← registra la propuesta · actualizar consejo
│ ┌──────────────────────────────────────────┐ │
│ │ Pregúntale a Pive…                       │ │  ← abre el chat con el teclado listo
│ └──────────────────────────────────────────┘ │
│ [Comí fuera] [¿Qué almuerzo?] [Me falta proteína] │  ← atajos calculados en código
└──────────────────────────────────────────────┘
```

**Atajos:**
- "Comí fuera" siempre;
- uno según la próxima comida pendiente;
- "Me falta proteína" si queda más del ~30%;
- "Entrené hoy" si hay un entreno completado.

Tocar un atajo envía el mensaje directamente. La tarjeta muestra el campo y los atajos solo en el día de hoy. Si ya hay conversación, el campo dice "Continuar conversación". El refresco pasa a un botón ↻ visible.

**Pantalla `/chat`** (modal, como el perfil; en la PWA es una URL directa):
- el primer mensaje es el consejo del día;
- tarjetas de propuesta con el tiempo editable, [Registrar] y [Editar] (abre `FoodDialog`);
- Enter envía en web;
- accesibilidad: roles, etiquetas, región en vivo y 44 pt.

### 6.2 Cómo responde

1. Verifica el token. El uid sale siempre del token, nunca del modelo.
2. Revisa el límite (§7).
3. Carga memoria, ubicación, comidas de hoy y la sesión (últimos 10 turnos + resumen).
4. Llama al modelo con herramientas, con un máximo de 3 vueltas.
5. Registra el uso y devuelve la respuesta y las propuestas. **La IA nunca escribe sola en tu registro.**

| Herramienta | Qué devuelve |
|---|---|
| `getDaySummary` | Comidas de hoy por tiempo, presupuestos, restante y entreno |
| `getPlanOptions(slot)` | Opciones del plan para ese tiempo, ajustadas |
| `estimateMeal` | Ingredientes, macros, supuestos y tiempo sugerido (no registra) |
| `proposeMealLog` | Una propuesta que la app confirma |
| `getTraining` | Plan de entreno del día e historial |

### 6.3 "Estoy fuera"

1. Estima lo que comiste y su tiempo, y muestra cómo quedan los tiempos que faltan.
2. Da 2–3 opciones con cantidades:
   - qué comprar en el camino, según la ubicación;
   - la opción del plan para el siguiente tiempo, ajustada (casi siempre reducida);
   - o no hacer nada, si ya está cubierto.
3. Compensar no es castigar.
4. Alergias y gustos primero.
5. Respuestas cortas.

### 6.4 Sesiones

- Una por día, o una nueva tras 6 h sin mensajes.
- Más de 10 turnos → resumen de los anteriores.
- Una función programada consolida la memoria.
- `maxOutputTokens` y *thinking* bajo.
- **Modelo:** `gemini-3.5-flash-lite`. Si las herramientas fallan, probar `gemini-3.8-flash` solo para el chat.

---

## 7. Planes y límites (listo para premium)

- **Un solo lugar decide qué puede hacer cada usuario:** `users/{uid}/private/entitlements`, de solo lectura para el cliente. Si no existe, el usuario es `beta`.
  - **No puede vivir en `users/{uid}`:** hoy el dueño puede escribir cualquier campo de ese documento y se daría premium a sí mismo.
- **Límites en un solo archivo** (números de ejemplo, se ajustan con el costo medido):

| Límite | `beta` (hoy, todos) | `free` (futuro) | `premium` (futuro) |
|---|---|---|---|
| Mensajes de chat por día | 50 | 10 | 100 |
| Rutinas generadas por mes | 10 | 1 | 20 |
| Análisis de foto/documento por día | 40 | 15 | 80 |
| Hechos en memoria | 40 | 20 | 60 |
| Modelo del chat | ligero | ligero | ligero o pesado |

- **Uso por usuario y día:** se registra desde la fase 0, con tokens y costo estimado. Así sabrás cuánto cuesta cada usuario antes de ponerle precio a premium.
- **Al pasarse:** HTTP 429 con `limit_reached`. La app muestra cuándo se reinicia y, en el futuro, "Mejorar plan".
- **Cuando llegue el cobro:** Stripe para la PWA. Si sale la app nativa de iOS, las reglas de Apple aplican y RevenueCat unifica las tiendas.

---

## 8. Rutinas híbridas

- **Cada día de la rutina pasa a tener bloques:** fuerza (ejercicios), carrera (suave, tempo, intervalos o largo, con duración, distancia, ritmo, zona e intervalos) y movilidad.
- **Los planes viejos se leen** como un bloque de fuerza, sin migrar.
- **El extractor y el generador devuelven el mismo esquema.**
- **El generador** recibe un formulario (objetivo, días, minutos, nivel, carrera actual) y además lesiones, horario y equipo de la memoria, y tus récords. Usa el modelo pesado y muestra una vista previa antes de guardar.
- **Reglas base** (**hay que validarlas con un entrenador**):
  - la mayoría de los km suaves, con 1–2 sesiones de calidad por semana;
  - subir el volumen poco a poco, con descarga cada 3–4 semanas;
  - no meter intervalos ni tempo el día después de pierna pesada;
  - respetar las lesiones.
- **Nombres canónicos de ejercicios** ("Press de banca") para conectar la rutina con los récords.
- **Carreras en la PWA:** marcar el bloque como hecho con distancia, tiempo y RPE, y "Registrar actividad suelta" para lo que no estaba en el plan. El historial guarda la fuente (`app`, `manual` o `healthkit`).
- **Apple Health** (fase 5): HealthKit no existe en web. Solo aplica con app nativa, e importa al mismo formato.

---

## 9. Costos estimados

Son precios de fuentes secundarias: hay que confirmarlos en la página oficial de precios de Gemini. La fase 0 mide el costo real.

- `gemini-3.5-flash-lite`: ~$0.30 por millón de tokens de entrada, ~$0.03 cacheados, ~$2.50 de salida.
- `gemini-3.8-flash`: ~$0.75 de entrada / ~$3.75 de salida (una sola fuente).

| Pieza | Modelo / servicio | Costo aprox. |
|---|---|---|
| Mensaje de chat (2 llamadas, con caché) | flash-lite | ~$0.003 |
| Consejo del día (~1,500 tokens) | flash-lite | < $0.001 |
| Tiempos, presupuestos, ajustes, complementos | código | $0 |
| Consolidación de memoria (1 por sesión) | flash-lite | ~$0.0015 |
| Rutina generada | 3.8-flash | ~$0.02 |
| Ubicación automática | Geocoding (10k gratis al mes) | $0 con pocos usuarios |
| **Usuario muy activo al mes** (5 mensajes/día, 1 sesión/día, 4 rutinas) | | **~$0.60** |

**Dónde se va el dinero:** la salida y el *thinking*, el historial y los datos del usuario. El núcleo cacheado es ~9% del costo de un mensaje.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Flash-Lite usa mal las herramientas | Evals de escenarios; probar 3.8-flash solo para el chat |
| Las ventanas de horario no coinciden con tu día | Editables; el tiempo siempre se corrige; más adelante se aprende de las correcciones |
| Valores de la tabla de complementos | Revisión con la nutricionista; equivalencias del plan primero |
| El modelo recalcula o inventa cantidades | Regla del núcleo + salida estructurada: lo que se registra sale del código |
| Datos de salud y ubicación | Memoria visible, editable, desactivable y borrable; ubicación con aviso, solo ciudad y país; reglas de Firestore |
| Permiso de ubicación en la PWA de iOS | Actualizar al abrir el chat; conservar el último valor |
| Tiendas o marcas inventadas | Regla de categorías genéricas en el núcleo |
| Consejos de entrenamiento | Validar las reglas con un profesional; aviso de que no es consejo médico |
| Precios que cambian | Medición por usuario desde la fase 0 |
