export const WORKOUT_PLAN_INSTRUCTION = `Analiza esta rutina de entrenamiento (que puede ser una o varias fotos, capturas de pantalla, archivos de texto o PDFs).
Extrae la rutina dividida en días de entrenamiento de forma estructurada.
Si algún día no tiene un nombre claro, genera un nombre descriptivo en español (ej: "Día 1: Push", "Día 2: Pull", "Día 3: Piernas").
Para cada ejercicio, extrae el nombre del ejercicio, número de series (sets), repeticiones (reps), una breve descripción de la técnica o forma en español (máximo 1 frase), y un arreglo de categorías de grupos musculares a los que pertenece (debe ser una o más de: Pecho, Espalda, Piernas, Hombros, Brazos, Core).
Genera un URL de búsqueda en YouTube para cada ejercicio del tipo: "https://www.youtube.com/results?search_query=como+hacer+[nombre+ejercicio]".
Responde en formato JSON.`;
