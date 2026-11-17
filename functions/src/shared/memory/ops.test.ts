import { applyMemoryOps, MAX_OPS_PER_SESSION, validateMemoryOps } from './ops';
import { type CoachMemory, DAY_MS, emptyMemory, type MemoryFact, type MemoryOp } from './memory';

// 2026-11-17 15:00 UTC
const NOW = Date.UTC(2026, 10, 17, 15);
const LATER = NOW + 2 * DAY_MS;

const fact = (key: string, text: string, extra: Partial<MemoryFact> = {}): MemoryFact => ({
  key,
  category: key.split('.')[0] as MemoryFact['category'],
  text,
  source: 'chat',
  createdAt: NOW - 10 * DAY_MS,
  updatedAt: NOW - 10 * DAY_MS,
  lastConfirmedAt: NOW - 10 * DAY_MS,
  ...extra,
});
const withFacts = (...facts: MemoryFact[]): CoachMemory => ({ ...emptyMemory(), facts: Object.fromEntries(facts.map((f) => [f.key, f])) });

/** Validates and applies, as consolidateSession does */
const consolidate = (memory: CoachMemory, messages: string[], ops: MemoryOp[], now = NOW) => {
  const result = validateMemoryOps(ops, memory, messages, now);
  return { ...result, memory: applyMemoryOps(memory, result.accepted, now, 'chat') };
};

const panCuadrado = fact('food.pan_cuadrado', 'No le gusta el pan cuadrado', { foods: ['pan cuadrado'], stance: 'avoid' });

describe('the conversations of the phase 2 table', () => {
  it('pan cuadrado (create): "no me gusta el pan cuadrado" creates food.pan_cuadrado with stance avoid', () => {
    const { accepted, rejected, memory } = consolidate(emptyMemory(), ['Hola Pive. No me gusta el pan cuadrado, ¿qué desayuno?'], [
      {
        op: 'create',
        key: 'food.pan_cuadrado',
        category: 'food',
        text: 'No le gusta el pan cuadrado',
        foods: ['Pan cuadrado'],
        stance: 'avoid',
        evidence: 'no me gusta el pan cuadrado',
      },
    ]);
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    expect(memory.facts['food.pan_cuadrado']).toEqual({
      key: 'food.pan_cuadrado',
      category: 'food',
      text: 'No le gusta el pan cuadrado',
      foods: ['pan cuadrado'],
      stance: 'avoid',
      source: 'chat',
      evidence: 'no me gusta el pan cuadrado',
      createdAt: NOW,
      updatedAt: NOW,
      lastConfirmedAt: NOW,
    });
    expect(memory.updatedAt).toBe(NOW);
  });

  it('pan cuadrado (update): "ya me gusta…" updates the same key and keeps the previous text', () => {
    const { memory } = consolidate(withFacts(panCuadrado), ['Ya me gusta el pan cuadrado, compré uno integral buenísimo'], [
      {
        op: 'update',
        key: 'food.pan_cuadrado',
        category: 'food',
        text: 'Le gusta el pan cuadrado integral',
        foods: ['pan cuadrado integral'],
        stance: 'prefer',
        evidence: 'ya me gusta el pan cuadrado, compré uno integral',
      },
    ], LATER);
    const updated = memory.facts['food.pan_cuadrado'];
    expect(updated).toMatchObject({ text: 'Le gusta el pan cuadrado integral', stance: 'prefer', foods: ['pan cuadrado integral'] });
    expect(updated.previous).toEqual({ text: 'No le gusta el pan cuadrado', updatedAt: panCuadrado.updatedAt });
    expect(updated.createdAt).toBe(panCuadrado.createdAt);
    expect(updated.updatedAt).toBe(LATER);
    expect(Object.keys(memory.facts)).toEqual(['food.pan_cuadrado']);
  });

  it('pan cuadrado (neutral): "ya no me molesta" deletes it', () => {
    const { accepted, memory } = consolidate(withFacts(panCuadrado), ['ya no me molesta el pan cuadrado'], [
      { op: 'delete', key: 'food.pan_cuadrado', evidence: 'ya no me molesta el pan cuadrado' },
    ]);
    expect(accepted).toEqual([{ op: 'delete', key: 'food.pan_cuadrado', evidence: 'ya no me molesta el pan cuadrado' }]);
    expect(memory.facts).toEqual({});
  });

  it('allergy: "soy alérgico al maní" creates allergy.mani', () => {
    const { rejected, memory } = consolidate(emptyMemory(), ['Soy alérgico al maní'], [
      { op: 'create', key: 'allergy.mani', category: 'allergy', text: 'Alérgico al maní', foods: ['maní'], evidence: 'soy alergico al mani' },
    ]);
    expect(rejected).toEqual([]);
    expect(memory.facts['allergy.mani']).toMatchObject({ category: 'allergy', text: 'Alérgico al maní', foods: ['mani'] });
  });

  it('inferred allergy: an allergy without explicit evidence is rejected', () => {
    const { accepted, rejected } = consolidate(emptyMemory(), ['el maní me cae pesado'], [
      { op: 'create', key: 'allergy.mani', category: 'allergy', text: 'Alérgico al maní', evidence: 'el maní me cae pesado' },
    ]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([expect.objectContaining({ reason: 'allergy_not_explicit' })]);
  });

  it('trip: "esta semana estoy de viaje en Lima" creates context.viaje with an expiry', () => {
    const { memory } = consolidate(emptyMemory(), ['Esta semana estoy de viaje en Lima'], [
      {
        op: 'create',
        key: 'context.viaje',
        category: 'context',
        text: 'De viaje en Lima esta semana',
        expiresAt: '2026-11-22',
        evidence: 'esta semana estoy de viaje en Lima',
      },
    ]);
    expect(memory.facts['context.viaje']).toMatchObject({ text: 'De viaje en Lima esta semana', expiresAt: Date.UTC(2026, 10, 23) });
  });

  it('craving: "hoy no quiero pollo" gives no operations (and a food fact about today without expiry is rejected)', () => {
    const before = emptyMemory();
    expect(consolidate(before, ['hoy no quiero pollo'], []).memory.facts).toEqual({});

    const { accepted, rejected } = consolidate(before, ['hoy no quiero pollo'], [
      { op: 'create', key: 'food.pollo', category: 'food', text: 'No quiere pollo', stance: 'avoid', evidence: 'hoy no quiero pollo' },
    ]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([expect.objectContaining({ reason: 'one_day' })]);
  });

  it('forget: "olvida que no me gusta el atún" deletes food.atun', () => {
    const atun = fact('food.atun', 'No le gusta el atún', { foods: ['atun'], stance: 'avoid' });
    const { memory } = consolidate(withFacts(atun, panCuadrado), ['Olvida que no me gusta el atún'], [
      { op: 'delete', key: 'food.atun', evidence: 'olvida que no me gusta el atún' },
    ]);
    expect(Object.keys(memory.facts)).toEqual(['food.pan_cuadrado']);
  });

  it('made-up evidence: a quote that is not in the messages is rejected', () => {
    const { accepted, rejected } = consolidate(emptyMemory(), ['¿qué ceno hoy?'], [
      { op: 'create', key: 'food.brocoli', category: 'food', text: 'No le gusta el brócoli', evidence: 'no me gusta el brócoli' },
    ]);
    expect(accepted).toEqual([]);
    expect(rejected[0].reason).toBe('evidence_not_found');
  });

  it('invalid key: Food.Pan, or a category other than the prefix, is rejected', () => {
    const messages = ['no me gusta el pan'];
    const { accepted, rejected } = consolidate(emptyMemory(), messages, [
      { op: 'create', key: 'Food.Pan', category: 'food', text: 'No le gusta el pan', evidence: 'no me gusta el pan' },
      { op: 'create', key: 'food.pan', category: 'restriction', text: 'No le gusta el pan', evidence: 'no me gusta el pan' },
      { op: 'create', key: 'food.p', category: 'food', text: 'No le gusta el pan', evidence: 'no me gusta el pan' },
    ]);
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual(['invalid_key', 'category_mismatch', 'invalid_key']);
  });

  it('duplicate: create over an existing key is treated as update', () => {
    const { accepted, memory } = consolidate(withFacts(panCuadrado), ['de verdad no soporto el pan cuadrado'], [
      {
        op: 'create',
        key: 'food.pan_cuadrado',
        category: 'food',
        text: 'No soporta el pan cuadrado',
        stance: 'avoid',
        evidence: 'no soporto el pan cuadrado',
      },
    ]);
    expect(accepted[0].op).toBe('update');
    expect(memory.facts['food.pan_cuadrado'].previous?.text).toBe('No le gusta el pan cuadrado');
    expect(Object.keys(memory.facts)).toHaveLength(1);
  });
});

describe('validateMemoryOps', () => {
  it('update of a missing key becomes create; delete or confirm of a missing key is rejected', () => {
    const { accepted, rejected } = validateMemoryOps(
      [
        { op: 'update', key: 'goal.media_maraton', category: 'goal', text: 'Correr una media maratón en marzo', evidence: 'quiero correr una media maratón' },
        { op: 'delete', key: 'food.atun', evidence: 'quiero correr una media maratón' },
        { op: 'confirm', key: 'food.atun', evidence: 'quiero correr una media maratón' },
      ],
      emptyMemory(),
      ['Quiero correr una media maratón en marzo'],
      NOW,
    );
    expect(accepted.map((op) => op.op)).toEqual(['create']);
    expect(rejected.map((r) => r.reason)).toEqual(['unknown_key', 'unknown_key']);
  });

  it('two creates of the same new key: the second one is an update', () => {
    const op: MemoryOp = { op: 'create', key: 'injury.rodilla', category: 'injury', text: 'Le duele la rodilla derecha', evidence: 'me duele la rodilla' };
    const { accepted } = validateMemoryOps([op, { ...op, text: 'Molestia en la rodilla derecha' }], emptyMemory(), ['me duele la rodilla'], NOW);
    expect(accepted.map((o) => o.op)).toEqual(['create', 'update']);
  });

  it('matches the evidence without case, accents or punctuation, but not if it is too short', () => {
    const memory = withFacts(panCuadrado);
    const ok = validateMemoryOps([{ op: 'confirm', key: 'food.pan_cuadrado', evidence: 'SIGO sin comer PAN cuadrado' }], memory, ['¡Sigo sin comer pan cuadrado!'], NOW);
    expect(ok.accepted).toHaveLength(1);
    const short = validateMemoryOps([{ op: 'confirm', key: 'food.pan_cuadrado', evidence: 'sí' }], memory, ['sí'], NOW);
    expect(short.rejected[0].reason).toBe('evidence_not_found');
  });

  it('rejects texts over 120 characters, empty texts and expiries that are invalid or past', () => {
    const base = { op: 'create' as const, key: 'context.viaje', category: 'context' as const, evidence: 'estoy de viaje' };
    const { rejected } = validateMemoryOps(
      [
        { ...base, text: 'x'.repeat(121) },
        { ...base, text: '   ' },
        { ...base, text: 'De viaje', expiresAt: '2026-13-01' },
        { ...base, text: 'De viaje', expiresAt: '2026-11-16' },
      ],
      emptyMemory(),
      ['Estoy de viaje'],
      NOW,
    );
    expect(rejected.map((r) => r.reason)).toEqual(['invalid_text', 'invalid_text', 'invalid_expiry', 'invalid_expiry']);
  });

  it('accepts at most MAX_OPS_PER_SESSION operations and ignores garbage', () => {
    const ops: MemoryOp[] = Array.from({ length: MAX_OPS_PER_SESSION + 2 }, (_, i) => ({
      op: 'create',
      key: `goal.meta_${i}`,
      category: 'goal',
      text: `Meta ${i}`,
      evidence: 'mis metas',
    }));
    const garbage = [null, { op: 'merge', key: 'goal.x' }] as unknown as MemoryOp[];
    const { accepted, rejected } = validateMemoryOps([...garbage, ...ops], emptyMemory(), ['estas son mis metas'], NOW);
    expect(accepted).toHaveLength(MAX_OPS_PER_SESSION);
    expect(rejected.map((r) => r.reason)).toEqual(['invalid_op', 'invalid_op', 'too_many', 'too_many']);
  });

  it('normalizes foods: lowercase, no accents, no repeats or empties', () => {
    const { accepted } = validateMemoryOps(
      [{ op: 'create', key: 'allergy.mariscos', category: 'allergy', text: 'Alérgico a los mariscos', foods: ['Camarón', 'camaron', ' ', 'Langosta'], evidence: 'alérgica a los mariscos' }],
      emptyMemory(),
      ['Soy alérgica a los mariscos'],
      NOW,
    );
    expect(accepted[0]).toMatchObject({ foods: ['camaron', 'langosta'] });
  });
});

describe('applyMemoryOps', () => {
  it('confirm only moves lastConfirmedAt', () => {
    const memory = applyMemoryOps(withFacts(panCuadrado), [{ op: 'confirm', key: 'food.pan_cuadrado', evidence: 'sigo igual' }], LATER, 'chat');
    expect(memory.facts['food.pan_cuadrado']).toEqual({ ...panCuadrado, lastConfirmedAt: LATER });
  });

  it('applies the cap: the least confirmed food goes first, never an allergy or an injury', () => {
    const facts = [
      fact('allergy.mani', 'Alérgico al maní', { lastConfirmedAt: 1 }),
      fact('injury.rodilla', 'Rodilla derecha', { lastConfirmedAt: 2 }),
      fact('food.atun', 'No le gusta el atún', { lastConfirmedAt: 5 }),
      fact('goal.fuerza', 'Ganar fuerza', { lastConfirmedAt: 3 }),
    ];
    const op: MemoryOp = { op: 'create', key: 'food.brocoli', category: 'food', text: 'Le encanta el brócoli', evidence: 'me encanta el brocoli' };
    const memory = applyMemoryOps(withFacts(...facts), [op], NOW, 'chat', 4);
    expect(Object.keys(memory.facts).sort()).toEqual(['allergy.mani', 'food.brocoli', 'goal.fuerza', 'injury.rodilla']);
  });

  it('an update keeps the source the new text came from', () => {
    const planFact = fact('restriction.plan_sin_lacteos', 'Sin lácteos', { source: 'plan' });
    const memory = applyMemoryOps(
      withFacts(planFact),
      [{ op: 'update', key: 'restriction.plan_sin_lacteos', category: 'restriction', text: 'Ya toma lácteos deslactosados', evidence: 'x' }],
      NOW,
      'chat',
    );
    expect(memory.facts['restriction.plan_sin_lacteos'].source).toBe('chat');
  });
});
