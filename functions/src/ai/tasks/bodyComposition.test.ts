import { normalizeBodyComposition } from './bodyComposition';

const now = Date.UTC(2026, 10, 13, 15, 0);

describe('normalizeBodyComposition', () => {
  it('keeps the metrics and a valid measurement date', () => {
    expect(normalizeBodyComposition({ weight: 76.5, bodyFat: 14.8, muscleMass: 37.1, measuredAt: '2026-10-02' }, now)).toEqual({
      weight: 76.5,
      bodyFat: 14.8,
      muscleMass: 37.1,
      measuredAt: '2026-10-02',
    });
  });

  it.each([null, undefined, '02/10/2026', '2026-02-30', '2026-11-20'])('measuredAt %p → null (missing, invalid or in the future)', (measuredAt) => {
    expect(normalizeBodyComposition({ weight: 76.5, measuredAt }, now).measuredAt).toBeNull();
  });

  it('drops metrics that are missing or out of range', () => {
    expect(normalizeBodyComposition({ weight: 0, bodyFat: 140, muscleMass: -3, measuredAt: null }, now)).toEqual({ measuredAt: null });
  });
});
