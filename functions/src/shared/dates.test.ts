import { dateKeyToUtcMs, isDateKey, weekdayLabel } from './dates';

describe('isDateKey', () => {
  it.each(['2026-11-13', '2024-02-29', '2026-12-31'])('accepts %p', (value) => {
    expect(isDateKey(value)).toBe(true);
  });

  it.each([undefined, null, 20261113, '', '2026-11-1', '13/11/2026', '2026-02-29', '2026-02-30', '2026-13-01', '2026-11-13T00:00:00Z'])(
    'rejects %p',
    (value) => {
      expect(isDateKey(value)).toBe(false);
    },
  );
});

it('dateKeyToUtcMs gives midnight UTC of that day', () => {
  expect(dateKeyToUtcMs('2026-11-13')).toBe(Date.UTC(2026, 10, 13));
  expect(dateKeyToUtcMs('nope')).toBeNull();
});

it('weekdayLabel gives the day of the week in Spanish, whatever the time zone', () => {
  expect(weekdayLabel('2026-11-13')).toBe('viernes');
  expect(weekdayLabel('2026-11-15')).toBe('domingo');
  expect(weekdayLabel('2026-11-18')).toBe('miércoles');
  expect(weekdayLabel('2026-02-30')).toBeNull();
});
