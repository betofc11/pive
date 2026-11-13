# Evals de IA

Pruebas de calidad de las respuestas de Gemini. No corren en la CI ni en `npm test`: llaman a la API real, cuestan un poco y sus resultados cambian de una corrida a otra.

## Estimación de comidas (`food.json`)

Cada caso es una descripción de comida con un rango razonable de calorías y proteína. Algunos casos también traen `expectSlot`, que comprueba `mentionedSlot`: el tiempo de comida solo debe salir si el usuario lo dice (`null` cuando no lo dice).

El script usa la misma lógica que el endpoint `analizarImagenComida` (`estimateFood`, en `src/ai/estimateFood.ts`), sin HTTP ni autenticación.

### Cómo correrlo

1. Pon tu key de Gemini en `functions/.secret.local` (la misma que usa el emulador) o expórtala como `GEMINI_API_KEY`:
   ```bash
   echo "GEMINI_API_KEY=tu_api_key" > functions/.secret.local
   ```
2. Compila y corre:
   ```bash
   npm run --prefix functions eval:food
   # Un solo caso:
   npm run --prefix functions eval:food -- tacos-pastor
   ```

El reporte marca con ✗ los casos fuera de rango y muestra sus ingredientes y supuestos, para que veas dónde se equivocó. Al final muestra el costo estimado de la corrida. Si algún caso falla, sale con código 1.

### Cuándo correrlo

- Al cambiar `NUTRITION_RULES`, la instrucción de comida o el modelo ligero.
- Si un caso falla siempre, revisa primero el rango: son estimaciones, no verdades absolutas.
