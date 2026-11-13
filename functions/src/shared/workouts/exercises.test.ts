import { CANONICAL_EXERCISES, canonicalExerciseName, isMuscleGroup, MUSCLE_GROUPS } from './exercises';

describe('canonicalExerciseName', () => {
  it.each([
    ['bench press', 'Press de banca'],
    ['Bench Press', 'Press de banca'],
    ['Press banca', 'Press de banca'],
    ['press de banca', 'Press de banca'],
    ['Sentadillas', 'Sentadilla'],
    ['squat', 'Sentadilla'],
    ['Peso muerto rumano', 'Peso muerto rumano'],
    ['RDL', 'Peso muerto rumano'],
    ['Pull-ups', 'Dominadas'],
    ['Elevación lateral', 'Elevaciones laterales'],
    ['curl de bíceps', 'Curl de bíceps con mancuernas'],
    ['  press   MILITAR ', 'Press militar'],
  ])('%p → %p', (input, expected) => {
    expect(canonicalExerciseName(input)).toBe(expected);
  });

  it('returns an unknown name as it was, without extra spaces', () => {
    expect(canonicalExerciseName('  Remo   Meadows ')).toBe('Remo Meadows');
  });

  it('keeps every canonical name as it is', () => {
    for (const name of CANONICAL_EXERCISES) {
      expect(canonicalExerciseName(name)).toBe(name);
    }
  });
});

it('MUSCLE_GROUPS are the six groups the app shows', () => {
  expect(MUSCLE_GROUPS).toEqual(['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core']);
  expect(isMuscleGroup('Core')).toBe(true);
  expect(isMuscleGroup('Glúteos')).toBe(false);
});
