import {
  clockToMinutes,
  dateKeyToUtcMs,
  isClockTime,
  isDateKey,
  isoToLocalClock,
  minutesToClock,
  utcOffsetFromLocalClock,
  weekdayLabel,
} from './dates';

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

describe('clock times', () => {
  it.each(['00:00', '07:30', '23:59'])('accepts %p', (value) => {
    expect(isClockTime(value)).toBe(true);
  });

  it.each([undefined, '7:30', '24:00', '12:60', '12:30:00', '12h30', 1230])('rejects %p', (value) => {
    expect(isClockTime(value)).toBe(false);
    expect(clockToMinutes(value)).toBeNull();
  });

  it('converts between HH:mm and minutes, wrapping around midnight', () => {
    expect(clockToMinutes('11:50')).toBe(710);
    expect(minutesToClock(710)).toBe('11:50');
    expect(minutesToClock(1450)).toBe('00:10');
    expect(minutesToClock(-10)).toBe('23:50');
  });
});

describe('utcOffsetFromLocalClock', () => {
  // 2026-11-13 18:00 UTC
  const now = Date.UTC(2026, 10, 13, 18, 0);

  it('deduces the offset of the user from their local clock', () => {
    expect(utcOffsetFromLocalClock('2026-11-13', '12:00', now)).toBe(-360); // Costa Rica
    expect(utcOffsetFromLocalClock('2026-11-13', '19:00', now)).toBe(60); // Madrid in winter
    expect(utcOffsetFromLocalClock('2026-11-14', '03:30', now)).toBe(570); // Adelaide, across midnight
  });

  it('tolerates a request that took a few minutes to arrive', () => {
    expect(utcOffsetFromLocalClock('2026-11-13', '11:57', now)).toBe(-360);
    expect(utcOffsetFromLocalClock('2026-11-13', '12:06', now)).toBe(-360);
  });

  it('returns null for invalid values or an impossible offset', () => {
    expect(utcOffsetFromLocalClock('2026-11-13', '7:00', now)).toBeNull();
    expect(utcOffsetFromLocalClock(undefined, '12:00', now)).toBeNull();
    expect(utcOffsetFromLocalClock('2026-11-11', '12:00', now)).toBeNull();
  });
});

it('isoToLocalClock gives the local HH:mm of a stored meal time', () => {
  expect(isoToLocalClock('2026-11-13T18:20:00.000Z', -360)).toBe('12:20');
  expect(isoToLocalClock('2026-11-14T02:10:00.000Z', -360)).toBe('20:10');
  expect(isoToLocalClock('nope', 0)).toBeNull();
  expect(isoToLocalClock(undefined, 0)).toBeNull();
});
