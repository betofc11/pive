import { parseGeocoding } from './parseGeocoding';

// A reverse geocoding answer for downtown Guadalajara (latlng=20.68,-103.35, language=es), trimmed and anonymized:
// no street address or place ids.
const guadalajara = {
  plus_code: { compound_code: 'MM00+00 Guadalajara, Jal., México' },
  results: [
    {
      address_components: [
        { long_name: 'Centro', short_name: 'Centro', types: ['neighborhood', 'political'] },
        { long_name: 'Guadalajara', short_name: 'Guadalajara', types: ['locality', 'political'] },
        { long_name: 'Jalisco', short_name: 'Jal.', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'México', short_name: 'MX', types: ['country', 'political'] },
        { long_name: '44100', short_name: '44100', types: ['postal_code'] },
      ],
      formatted_address: 'Centro, Guadalajara, Jal., México',
      types: ['neighborhood', 'political'],
    },
    {
      address_components: [
        { long_name: 'Jalisco', short_name: 'Jal.', types: ['administrative_area_level_1', 'political'] },
        { long_name: 'México', short_name: 'MX', types: ['country', 'political'] },
      ],
      types: ['administrative_area_level_1', 'political'],
    },
  ],
  status: 'OK',
};

describe('parseGeocoding', () => {
  it('takes city, region and country (long names) and the country code', () => {
    expect(parseGeocoding(guadalajara)).toEqual({ city: 'Guadalajara', region: 'Jalisco', country: 'México', countryCode: 'MX' });
  });

  it('without a locality, uses the closest thing (the canton)', () => {
    const response = {
      status: 'OK',
      results: [
        {
          address_components: [
            { long_name: 'Escazú', short_name: 'Escazú', types: ['administrative_area_level_2', 'political'] },
            { long_name: 'Provincia de San José', short_name: 'San José', types: ['administrative_area_level_1', 'political'] },
            { long_name: 'Costa Rica', short_name: 'CR', types: ['country', 'political'] },
          ],
        },
      ],
    };
    expect(parseGeocoding(response)).toEqual({ city: 'Escazú', region: 'Provincia de San José', country: 'Costa Rica', countryCode: 'CR' });
  });

  it('null without results, without a country, or with anything else', () => {
    expect(parseGeocoding({ status: 'ZERO_RESULTS', results: [] })).toBeNull();
    expect(parseGeocoding({ status: 'REQUEST_DENIED', results: [] })).toBeNull();
    expect(parseGeocoding({ status: 'OK', results: [{ address_components: [{ long_name: 'Océano', types: ['natural_feature'] }] }] })).toBeNull();
    expect(parseGeocoding(null)).toBeNull();
    expect(parseGeocoding('x')).toBeNull();
  });
});
