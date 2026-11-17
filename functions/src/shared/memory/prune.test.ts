import { pruneMemory } from './prune';
import { type CoachMemory, DAY_MS, emptyMemory, type MemoryFact } from './memory';

const NOW = Date.UTC(2026, 10, 17, 15);
const daysAgo = (days: number) => NOW - days * DAY_MS;

const fact = (key: string, extra: Partial<MemoryFact> = {}): MemoryFact => ({
  key,
  category: key.split('.')[0] as MemoryFact['category'],
  text: key,
  source: 'chat',
  createdAt: daysAgo(1),
  updatedAt: daysAgo(1),
  lastConfirmedAt: daysAgo(1),
  ...extra,
});
const withFacts = (...facts: MemoryFact[]): CoachMemory => ({ ...emptyMemory(), facts: Object.fromEntries(facts.map((f) => [f.key, f])) });

describe('pruneMemory', () => {
  it('removes expired facts', () => {
    const memory = withFacts(fact('context.viaje', { expiresAt: NOW - 1 }), fact('context.mudanza', { expiresAt: NOW + DAY_MS }));
    const result = pruneMemory(memory, NOW, 40);
    expect(result.removed).toEqual(['context.viaje']);
    expect(Object.keys(result.memory.facts)).toEqual(['context.mudanza']);
    expect(result.memory.updatedAt).toBe(NOW);
  });

  it('with nothing to remove, returns the same memory', () => {
    const memory = withFacts(fact('food.atun'));
    const result = pruneMemory(memory, NOW, 40);
    expect(result).toEqual({ memory, removed: [], toConfirm: [] });
    expect(result.memory).toBe(memory);
  });

  it('cap of 40 with 41 facts: removes the least confirmed food, never an allergy or an injury', () => {
    const facts: MemoryFact[] = [
      // The oldest ones, but protected
      fact('allergy.mani', { lastConfirmedAt: daysAgo(400) }),
      fact('injury.rodilla', { lastConfirmedAt: daysAgo(30) }),
      fact('food.atun', { lastConfirmedAt: daysAgo(20) }),
      fact('food.brocoli', { lastConfirmedAt: daysAgo(10) }),
    ];
    for (let i = 0; i < 37; i++) facts.push(fact(`goal.meta_${i}`, { lastConfirmedAt: daysAgo(90) }));
    expect(facts).toHaveLength(41);

    const result = pruneMemory(withFacts(...facts), NOW, 40);
    expect(result.removed).toEqual(['food.atun']);
    expect(Object.keys(result.memory.facts)).toHaveLength(40);
    expect(result.memory.facts['allergy.mani']).toBeDefined();
    expect(result.memory.facts['injury.rodilla']).toBeDefined();
  });

  it('never goes below the protected facts, even over the cap', () => {
    const memory = withFacts(fact('allergy.mani'), fact('injury.rodilla'), fact('restriction.plan_sin_lacteos', { source: 'plan' }));
    expect(pruneMemory(memory, NOW, 1).removed).toEqual([]);
  });

  it('at 181 days, food, schedule and equipment facts go to toConfirm; after the grace period, they are removed', () => {
    const memory = withFacts(
      fact('food.atun', { lastConfirmedAt: daysAgo(181) }),
      fact('schedule.entreno', { lastConfirmedAt: daysAgo(179) }),
      fact('equipment.mancuernas', { lastConfirmedAt: daysAgo(200) }),
      fact('goal.fuerza', { lastConfirmedAt: daysAgo(400) }),
      fact('food.pan', { lastConfirmedAt: daysAgo(211) }),
    );
    const result = pruneMemory(memory, NOW, 40);
    expect(result.toConfirm).toEqual(['equipment.mancuernas', 'food.atun']);
    expect(result.removed).toEqual(['food.pan']);
  });

  it('injuries are reviewed after 6 weeks, but not removed', () => {
    const result = pruneMemory(withFacts(fact('injury.rodilla', { lastConfirmedAt: daysAgo(400) })), NOW, 40);
    expect(result.toConfirm).toEqual(['injury.rodilla']);
    expect(result.removed).toEqual([]);
  });
});
