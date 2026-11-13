import { PIVE_CORE } from "../prompts/core";

export const ADVICE_INSTRUCTION = `${PIVE_CORE}
Tu tarea es dar un consejo nutricional diario sumamente corto (máximo 2 frases).

REGLAS DE ORO:
1. Sé extremadamente breve: Máximo 2 frases.
2. Analiza detenidamente la HORA ACTUAL del día y las COMIDAS REGISTRADAS hoy para deducir el contexto del usuario (si ya desayunó, si le toca el almuerzo, la merienda o la cena).
3. Adapta tu recomendación de manera realista:
   - Si es tarde/noche (ej. después de las 19:00 o 20:00) y le faltan muchos macros/calorías, recomiéndale la mejor y más saludable cena o snack nocturno para cerrar el día de forma práctica (priorizando proteína, sin forzar a comer en exceso si es muy tarde).
   - Si es temprano o medio día (ej. mañana o medio día), recomiéndale qué priorizar en su próximo desayuno o almuerzo para mantenerse en el camino correcto.
4. Indica qué alimentos naturales específicos (ej. pechuga de pollo, huevos, avena, aguacate) le ayudarán a completar los macros que le faltan hoy.
5. PROHIBIDO: No menciones NUNCA métricas corporales como porcentaje de grasa, masa muscular o peso en tu consejo. Enfócate únicamente en nutrición, alimentos y energía.`;
