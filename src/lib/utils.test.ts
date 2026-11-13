// These tests run in America/New_York (see jest.global-setup.js), so the "local date vs UTC"
// and daylight saving cases below are real.
import { addDays, dateKeyToNoonIso, formatNum, getDatePillLabel, getFormattedDateOnly, getLocalDateString, getLocalTimeString } from './utils';

it('runs in the fixed test time zone', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York');
});

describe('formatNum', () => {
  it('shows "--" when there is no number', () => {
    expect(formatNum(undefined)).toBe('--');
    expect(formatNum(null)).toBe('--');
    expect(formatNum(NaN)).toBe('--');
  });

  it('formats with es-ES separators and at most one decimal', () => {
    expect(formatNum(1910)).toBe('1910');
    expect(formatNum(12345.678)).toBe('12.345,7');
    expect(formatNum(0)).toBe('0');
  });
});

describe('getLocalDateString', () => {
  afterEach(() => jest.useRealTimers());

  it('uses the local date, not the UTC one', () => {
    // 23:30 in New York is already the next day in UTC
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 19, 23, 30));
    expect(getLocalDateString()).toBe('2026-10-19');
  });

  it('pads month and day', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 5, 9, 0));
    expect(getLocalDateString()).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('moves forward and backward within a month', () => {
    expect(addDays('2026-10-19', 1)).toBe('2026-10-20');
    expect(addDays('2026-10-19', -1)).toBe('2026-10-18');
    expect(addDays('2026-10-19', 0)).toBe('2026-10-19');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles February in leap and common years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('does not skip or repeat a day across daylight saving changes', () => {
    // New York switches to DST on 2026-03-08 and back on 2026-11-01
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01');
  });
});

describe('getDatePillLabel', () => {
  afterEach(() => jest.useRealTimers());

  it('labels today and yesterday only', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 19, 12, 0));
    expect(getDatePillLabel('2026-10-19')).toBe('Hoy');
    expect(getDatePillLabel('2026-10-18')).toBe('Ayer');
    expect(getDatePillLabel('2026-10-17')).toBeNull();
    expect(getDatePillLabel('2026-10-20')).toBeNull();
  });

  it('finds "yesterday" across a month boundary', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 1, 8, 0));
    expect(getDatePillLabel('2026-10-31')).toBe('Ayer');
  });
});

describe('getFormattedDateOnly', () => {
  it('formats the date in Spanish without shifting the day', () => {
    expect(getFormattedDateOnly('2026-10-19')).toBe('lun, 19 oct');
    expect(getFormattedDateOnly('2026-01-01')).toBe('jue, 1 ene');
  });
});

describe('getLocalTimeString', () => {
  it('formats the local time as 24-hour HH:mm', () => {
    expect(getLocalTimeString(new Date(2026, 10, 13, 8, 5))).toBe('08:05');
    expect(getLocalTimeString(new Date(2026, 10, 13, 21, 40))).toBe('21:40');
  });

  it('converts an ISO string (UTC) to local time', () => {
    // 01:30 UTC is 20:30 of the previous day in New York (EST, UTC-5)
    expect(getLocalTimeString('2026-11-14T01:30:00.000Z')).toBe('20:30');
  });

  it('returns an empty string for an invalid date', () => {
    expect(getLocalTimeString('nope')).toBe('');
  });
});

it('dateKeyToNoonIso keeps the same local day', () => {
  const iso = dateKeyToNoonIso('2026-10-02');
  const date = new Date(iso);
  expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 2, 12]);
});
