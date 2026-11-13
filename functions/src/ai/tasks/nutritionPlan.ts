export const NUTRITION_PLAN_INSTRUCTION = `Analiza este plan nutricional (ya sea una imagen, un PDF o texto extraído).
Extrae y devuelve de forma estructurada los macros totales sugeridos (calorías, proteínas, carbohidratos, grasas),
una breve recomendación personalizada en español (consejo / advice), la lista de intercambios diarios (exchanges)
y la estructura de las comidas (meals) detallando el tipo de comida y las opciones sugeridas de menús con sus macros e ingredientes.

REGLA DE IDIOMA: Todos los campos de texto del JSON (títulos de opciones, nombres de ingredientes, unidades, nombres de los grupos de intercambio, etc.) DEBEN estar estrictamente en español.
Responde en formato JSON.`;
