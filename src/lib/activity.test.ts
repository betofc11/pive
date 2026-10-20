// Runs in America/New_York (see jest.global-setup.js)
import { buildActivityItems, formatActivityTime, MAX_ACTIVITY_ITEMS } from './activity';
import { BodyMetricsHistory, StrengthRecord } from '../types';

const metrics = (id: string, date: string, weight: number): BodyMetricsHistory => ({
  id, userId: 'u1', weight, date, createdAt: Date.parse(date),
});
const record = (id: string, date: string, exercise: string, weight: number): StrengthRecord => ({
  id, userId: 'u1', exercise, weight, date, muscleGroups: [],
});

describe('buildActivityItems', () => {
  it('merges metrics, records and plan uploads, most recent first', () => {
    const items = buildActivityItems(
      [metrics('m1', '2026-10-18T12:00:00.000Z', 77.4)],
      [record('r1', '2026-10-19T12:00:00.000Z', 'Press de Banca', 80)],
      {
        nutritionalPlan: { name: 'Plan', calories: 1910, protein: 163, carbs: 152, fats: 74, extractedAt: Date.parse('2026-10-17T12:00:00.000Z') },
        workoutPlan: { name: 'Rutina', days: [], extractedAt: Date.parse('2026-10-16T12:00:00.000Z') },
      },
    );

    expect(items.map((i) => [i.type, i.title])).toEqual([
      ['record', 'Nuevo Récord · Press de Banca 80 kg'],
      ['metrics', 'Composición Actualizada · 77,4 kg'],
      ['nutritionPlan', 'Plan Nutricional Subido'],
      ['workoutPlan', 'Rutina de Entrenamiento Subida'],
    ]);
  });

  it(`keeps only the ${MAX_ACTIVITY_ITEMS} most recent`, () => {
    const many = Array.from({ length: 8 }, (_, i) => metrics(`m${i}`, `2026-10-0${i + 1}T12:00:00.000Z`, 70 + i));
    const items = buildActivityItems(many, [], null);
    expect(items).toHaveLength(MAX_ACTIVITY_ITEMS);
    expect(items[0].id).toBe('metrics-m7');
  });

  it('skips entries with an invalid date and plans that were never uploaded', () => {
    const items = buildActivityItems([metrics('bad', 'not a date', 70)], [], { nutritionalPlan: undefined, workoutPlan: undefined });
    expect(items).toEqual([]);
  });
});

describe('formatActivityTime', () => {
  const now = new Date(2026, 9, 19, 18, 0); // Oct 19, 6:00 PM local

  it('says "Hoy" and "Ayer" by calendar day, with a 12-hour time', () => {
    expect(formatActivityTime(new Date(2026, 9, 19, 10, 30).getTime(), now)).toBe('Hoy, 10:30 AM');
    expect(formatActivityTime(new Date(2026, 9, 18, 23, 45).getTime(), now)).toBe('Ayer, 11:45 PM');
  });

  it('shows the date for older entries', () => {
    expect(formatActivityTime(new Date(2026, 9, 12, 9, 5).getTime(), now)).toBe('12 oct, 9:05 AM');
  });

  it('handles midnight and noon', () => {
    expect(formatActivityTime(new Date(2026, 9, 19, 0, 5).getTime(), now)).toBe('Hoy, 12:05 AM');
    expect(formatActivityTime(new Date(2026, 9, 19, 12, 30).getTime(), now)).toBe('Hoy, 12:30 PM');
  });

  it('still says "Ayer" across the end of daylight saving time', () => {
    // New York goes back to standard time on 2026-11-01
    expect(formatActivityTime(new Date(2026, 10, 1, 22, 0).getTime(), new Date(2026, 10, 2, 8, 0))).toBe('Ayer, 10:00 PM');
  });
});
