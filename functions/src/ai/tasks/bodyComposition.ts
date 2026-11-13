export const BODY_COMPOSITION_INSTRUCTION = `Analiza este documento, imagen o texto de composición corporal.
Extrae el peso, porcentaje de grasa corporal y masa muscular.

REGLAS ESTRICTAS DE EXTRACCIÓN:
1. El peso (weight) debe extraerse en kilogramos (kg). Si está en libras, conviértelo a kg (divide entre 2.20462).
2. El porcentaje de grasa corporal (bodyFat) debe ser un número entre 0 y 100 (ej. 15.4 para 15.4%).
3. La masa muscular (muscleMass) DEBE SER EXTRAÍDA Y DEVUELTA ESTRICTAMENTE EN KILOGRAMOS (kg).
   - Si el reporte muestra la masa muscular directamente en kg (ej. "Masa músculo-esquelética: 35.2 kg" o "Masa muscular: 35.2 kg"), devuélvela tal cual.
   - Si el reporte muestra la masa muscular únicamente como un porcentaje (ej. "Masa muscular: 45%"), calcula los kilogramos absolutos multiplicando el peso total (weight) por el porcentaje dividido entre 100 (ej. peso * 0.45).
   - NUNCA devuelvas un valor de porcentaje de masa muscular en el campo "muscleMass". Siempre debe representar kilogramos (kg). Por ejemplo, si el peso es 70 kg y el porcentaje de músculo es 40%, el valor de "muscleMass" debe ser 28.0 (y no 40.0).

Responde únicamente con el formato JSON.`;
