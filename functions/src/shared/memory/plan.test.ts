import { replacePlanFacts, restrictionFoods } from './plan';
import { type CoachMemory, emptyMemory, MEMORY_KEY_RE, type MemoryFact } from './memory';

const NOW = Date.UTC(2026, 10, 17, 15);

const chatFact: MemoryFact = {
  key: 'food.pan_cuadrado',
  category: 'food',
  text: 'No le gusta el pan cuadrado',
  source: 'chat',
  createdAt: 1,
  updatedAt: 1,
  lastConfirmedAt: 1,
};

describe('replacePlanFacts', () => {
  it('creates restriction.plan_<slug> for each restriction, with its foods and stance avoid', () => {
    const memory = replacePlanFacts(emptyMemory(), ['Sin lácteos', 'Alergia al maní', '  '], NOW);
    expect(memory.facts).toEqual({
      'restriction.plan_sin_lacteos': {
        key: 'restriction.plan_sin_lacteos',
        category: 'restriction',
        text: 'Sin lácteos',
        foods: ['lacteos'],
        stance: 'avoid',
        source: 'plan',
        createdAt: NOW,
        updatedAt: NOW,
        lastConfirmedAt: NOW,
      },
      'restriction.plan_alergia_al_mani': expect.objectContaining({ text: 'Alergia al maní', foods: ['mani'], source: 'plan' }),
    });
    expect(memory.updatedAt).toBe(NOW);
  });

  it('a new plan deletes the old plan’s facts and leaves the chat’s alone', () => {
    const first = replacePlanFacts({ ...emptyMemory(), facts: { [chatFact.key]: chatFact } }, ['Sin lácteos'], NOW);
    const second = replacePlanFacts(first, ['Sin gluten'], NOW + 1);
    expect(Object.keys(second.facts).sort()).toEqual(['food.pan_cuadrado', 'restriction.plan_sin_gluten']);
    expect(second.facts['food.pan_cuadrado']).toBe(chatFact);
    // A plan without restrictions only clears
    expect(Object.keys(replacePlanFacts(second, [], NOW + 2).facts)).toEqual(['food.pan_cuadrado']);
  });

  it('keys are always valid: long texts are cut, symbols-only texts get a number, repeats get a suffix', () => {
    const long = 'Evitar los embutidos procesados como salchichas, jamón y mortadela por su alto contenido de sodio';
    const memory: CoachMemory = replacePlanFacts(emptyMemory(), [long, long, '¡¡!!'], NOW);
    const keys = Object.keys(memory.facts);
    expect(keys).toHaveLength(3);
    keys.forEach((key) => expect(key).toMatch(MEMORY_KEY_RE));
    expect(keys).toContain('restriction.plan_3');
  });
});

describe('restrictionFoods', () => {
  it.each([
    ['Sin lácteos', ['lacteos']],
    ['No comer cerdo ni mariscos', ['cerdo', 'mariscos']],
    ['Evitar el azúcar y las harinas', ['azucar', 'harinas']],
    ['Alergia al maní', ['mani']],
    ['Intolerancia a la lactosa', ['lactosa']],
    ['Vegetariana', ['vegetariana']],
    ['Comer cada 3 horas', []],
  ])('%s → %j', (restriction, foods) => {
    expect(restrictionFoods(restriction)).toEqual(foods);
  });
});
