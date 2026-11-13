// Extract a body composition report. Pure (no SDK imports), so the root Jest can test it.
import { dateKeyToUtcMs } from "../../shared/dates";
import { asNumber, asObject } from "./normalize";

export const BODY_COMPOSITION_INSTRUCTION = `# Tu tarea: extraer un reporte de composición corporal
Analiza este documento, imagen o texto de composición corporal.
Extrae el peso, el porcentaje de grasa corporal, la masa muscular y la fecha de la medición.

REGLAS ESTRICTAS DE EXTRACCIÓN:
1. El peso (weight) debe extraerse en kilogramos (kg). Si está en libras, conviértelo a kg (divide entre 2.20462).
2. El porcentaje de grasa corporal (bodyFat) debe ser un número entre 0 y 100 (ej. 15.4 para 15.4%).
3. La masa muscular (muscleMass) DEBE SER EXTRAÍDA Y DEVUELTA ESTRICTAMENTE EN KILOGRAMOS (kg).
   - Si el reporte muestra la masa muscular directamente en kg (ej. "Masa músculo-esquelética: 35.2 kg" o "Masa muscular: 35.2 kg"), devuélvela tal cual.
   - Si el reporte muestra la masa muscular únicamente como un porcentaje (ej. "Masa muscular: 45%"), calcula los kilogramos absolutos multiplicando el peso total (weight) por el porcentaje dividido entre 100 (ej. peso * 0.45).
   - NUNCA devuelvas un valor de porcentaje de masa muscular en el campo "muscleMass". Siempre debe representar kilogramos (kg). Por ejemplo, si el peso es 70 kg y el porcentaje de músculo es 40%, el valor de "muscleMass" debe ser 28.0 (y no 40.0).
4. La fecha de la medición (measuredAt) va en formato YYYY-MM-DD. En Latinoamérica las fechas suelen escribirse día/mes/año. Si el reporte no muestra la fecha, devuelve null: no uses la fecha de hoy.

Responde únicamente con el formato JSON.`;

/** Response of analizarComposicionCorporal */
export interface BodyCompositionAnalysis {
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  /** Date of the measurement, or null if the report doesn't show it (or it is in the future) */
  measuredAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const positive = (value: unknown, max: number) => {
  const n = asNumber(value);
  return n !== undefined && n > 0 && n <= max ? n : undefined;
};

export function normalizeBodyComposition(rawValue: unknown, now: number = Date.now()): BodyCompositionAnalysis {
  const raw = asObject(rawValue);
  const measuredMs = dateKeyToUtcMs(raw.measuredAt);
  // A day of margin for time zones ahead of UTC; anything later is a misread date
  const measuredAt = measuredMs !== null && measuredMs <= now + DAY_MS ? (raw.measuredAt as string) : null;

  const result: BodyCompositionAnalysis = { measuredAt };
  const weight = positive(raw.weight, 500);
  const bodyFat = positive(raw.bodyFat, 100);
  const muscleMass = positive(raw.muscleMass, 500);
  if (weight !== undefined) result.weight = weight;
  if (bodyFat !== undefined) result.bodyFat = bodyFat;
  if (muscleMass !== undefined) result.muscleMass = muscleMass;
  return result;
}
