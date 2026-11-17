import { AUTO_REFRESH_MS, isAutoLocationStale, NOTICE_SNOOZE_MS, roundCoords, sameCoords, shouldShowLocationNotice } from './location';

const NOW = Date.UTC(2026, 10, 17, 15);

describe('roundCoords', () => {
  it('rounds to 2 decimals by default, and never to more', () => {
    expect(roundCoords({ lat: 9.93333, lng: -84.08345 })).toEqual({ lat: 9.93, lng: -84.08 });
    expect(roundCoords({ lat: 20.6767, lng: -103.3475 }, 1)).toEqual({ lat: 20.7, lng: -103.3 });
    expect(roundCoords({ lat: 20.6767, lng: -103.3475 }, 6)).toEqual({ lat: 20.68, lng: -103.35 });
    // No -0
    expect(Object.is(roundCoords({ lat: -0.001, lng: 0 }).lat, 0)).toBe(true);
  });

  it('sameCoords', () => {
    expect(sameCoords({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(true);
    expect(sameCoords({ lat: 1, lng: 2 }, { lat: 1, lng: 3 })).toBe(false);
    expect(sameCoords(null, { lat: 1, lng: 2 })).toBe(false);
  });
});

describe('shouldShowLocationNotice', () => {
  it('shows without a location, or when "Ahora no" was more than 30 days ago', () => {
    expect(shouldShowLocationNotice(undefined, NOW)).toBe(true);
    expect(shouldShowLocationNotice({ mode: 'manual', askedAt: NOW - 1000 }, NOW)).toBe(false);
    expect(shouldShowLocationNotice({ mode: 'manual', askedAt: NOW - NOTICE_SNOOZE_MS - 1 }, NOW)).toBe(true);
  });

  it('never with a known country or with the mode off', () => {
    expect(shouldShowLocationNotice({ mode: 'manual', country: 'Costa Rica' }, NOW)).toBe(false);
    expect(shouldShowLocationNotice({ mode: 'off' }, NOW)).toBe(false);
  });
});

describe('isAutoLocationStale', () => {
  it('only in automatic mode, after 6 h or without a place yet', () => {
    expect(isAutoLocationStale({ mode: 'auto', country: 'México', updatedAt: NOW - AUTO_REFRESH_MS - 1 }, NOW)).toBe(true);
    expect(isAutoLocationStale({ mode: 'auto', country: 'México', updatedAt: NOW - 1000 }, NOW)).toBe(false);
    expect(isAutoLocationStale({ mode: 'auto' }, NOW)).toBe(true);
    expect(isAutoLocationStale({ mode: 'manual', updatedAt: 0 }, NOW)).toBe(false);
    expect(isAutoLocationStale(undefined, NOW)).toBe(false);
  });
});
