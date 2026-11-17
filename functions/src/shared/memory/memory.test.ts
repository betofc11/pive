import { categoryOfKey, MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS, MEMORY_KEY_RE, normalizeText, parseCoachMemory } from './memory';

describe('normalizeText', () => {
  it('lowercases, removes accents and collapses whitespace', () => {
    expect(normalizeText('  Alérgico   al MANÍ \n')).toBe('alergico al mani');
    expect(normalizeText('Piña')).toBe('pina');
  });
});

describe('keys', () => {
  it('MEMORY_KEY_RE and categoryOfKey', () => {
    expect(categoryOfKey('food.pan_cuadrado')).toBe('food');
    expect(categoryOfKey('allergy.mani')).toBe('allergy');
    for (const bad of ['Food.pan', 'food.Pan', 'food.p', 'comida.pan', 'food.pan-cuadrado', 'food.', `food.${'a'.repeat(41)}`, 3]) {
      expect(categoryOfKey(bad)).toBeNull();
    }
  });

  it('every category has its label and is in the key pattern', () => {
    for (const category of MEMORY_CATEGORIES) {
      expect(MEMORY_CATEGORY_LABELS[category]).toBeTruthy();
      expect(MEMORY_KEY_RE.test(`${category}.algo`)).toBe(true);
    }
  });
});

describe('parseCoachMemory', () => {
  it('a missing document is an empty, enabled memory', () => {
    expect(parseCoachMemory(undefined)).toEqual({ enabled: true, facts: {}, updatedAt: 0 });
  });

  it('keeps valid facts, drops broken ones and fills missing dates', () => {
    const memory = parseCoachMemory({
      enabled: false,
      noticeSeenAt: 5,
      updatedAt: 9,
      facts: {
        'food.atun': { text: ' No le gusta el atún ', foods: ['atun', 3], stance: 'avoid', source: 'chat', updatedAt: 7 },
        'Food.Bad': { text: 'mala clave' },
        'goal.fuerza': { text: '' },
        'allergy.mani': 'texto suelto',
      },
    });
    expect(memory).toEqual({
      enabled: false,
      noticeSeenAt: 5,
      updatedAt: 9,
      facts: {
        'food.atun': {
          key: 'food.atun',
          category: 'food',
          text: 'No le gusta el atún',
          foods: ['atun'],
          stance: 'avoid',
          source: 'chat',
          createdAt: 7,
          updatedAt: 7,
          lastConfirmedAt: 7,
        },
      },
    });
  });
});
