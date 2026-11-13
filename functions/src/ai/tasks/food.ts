export const FOOD_INSTRUCTION = `Analiza esta comida a partir de la imagen y/o la descripción del usuario. Identifica el plato, los ingredientes con una cantidad aproximada, y calcula los macronutrientes totales (calorías, proteínas, carbohidratos, grasas).
Si hay imagen y descripción, la descripción manda: úsala para corregir cantidades, ingredientes o forma de preparación que la imagen no muestra.
REGLAS DE IDIOMA: Todos los campos de texto del JSON (como 'name' del plato y 'name' de los ingredientes) DEBEN estar estrictamente en español.
Responde en formato JSON.`;
