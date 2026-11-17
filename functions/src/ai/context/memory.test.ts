import { formatMemoryContext } from './memory';
import { formatLocationContext } from './location';
import { type CoachMemory, DAY_MS, emptyMemory, type MemoryFact } from '../../shared/memory/memory';

const NOW = Date.UTC(2026, 10, 17, 15);
const fact = (key: string, text: string, extra: Partial<MemoryFact> = {}): MemoryFact => ({
  key,
  category: key.split('.')[0] as MemoryFact['category'],
  text,
  source: 'chat',
  createdAt: NOW - DAY_MS,
  updatedAt: NOW - DAY_MS,
  lastConfirmedAt: NOW - DAY_MS,
  ...extra,
});
const withFacts = (...facts: MemoryFact[]): CoachMemory => ({ ...emptyMemory(), facts: Object.fromEntries(facts.map((f) => [f.key, f])) });

describe('formatMemoryContext', () => {
  it('allergies first, then by category; marks plan facts, expiries and facts to confirm; leaves out expired ones', () => {
    const memory = withFacts(
      fact('schedule.entreno', 'Entrena L-M-V a las 6am'),
      fact('food.pan_cuadrado', 'Le gusta el pan cuadrado integral', { lastConfirmedAt: NOW - 200 * DAY_MS }),
      fact('allergy.mani', 'Alérgico al maní'),
      fact('restriction.plan_sin_lacteos', 'Sin lácteos', { source: 'plan' }),
      fact('context.viaje', 'De viaje en Lima esta semana', { expiresAt: Date.UTC(2026, 10, 23) }),
      fact('context.mudanza', 'Se estaba mudando', { expiresAt: NOW - 1 }),
    );
    expect(formatMemoryContext(memory, NOW)).toBe(
      [
        'MEMORIA DEL USUARIO (respétala; las alergias son absolutas):',
        '- [Alergia] Alérgico al maní',
        '- [Restricción] Sin lácteos (de su plan)',
        '- [Alimento] Le gusta el pan cuadrado integral (por confirmar)',
        '- [Horario] Entrena L-M-V a las 6am',
        '- [Contexto] De viaje en Lima esta semana (hasta el 22/11)',
      ].join('\n'),
    );
  });

  it('is empty when the memory is off, missing or has no facts', () => {
    const memory = withFacts(fact('allergy.mani', 'Alérgico al maní'));
    expect(formatMemoryContext({ ...memory, enabled: false }, NOW)).toBe('');
    expect(formatMemoryContext(null, NOW)).toBe('');
    expect(formatMemoryContext(emptyMemory(), NOW)).toBe('');
  });
});

describe('formatLocationContext', () => {
  it('automatic, with its age', () => {
    expect(
      formatLocationContext({ mode: 'auto', city: 'Guadalajara', region: 'Jalisco', country: 'México', countryCode: 'MX', updatedAt: NOW - 2 * 3600_000 }, NOW),
    ).toBe('UBICACIÓN: Guadalajara, México (automática, hace 2 h)');
  });

  it('manual, with only a country', () => {
    expect(formatLocationContext({ mode: 'manual', country: 'Costa Rica', updatedAt: NOW - 3 * DAY_MS }, NOW)).toBe(
      'UBICACIÓN: Costa Rica (elegida por el usuario, hace 3 días)',
    );
  });

  it('empty when off or unknown', () => {
    expect(formatLocationContext({ mode: 'off', city: 'Lima', country: 'Perú' }, NOW)).toBe('');
    expect(formatLocationContext({ mode: 'auto', askedAt: NOW }, NOW)).toBe('');
    expect(formatLocationContext(undefined, NOW)).toBe('');
  });
});
