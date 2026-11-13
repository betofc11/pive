import { normalizeWorkoutPlan, WORKOUT_PLAN_INSTRUCTION } from './workoutPlan';
import { TRAINING_RULES } from '../prompts/training';

it('the instruction starts with the training rules and no longer asks for YouTube links', () => {
  expect(WORKOUT_PLAN_INSTRUCTION.startsWith(TRAINING_RULES)).toBe(true);
  expect(WORKOUT_PLAN_INSTRUCTION).not.toMatch(/youtube/i);
});

describe('normalizeWorkoutPlan', () => {
  const plan = normalizeWorkoutPlan({
    name: 'Push Pull Legs',
    days: [
      {
        name: 'Día 1: Push',
        exercises: [
          {
            name: 'Bench press',
            sets: 4,
            reps: '8-10',
            description: 'Baja controlado',
            muscleGroups: ['Pecho', 'Brazos', 'Tríceps', 'Pecho'],
            youtubeUrl: 'https://www.youtube.com/results?search_query=bench',
          },
        ],
      },
      { name: '', exercises: [{ name: 'Sentadillas', sets: '5', reps: '5', description: '', muscleGroups: ['Piernas'] }] },
      { name: 'Descanso', exercises: [] },
    ],
  });

  it('uses canonical names, limits muscle groups to the list and drops youtubeUrl', () => {
    expect(plan.days[0].exercises[0]).toEqual({
      name: 'Press de banca',
      sets: '4',
      reps: '8-10',
      description: 'Baja controlado',
      muscleGroups: ['Pecho', 'Brazos'],
    });
    expect(plan.days[1].exercises[0].name).toBe('Sentadilla');
  });

  it('names a day without a name by its position and keeps rest days', () => {
    expect(plan.days.map((day) => day.name)).toEqual(['Día 1: Push', 'Día 2', 'Descanso']);
  });
});
