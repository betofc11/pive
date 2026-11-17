import { clearFacts, editFactText, removeFact } from './edit';
import { type CoachMemory, emptyMemory, type MemoryFact } from './memory';

const NOW = Date.UTC(2026, 10, 17, 15);
const fact = (key: string, text: string, extra: Partial<MemoryFact> = {}): MemoryFact => ({
  key,
  category: key.split('.')[0] as MemoryFact['category'],
  text,
  source: 'chat',
  createdAt: 1,
  updatedAt: 2,
  lastConfirmedAt: 2,
  ...extra,
});
const withFacts = (...facts: MemoryFact[]): CoachMemory => ({
  ...emptyMemory(),
  noticeSeenAt: 3,
  facts: Object.fromEntries(facts.map((f) => [f.key, f])),
});

const atun = fact('food.atun', 'No le gusta el atún', { foods: ['atun'], stance: 'avoid', evidence: 'no me gusta el atún' });
const lacteos = fact('restriction.plan_sin_lacteos', 'Sin lácteos', { foods: ['lacteos'], stance: 'avoid', source: 'plan' });
const mani = fact('allergy.mani', 'Alérgico al maní', { foods: ['mani'] });

describe('editFactText', () => {
  it('a food fact keeps its key and dates, saves the previous text and drops foods and stance', () => {
    const memory = editFactText(withFacts(atun), 'food.atun', '  Le encanta el atún en agua ', NOW);
    expect(memory.facts['food.atun']).toEqual({
      key: 'food.atun',
      category: 'food',
      text: 'Le encanta el atún en agua',
      source: 'app',
      createdAt: 1,
      updatedAt: NOW,
      lastConfirmedAt: NOW,
      previous: { text: 'No le gusta el atún', updatedAt: 2 },
    });
    expect(memory.noticeSeenAt).toBe(3);
  });

  it('a restriction from the plan becomes the user’s, with its foods read again', () => {
    const fact = editFactText(withFacts(lacteos), lacteos.key, 'Sin lácteos ni gluten', NOW).facts[lacteos.key];
    expect(fact).toMatchObject({ source: 'app', foods: ['lacteos', 'gluten'], stance: 'avoid' });
  });

  it('an allergy keeps its foods if the new text does not name any', () => {
    expect(editFactText(withFacts(mani), mani.key, 'Alérgico a los cacahuates', NOW).facts[mani.key].foods).toEqual(['cacahuates']);
    expect(editFactText(withFacts(mani), mani.key, 'Muy grave, lleva epinefrina', NOW).facts[mani.key].foods).toEqual(['mani']);
  });

  it('the same text changes nothing; an empty or too long text, or a missing key, throws', () => {
    const memory = withFacts(atun);
    expect(editFactText(memory, 'food.atun', 'No le gusta el atún', NOW)).toBe(memory);
    expect(() => editFactText(memory, 'food.atun', '  ', NOW)).toThrow();
    expect(() => editFactText(memory, 'food.atun', 'x'.repeat(121), NOW)).toThrow();
    expect(() => editFactText(memory, 'food.pan', 'Algo', NOW)).toThrow();
  });
});

describe('removeFact and clearFacts', () => {
  it('removes one fact, or all of them keeping the settings', () => {
    const memory = { ...withFacts(atun, mani), enabled: false };
    expect(Object.keys(removeFact(memory, 'food.atun', NOW).facts)).toEqual(['allergy.mani']);
    expect(removeFact(memory, 'food.pan', NOW)).toBe(memory);
    expect(clearFacts(memory, NOW)).toEqual({ enabled: false, noticeSeenAt: 3, facts: {}, updatedAt: NOW });
  });
});
