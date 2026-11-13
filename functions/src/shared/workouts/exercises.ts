// Exercise names and muscle groups. User-facing values, so they are in Spanish.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.

export const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export function isMuscleGroup(value: unknown): value is MuscleGroup {
  return typeof value === 'string' && (MUSCLE_GROUPS as readonly string[]).includes(value);
}

/**
 * Canonical name → aliases (English names, regional Spanish names, short forms).
 * Matching ignores case, accents, punctuation and a trailing "s" on each word, so plurals don't need their own alias.
 */
const EXERCISE_ALIASES: Record<string, string[]> = {
  // Pecho
  'Press de banca': ['bench press', 'barbell bench press', 'flat bench press', 'press banca', 'press de banca plano', 'press plano', 'banca', 'press de pecho con barra'],
  'Press inclinado con barra': ['incline bench press', 'incline barbell press', 'press inclinado', 'press de banca inclinado'],
  'Press de banca con mancuernas': ['dumbbell bench press', 'dumbbell press', 'press con mancuernas', 'press plano con mancuernas'],
  'Press inclinado con mancuernas': ['incline dumbbell press', 'press inclinado mancuernas'],
  'Aperturas con mancuernas': ['dumbbell fly', 'dumbbell flye', 'chest fly', 'aperturas', 'aperturas de pecho'],
  'Cruce de poleas': ['cable crossover', 'cable fly', 'crossover', 'cruces en polea'],
  Fondos: ['dips', 'chest dips', 'fondos en paralelas', 'fondos en paralela'],
  Flexiones: ['push up', 'push-up', 'pushup', 'lagartijas', 'flexiones de pecho', 'flexion de pecho', 'flexion', 'pechadas'],
  // Piernas
  Sentadilla: ['squat', 'back squat', 'barbell squat', 'sentadilla con barra', 'sentadilla trasera', 'sentadilla libre'],
  'Sentadilla frontal': ['front squat'],
  'Sentadilla búlgara': ['bulgarian split squat', 'split squat bulgaro', 'bulgara'],
  'Sentadilla goblet': ['goblet squat', 'sentadilla copa'],
  'Prensa de piernas': ['leg press', 'prensa', 'prensa inclinada', 'prensa de pierna'],
  'Peso muerto': ['deadlift', 'conventional deadlift', 'peso muerto convencional'],
  'Peso muerto rumano': ['romanian deadlift', 'rdl', 'peso muerto piernas rigidas'],
  Zancadas: ['lunge', 'walking lunge', 'estocadas', 'desplantes', 'zancada'],
  'Extensión de cuádriceps': ['leg extension', 'extension de piernas', 'extensiones de pierna', 'extension de cuadriceps en maquina'],
  'Curl femoral': ['leg curl', 'hamstring curl', 'lying leg curl', 'seated leg curl', 'curl de isquiotibiales', 'curl femoral acostado', 'curl de pierna'],
  'Elevación de talones': ['calf raise', 'standing calf raise', 'pantorrillas', 'gemelos', 'elevacion de pantorrillas', 'elevaciones de talones'],
  'Hip thrust': ['hip thrust', 'barbell hip thrust', 'empuje de cadera', 'puente de gluteo con barra'],
  // Espalda
  Dominadas: ['pull up', 'pull-up', 'pullup', 'dominadas pronas', 'dominada'],
  'Dominadas supinas': ['chin up', 'chin-up', 'chinup'],
  'Jalón al pecho': ['lat pulldown', 'pulldown', 'jalon frontal', 'jalon dorsal', 'polea al pecho', 'jalon en polea alta'],
  'Remo con barra': ['barbell row', 'bent over row', 'bent-over row', 'remo inclinado con barra'],
  'Remo con mancuerna': ['dumbbell row', 'one arm dumbbell row', 'remo a una mano', 'serrucho'],
  'Remo en polea baja': ['seated cable row', 'cable row', 'remo sentado', 'remo en polea'],
  'Face pull': ['face pull', 'jalon a la cara'],
  // Hombros
  'Press militar': ['overhead press', 'military press', 'ohp', 'press de hombros con barra', 'press militar con barra'],
  'Press de hombros con mancuernas': ['dumbbell shoulder press', 'shoulder press', 'press de hombros', 'press militar con mancuernas'],
  'Press Arnold': ['arnold press'],
  'Elevaciones laterales': ['lateral raise', 'dumbbell lateral raise', 'side raise', 'elevacion lateral', 'vuelos laterales', 'laterales'],
  'Elevaciones frontales': ['front raise', 'elevacion frontal', 'frontales'],
  'Pájaros': ['reverse fly', 'rear delt fly', 'elevaciones posteriores', 'aperturas invertidas', 'pajaro'],
  Encogimientos: ['shrug', 'encogimientos de hombros', 'encogimiento de hombros'],
  // Brazos
  'Curl de bíceps con barra': ['barbell curl', 'curl con barra', 'curl de biceps con barra z', 'curl con barra z'],
  'Curl de bíceps con mancuernas': ['dumbbell curl', 'biceps curl', 'bicep curl', 'curl de biceps', 'curl con mancuernas', 'curl alterno'],
  'Curl martillo': ['hammer curl', 'curl de martillo'],
  'Extensión de tríceps en polea': ['tricep pushdown', 'triceps pushdown', 'cable pushdown', 'jalon de triceps', 'extension de triceps', 'triceps en polea', 'extension de triceps en polea alta'],
  'Press francés': ['skull crusher', 'skullcrusher', 'lying triceps extension', 'rompecraneos'],
  // Core
  Plancha: ['plank', 'plancha abdominal', 'plancha frontal'],
  Crunch: ['crunch abdominal', 'abdominales', 'encogimientos abdominales', 'crunches', 'abdominal'],
  'Elevación de piernas': ['leg raise', 'hanging leg raise', 'elevaciones de piernas', 'elevacion de piernas colgado'],
  'Rueda abdominal': ['ab wheel', 'ab rollout', 'rueda'],
};

/** Every canonical name, in the order of the table. TRAINING_RULES shows this same list to the model. */
export const CANONICAL_EXERCISES: readonly string[] = Object.keys(EXERCISE_ALIASES);

// Lowercase, no accents, words split on anything that isn't a letter or digit, trailing "s" dropped from each word
const matchKey = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word.length > 2 && word.endsWith('s') ? word.slice(0, -1) : word))
    .join(' ');

const CANONICAL_BY_KEY: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(EXERCISE_ALIASES)) {
    for (const name of [canonical, ...aliases]) {
      const key = matchKey(name);
      const existing = map.get(key);
      if (existing && existing !== canonical) {
        throw new Error(`Exercise alias "${name}" points to both "${existing}" and "${canonical}"`);
      }
      map.set(key, canonical);
    }
  }
  return map;
})();

/**
 * Canonical Spanish name of an exercise ("bench press" → "Press de banca"), so plans and records use the same names.
 * Unknown names come back as they were, only without extra spaces.
 */
export function canonicalExerciseName(name: string): string {
  const cleaned = name.replace(/\s+/g, ' ').trim();
  return CANONICAL_BY_KEY.get(matchKey(cleaned)) ?? cleaned;
}
