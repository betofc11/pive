import { placeLabel, timeAgoLabel } from './location';

const NOW = Date.UTC(2026, 10, 17, 15);

describe('placeLabel', () => {
  it('city and country, or region, or only the country', () => {
    expect(placeLabel({ mode: 'auto', city: 'Guadalajara', region: 'Jalisco', country: 'México' })).toBe('Guadalajara, México');
    expect(placeLabel({ mode: 'auto', region: 'Jalisco', country: 'México' })).toBe('Jalisco, México');
    expect(placeLabel({ mode: 'manual', city: '  ', country: 'Costa Rica' })).toBe('Costa Rica');
  });

  it('null without a country or with the mode off', () => {
    expect(placeLabel({ mode: 'auto', city: 'Lima' })).toBeNull();
    expect(placeLabel({ mode: 'off', city: 'Lima', country: 'Perú' })).toBeNull();
    expect(placeLabel(undefined)).toBeNull();
  });
});

describe('timeAgoLabel', () => {
  it.each([
    [NOW - 20_000, 'hace un momento'],
    [NOW - 5 * 60_000, 'hace 5 min'],
    [NOW - 2 * 3600_000, 'hace 2 h'],
    [NOW - 30 * 3600_000, 'hace 1 día'],
    [NOW - 3 * 24 * 3600_000, 'hace 3 días'],
    [NOW + 60_000, 'hace un momento'],
  ])('%p → %s', (ms, label) => {
    expect(timeAgoLabel(ms, NOW)).toBe(label);
  });
});
