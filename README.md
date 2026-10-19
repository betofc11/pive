# Pive - Tu Estilo de Vida Inteligente

**Pive** es una app para iOS, Android y web que te ayuda a seguir tu nutrición y tu entrenamiento. Usa IA (Google Gemini) para leer tus planes, analizar tus comidas y darte consejos según lo que llevas en el día.

## 🚀 Características

- **Dashboard diario**: macros y calorías del día frente a tus metas, tus comidas y un consejo de IA según lo que llevas. Puedes moverte entre días para ver o registrar fechas pasadas.
- **Registro de comidas con IA**: saca una foto del plato, describe lo que comiste ("2 huevos revueltos y una tostada") o combina ambas. La IA propone ingredientes y macros, y tú los corriges antes de guardar. También hay entrada manual y comidas frecuentes.
- **Plan nutricional**: sube tu plan (imagen, PDF o texto) y la IA extrae macros objetivo, opciones de comidas e intercambios. Registras una opción del plan con un toque.
- **Composición corporal**: peso, % de grasa y masa muscular con gráficas de evolución. Se pueden cargar a mano o desde la foto/PDF de un reporte.
- **Récords de fuerza**: tus máximos organizados por grupo muscular.
- **Coach**: sube tu rutina y la IA la organiza en días y ejercicios (con link a YouTube), con una sesión de entrenamiento activa para ir marcando lo que haces.
- **Apple Health** (iOS): sincroniza comidas y métricas corporales.

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| App | [Expo](https://expo.dev/) SDK 54 · React Native 0.81 (New Architecture) · React 19 · TypeScript |
| Navegación | [Expo Router](https://docs.expo.dev/router/introduction/) (rutas por archivos, typed routes, React Compiler) |
| Auth y datos | [Firebase](https://firebase.google.com/) Auth (email/contraseña y Google) + Firestore |
| IA | Cloud Functions v2 (Node 22) + [Gemini](https://ai.google.dev/) 2.5 Flash / Pro (`@google/genai`) |
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
├── functions/src/index.ts    # Cloud Functions con Gemini
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

### Cloud Functions

Todas son HTTP `POST` y exigen el ID token de Firebase (`Authorization: Bearer …`). Si Gemini responde 429 (límite de uso) o 503 (modelo saturado), reintentan hasta 3 veces antes de devolver el error:

| Función | Qué hace | Modelo |
|---|---|---|
| `obtenerConsejoPive` | Consejo según los macros y comidas del día | Flash |
| `analizarImagenComida` | Comida desde foto, descripción o ambas → nombre, ingredientes y macros | Flash |
| `calcularMacrosIngredientes` | Macros a partir de una lista de ingredientes | Flash |
| `analizarPlanNutricional` | Estructura un plan nutricional (imagen, PDF o texto) | Pro |
| `analizarComposicionCorporal` | Extrae peso, % grasa y masa muscular de un reporte | Pro |
| `analizarPlanEntrenamiento` | Estructura una rutina de entrenamiento | Pro |

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
   npx tsc --noEmit
   ```

6. **Tests** (Jest con `jest-expo`)
   ```bash
   npm test                 # unitarios: fechas (src/lib/utils) y llamadas a las Cloud Functions (geminiService)
   npm run test:emulator    # integración: transacciones del log diario y reglas de Firestore, contra los emuladores
   ```
   - Los tests corren en la zona horaria `America/New_York` (`jest.global-setup.js`), así que los casos de "fecha local vs UTC" y de horario de verano se prueban de verdad en cualquier máquina.
   - `test:emulator` levanta los emuladores de Firestore y Auth (requiere **Java 21**) con el proyecto de prueba `demo-pive`, que nunca toca datos reales. Usa la misma base y las mismas `firestore.rules` que producción.
   - GitHub Actions (`.github/workflows/ci.yml`) corre lint, tipos y ambos tipos de tests en cada PR y en cada push a `main`.

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
