# Pive - Tu Estilo de Vida Inteligente

**Pive** es una app para iOS, Android y web que te ayuda a seguir tu nutrición y tu entrenamiento. Usa IA (Google Gemini) para leer tus planes, analizar tus comidas y darte consejos según lo que llevas en el día.

## 🚀 Características

- **Dashboard diario**: macros y calorías del día frente a tus metas, tus comidas y un consejo de IA según lo que llevas. Puedes moverte entre días para ver o registrar fechas pasadas.
- **Registro de comidas con IA**: saca una foto del plato, describe lo que comiste ("2 huevos revueltos y una tostada") o combina ambas. La IA propone los ingredientes con los macros de cada uno y dice lo que supuso, y tú los corriges antes de guardar. Si solo cambias una cantidad, los macros se recalculan en la app, sin volver a llamar a la IA. También hay entrada manual y comidas frecuentes.
- **Plan nutricional**: sube tu plan (imagen, PDF o texto) y la IA extrae las metas de macros, los tiempos de comida con sus opciones (con macros por ingrediente), los intercambios y las restricciones. Registras una opción del plan con un toque.
- **Composición corporal**: peso, % de grasa y masa muscular con gráficas de evolución. Se pueden cargar a mano o desde la foto/PDF de un reporte (con la fecha del reporte, si la trae).
- **Récords de fuerza**: tus máximos organizados por grupo muscular.
- **Coach**: sube tu rutina y la IA la organiza en días y ejercicios, con nombres en español y una búsqueda en YouTube por ejercicio, más una sesión de entrenamiento activa para ir marcando lo que haces.
- **Apple Health** (iOS): sincroniza comidas y métricas corporales.

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| App | [Expo](https://expo.dev/) SDK 54 · React Native 0.81 (New Architecture) · React 19 · TypeScript |
| Navegación | [Expo Router](https://docs.expo.dev/router/introduction/) (rutas por archivos, typed routes, React Compiler) |
| Auth y datos | [Firebase](https://firebase.google.com/) Auth (email/contraseña y Google) + Firestore |
| IA | Cloud Functions v2 (Node 22) + [Gemini](https://ai.google.dev/) 3.5 Flash-Lite / 3.8 Flash (`@google/genai`) |
| UI | `react-native-svg` (gráficas), `lucide-react-native` (iconos), Epilogue + Plus Jakarta Sans |
| Salud | `react-native-health` (Apple HealthKit) |
| Web | Export estático de Expo, desplegado en [Vercel](https://vercel.com/) |

## 📂 Estructura

```
pive/
├── app/                      # Rutas (Expo Router)
│   ├── _layout.tsx           # Layout raíz: fuentes, AuthProvider, redirección a /auth o /(tabs)
│   ├── auth.tsx              # Login y registro
│   ├── profile.tsx           # Perfil (modal)
│   └── (tabs)/               # Pestañas: Pive (index), Plan, Stats, Coach
│       └── _layout.tsx       # Tab bar, botón "+" y contexto con la fecha seleccionada
├── src/
│   ├── components/           # Diálogos (FoodDialog, RecordDialog, BodyCompositionDialog…) y tarjetas
│   ├── hooks/                # useAuth (usuario + perfil en tiempo real), useGoogleSignIn
│   ├── services/             # geminiService (llama a las Cloud Functions), healthKitService
│   ├── lib/                  # Utilidades de fechas/formato y Alert multiplataforma
│   ├── firebase.ts           # Inicialización de Firebase (+ firebase.web.ts para web)
│   ├── theme.ts              # Colores, fuentes y espaciados
│   └── types.ts              # Modelos de datos
├── functions/                # Cloud Functions con Gemini (lo único que se despliega a Firebase)
│   ├── src/shared/           # TypeScript puro que usan la app y las Functions: macros, tiempos de comida,
│   │                         #   ingredientes, ejercicios, fechas y los contratos de los endpoints (api.ts)
│   ├── src/ai/               # Cliente de Gemini, bloques de prompt, esquemas e instrucciones de cada tarea
│   ├── src/endpoints/        # Un archivo por endpoint (index.ts solo los re-exporta)
│   ├── src/usage.ts          # Registro de tokens y costo por usuario
│   └── evals/                # Evals de calidad de la IA (se corren a mano, con tu key)
├── firestore.rules           # Reglas de seguridad de Firestore
├── firebase-applet-config.json  # Config pública del cliente de Firebase
├── app.json                  # Config de Expo (bundle IDs, plugins, permisos de HealthKit)
└── vercel.json               # Rewrites de la versión web
```

Los archivos `*.web.ts` son la versión web de un módulo: el bundler elige solo la variante correcta según la plataforma (por ejemplo, HealthKit no existe en web y el login de Google usa un popup).

### Datos en Firestore

Todo cuelga de `users/{uid}`, y las reglas solo dejan a cada usuario leer y escribir lo suyo:

- `users/{uid}`: perfil, metas de macros, plan nutricional, rutina y sesión activa.
- `dailyLogs/{YYYY-MM-DD}`: comidas y macros del día (se borran solos a los 90 días con el TTL de `expireAt`).
- `strengthRecords`, `bodyMetricsHistory`, `savedMeals`.
- `usage/{YYYY-MM-DD}`: tokens y costo estimado de la IA por función y por día. Solo lo escriben las Cloud Functions; el usuario lo puede leer.

### Cloud Functions

Todas son HTTP `POST` y exigen el ID token de Firebase (`Authorization: Bearer …`). Si Gemini responde 429 (límite de uso) o 503 (modelo saturado), reintentan hasta 3 veces antes de devolver el error. Los tipos exactos de cada respuesta están en `functions/src/shared/api.ts`.

| Función | Qué hace | Modelo |
|---|---|---|
| `obtenerConsejoPive` | Consejo según los macros y comidas del día → `{ advice }` | `gemini-3.5-flash-lite` |
| `analizarImagenComida` | Comida desde foto, descripción o ambas → nombre, ingredientes con sus macros, total, supuestos y `mentionedSlot` (el tiempo de comida, solo si el usuario lo dijo) | `gemini-3.5-flash-lite` |
| `calcularMacrosIngredientes` | Macros de una lista de ingredientes → totales y desglose. Solo manda a la IA los que no traen macros | `gemini-3.5-flash-lite` |
| `analizarPlanNutricional` | Estructura un plan nutricional (imagen, PDF o texto): metas, tiempos (`slot`), opciones con macros por ingrediente, intercambios, equivalencias y restricciones | `gemini-3.8-flash` |
| `analizarComposicionCorporal` | Extrae peso, % grasa, masa muscular y la fecha del reporte (`measuredAt`) | `gemini-3.8-flash` |
| `analizarPlanEntrenamiento` | Estructura una rutina en días y ejercicios, con nombres canónicos en español y grupos musculares de una lista fija | `gemini-3.8-flash` |

- **Los números los calcula el código:** el total de una comida es la suma de sus ingredientes, y el de una opción del plan, la de los suyos. Toda respuesta de la IA se valida y se normaliza antes de devolverla.
- **Prompts:** las instrucciones van en `systemInstruction` y los datos en `contents`. Los bloques comunes (`PIVE_CORE`, `NUTRITION_RULES`, `TRAINING_RULES`) están en `functions/src/ai/prompts/`.
- **Registro de uso:** cada llamada a Gemini suma sus tokens (de entrada, cacheados, de salida y de *thinking*) y un costo estimado en `users/{uid}/usage/{YYYY-MM-DD}`. La fecha es la local del usuario (`localDate`, que la app manda en cada llamada). Si el registro falla, la respuesta sale igual. Los precios están en `MODEL_PRICES` (`functions/src/usageCost.ts`): verifícalos en la [página oficial de precios](https://ai.google.dev/gemini-api/docs/pricing).

## 📦 Desarrollo local

1. **Instalar dependencias**
   ```bash
   npm install
   npm install --prefix functions
   ```

2. **Variables de entorno**: copia `.env.example` a `.env` y completa los client IDs de Google. Solo hacen falta para el login con Google en iOS/Android.

3. **Levantar las Cloud Functions en local**: en desarrollo (`__DEV__`) la app llama al emulador de Functions (`localhost:5001`, o `10.0.2.2:5001` desde el emulador de Android), así que las funciones de IA necesitan el emulador corriendo. Crea `functions/.secret.local` con tu key de [Google AI Studio](https://aistudio.google.com/apikey):
   ```bash
   echo "GEMINI_API_KEY=tu_api_key" > functions/.secret.local
   npm run --prefix functions serve   # requiere la CLI de Firebase: npm i -g firebase-tools
   ```
   Auth y Firestore apuntan siempre al proyecto real de Firebase.

4. **Arrancar la app**
   ```bash
   npm run web       # navegador
   npm run ios       # build nativa en simulador/dispositivo (requiere Xcode)
   npm run android   # build nativa (requiere Android Studio)
   ```
   La app usa módulos nativos (Google Sign-In, Apple Health), así que en **Expo Go** esas funciones no están disponibles. Para probarlas usa `npm run ios` / `npm run android`.

5. **Lint y tipos**
   ```bash
   npm run lint
   npx tsc --noEmit                 # la app (incluye lo que importa de functions/src/shared)
   npx tsc --noEmit -p functions    # las Cloud Functions
   ```

6. **Tests** (Jest con `jest-expo`)
   ```bash
   npm test                 # unitarios: utilidades de la app, código compartido (functions/src/shared) y lógica pura de las Functions
   npm run test:emulator    # integración: transacciones, registro de uso y reglas de Firestore, contra los emuladores
   ```
   - Los tests corren en la zona horaria `America/New_York` (`jest.global-setup.js`), así que los casos de "fecha local vs UTC" y de horario de verano se prueban de verdad en cualquier máquina.
   - `test:emulator` levanta los emuladores de Firestore y Auth (requiere **Java 21**) con el proyecto de prueba `demo-pive`, que nunca toca datos reales. Usa la misma base y las mismas `firestore.rules` que producción.
   - GitHub Actions (`.github/workflows/ci.yml`) corre lint, tipos y ambos tipos de tests en cada PR y en cada push a `main`.

7. **Evals de IA** (opcional, con tu key; cuestan un poco): `npm run --prefix functions eval:food`. Más detalles en [`functions/evals/README.md`](functions/evals/README.md).

## 🚢 Despliegue

- **Web**: Vercel despliega cada push a `main` y crea una preview por cada PR.
- **Cloud Functions**:
  ```bash
  npx firebase-tools functions:secrets:set GEMINI_API_KEY   # solo la primera vez o para rotar la key
  npm run deploy:functions
  ```
  Si un cambio toca a la vez una función y la app, **despliega primero las funciones**: así la app nueva nunca llama a una versión vieja de la API.
- **Reglas de Firestore**: `firestore.rules` es la fuente de verdad y se publica en la base de datos de la app (la que figura en `firebase.json`):
  ```bash
  npm run deploy:rules
  ```
  Esto **reemplaza** las reglas que haya en la consola. Si alguna vez las editas ahí, copia el cambio a `firestore.rules` para no perderlo en el próximo deploy. Un `firebase deploy` sin `--only` también las publica.
- **iOS / Android**: las apps instaladas no cambian hasta que generes y publiques una build nueva.
