# Pive

App de nutrición y entrenamiento para iOS, Android y web. **Hoy se usa sobre todo como PWA instalada en iPhone**, así que la web es la plataforma prioritaria.

## Stack

- Expo SDK 54, React Native 0.81 (New Architecture), React 19, TypeScript estricto.
- Navegación con Expo Router: rutas tipadas y React Compiler.
- Firebase Auth + Firestore. Ojo: es una **base de datos con nombre** (`firestoreDatabaseId` en `firebase-applet-config.json`).
- Cloud Functions v2 (Node 22) en `functions/`, con Gemini (`@google/genai`). Endpoints HTTP POST que exigen el ID token de Firebase.
- Web: export estático (`npm run build`) desplegado en Vercel.

## Comandos

```bash
npm run lint                     # ESLint (expo lint)
npx tsc --noEmit                 # tipos de la app
npx tsc --noEmit -p functions    # tipos de las Functions
npm test                         # Jest (jest-expo): unitarios
npm run test:emulator            # Jest contra emuladores de Firestore/Auth (requiere Java 21)
npm run build                    # export web (lo que despliega Vercel)
npm run web                      # app en el navegador
npm run --prefix functions serve # emulador de Functions (necesita functions/.secret.local con GEMINI_API_KEY)
```

CI (`.github/workflows/ci.yml`) corre lint, los dos typechecks, los tests unitarios y los de emulador en cada PR y en cada push a `main`.

## Convenciones

- **Idioma:**
  - Textos de UI en español latinoamericano, tratando de tú.
  - Identificadores, tipos y comentarios del código en inglés.
  - Los endpoints de Functions se nombran en español (`analizarImagenComida`); sigue ese patrón.
- **Valores de datos:** los que el usuario ve tal cual van en español (grupos musculares, unidades). Los enums internos van en inglés, con un mapa de etiquetas para la UI.
- **Plataformas:** las variantes se separan con archivos `*.web.ts` (por ejemplo `healthKitService.web.ts`).
- **Escrituras compuestas** (log diario, sesión de entrenamiento): con transacciones, como en `src/services/dailyLogService.ts`.
- **Commits:** Conventional Commits en inglés (`feat(coach): …`, `fix(functions): …`, `docs: …`).
- **Firestore:** todo está denegado por defecto en `firestore.rules`. Cada subcolección nueva necesita su `match` y un test de emulador.

## Cosas que muerden

- **Solo se despliega la carpeta `functions/`.** Las Functions no pueden importar de `src/`. El código compartido entre la app y las Functions va en `functions/src/shared/`, y la app lo importa desde ahí. Ese código debe ser **TypeScript puro**: sin dependencias de npm, React Native ni Node.
- **Los tests de `functions/src/shared/` los corre el Jest de la raíz** (`npm test`). `functions/tsconfig.json` debe excluir `src/**/*.test.ts` para que `tsc -p functions` no los compile.
- **Admin SDK en Functions:** usa la base con nombre (`getFirestore(app, FIRESTORE_DATABASE_ID)`), no la default.
- **Nada que el usuario no deba cambiar va en `users/{uid}`.** La regla de ese documento deja al dueño escribir cualquier campo, así que el plan de pago o los contadores van en subcolecciones de solo lectura para el cliente.
- **Despliega las Functions antes que la app** cuando cambie un contrato entre ambas.
- **En sesiones en la nube no hay `GEMINI_API_KEY`.** La lógica se prueba con tests de funciones puras; las pruebas reales con IA se hacen en local o después del deploy.

## Plan en curso

El roadmap de Pive Coach (chat, comidas por tiempo, memoria, ubicación, rutinas híbridas) está en `docs/plan/`. Si te piden trabajar en una fase, lee primero `docs/plan/README.md` y el archivo de esa fase.
