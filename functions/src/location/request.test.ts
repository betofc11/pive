import { geocodingUrl, parseLatLng } from './request';

describe('parseLatLng', () => {
  it('rounds to 2 decimals again', () => {
    expect(parseLatLng({ lat: 9.933331, lng: -84.083456, extra: 1 })).toEqual({ lat: 9.93, lng: -84.08 });
  });

  it('rejects anything out of range or not a number', () => {
    for (const body of [{ lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: '9.9', lng: 1 }, { lat: NaN, lng: 1 }, { lat: 1 }, null, 'x']) {
      expect(parseLatLng(body)).toBeNull();
    }
  });
});

it('geocodingUrl asks in Spanish', () => {
  expect(geocodingUrl({ lat: 9.93, lng: -84.08 }, 'k&y')).toBe(
    'https://maps.googleapis.com/maps/api/geocode/json?latlng=9.93,-84.08&language=es&key=k%26y',
  );
});
