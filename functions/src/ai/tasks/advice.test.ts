import { ADVICE_INSTRUCTION, buildAdviceProposal, parseAdviceChoice, prepareDayAdvice } from './advice';
import { PIVE_CORE } from '../prompts/core';
import { NUTRITION_RULES } from '../prompts/nutrition';
import { sumMacros } from '../../shared/macros';

const m = (calories: number, protein: number, carbs: number, fats: number) => ({ calories, protein, carbs, fats });

const riceAndBeef = {
  title: 'Arroz con carne molida',
  ingredients: [
    { name: 'Arroz blanco cocido', quantity: 100, unit: 'g', macros: m(130, 3, 28, 0) },
    { name: 'Carne molida', quantity: 120, unit: 'g', macros: m(370, 32, 0, 24) },
  ],
  macros: m(500, 35, 28, 24),
};
const chickenAndPotato = {
  title: 'Pollo con papa',
  ingredients: [
    { name: 'Pechuga de pollo', quantity: 120, unit: 'g', macros: m(198, 37, 0, 4) },
    { name: 'Papa cocida', quantity: 150, unit: 'g', macros: m(131, 3, 30, 0) },
  ],
};
const plan = {
  name: 'Plan',
  restrictions: ['Sin lácteos enteros', ''],
  meals: [
    { type: 'Desayuno', slot: 'breakfast', options: [{ title: 'Huevos con queso', ingredients: [{ name: 'Queso tierno', quantity: 40, unit: 'g', macros: m(120, 7, 1, 9) }] }] },
    { type: 'Almuerzo', slot: 'lunch', options: [chickenAndPotato, riceAndBeef] },
    { type: 'Cena', slot: 'dinner', options: [{ title: 'Pescado con arroz', macros: m(450, 35, 40, 12) }] },
    { type: 'Snack nocturno', slot: 'dinner', options: [{ title: 'Yogur', macros: m(150, 12, 10, 3) }] },
  ],
};
const profile = { macroGoals: m(2000, 150, 200, 60), nutritionalPlan: plan, bodyMetrics: { weight: 80 } };

// 11:50 in Costa Rica (UTC-6) is 17:50 UTC
const nowMs = Date.UTC(2026, 10, 13, 17, 50);
const breakfast = { id: 'a', name: 'Avena con banano', time: '2026-11-13T13:30:00.000Z', macros: m(380, 22, 50, 10), imageUrl: 'data:image/jpeg;base64,AAAA' };

const prepare = (overrides: Partial<Parameters<typeof prepareDayAdvice>[0]> = {}) =>
  prepareDayAdvice({ profile, log: { meals: [breakfast] }, localDate: '2026-11-13', localTime: '11:50', nowMs, ...overrides })!;

it('the instruction starts with the shared core and the nutrition rules, in that order (for the cache)', () => {
  expect(ADVICE_INSTRUCTION.startsWith(`${PIVE_CORE}\n\n${NUTRITION_RULES}\n\n`)).toBe(true);
  expect(PIVE_CORE).toContain('# El plan primero');
});

describe('prepareDayAdvice', () => {
  it('builds the day from Firestore: local times, inferred slots, budgets and the plan for the next slot', () => {
    const prep = prepare();
    expect(prep.next).toBe('lunch');
    expect(prep.options).toEqual([chickenAndPotato, riceAndBeef]);
    expect(prep.fits?.map((f) => f.title).sort()).toEqual(['Arroz con carne molida', 'Pollo con papa']);

    expect(prep.contents).toContain('RESTRICCIONES DE SU PLAN: Sin lácteos enteros\n');
    expect(prep.contents).toContain('COMIDAS DE HOY (viernes, ahora 11:50):');
    // The old meal without a slot, at its local time, inferred as breakfast
    expect(prep.contents).toContain('- Desayuno ✓ 380 kcal');
    expect(prep.contents).toContain('  · 07:30 Avena con banano');
    expect(prep.contents).toContain('TU PLAN PARA EL ALMUERZO (de mejor a peor ajuste):');
    expect(prep.contents).toContain('Pollo con papa — Pechuga de pollo 120 g + Papa cocida 150 g →');
    // Nothing the model doesn't need: no photo, no body metrics
    expect(prep.contents).not.toMatch(/base64|peso|80 kg/i);
  });

  it('with two plan categories in the slot, fits the main one with its share of the budget', () => {
    const meals = [
      { ...breakfast, slot: 'breakfast' },
      { id: 'b', name: 'Casado', time: '2026-11-13T18:30:00.000Z', slot: 'lunch', macros: m(700, 40, 80, 20) },
      { id: 'c', name: 'Fruta', time: '2026-11-13T22:00:00.000Z', slot: 'afternoon_snack', macros: m(150, 2, 35, 1) },
    ];
    const prep = prepare({ log: { meals }, localTime: '19:00', nowMs: Date.UTC(2026, 10, 14, 1, 0) });
    expect(prep.next).toBe('dinner');
    expect(prep.options.map((o) => o.title)).toEqual(['Pescado con arroz']);
    // 770 kcal left, all for dinner; Cena gets 450 / 600 of it
    expect(prep.fits?.[0].gap.calories).toBe(Math.round(770 * 0.75) - 450);
    expect(prep.contents).toContain('TU PLAN PARA LA CENA');
  });

  it('says there is no plan for the slot when the plan lacks it, or without a plan', () => {
    // The user's own slots include lunch, but the plan only has breakfast
    const dayStructure = {
      source: 'user',
      slots: [
        { slot: 'breakfast', weight: 30, window: { start: '06:00', end: '09:00' } },
        { slot: 'lunch', weight: 40, window: { start: '12:00', end: '14:00' } },
        { slot: 'dinner', weight: 30, window: { start: '19:00', end: '21:00' } },
      ],
    };
    const noLunch = { ...profile, dayStructure, nutritionalPlan: { ...plan, meals: [plan.meals[0]] } };
    const prep = prepare({ profile: noLunch });
    expect(prep.fits).toBeNull();
    expect(prep.contents).toContain('SIN PLAN PARA EL ALMUERZO');
    expect(prepare({ profile: { macroGoals: profile.macroGoals } }).contents).not.toContain('RESTRICCIONES');
  });

  it('tolerates any data: no log, broken meals, a device clock that is way off', () => {
    expect(prepare({ log: null }).next).toBe('lunch');
    const broken = { meals: [null, { name: 'Sin macros' }, { ...breakfast, time: 'nope' }, 'x'] };
    expect(() => prepare({ log: broken as never })).not.toThrow();
    const offClock = prepare({ nowMs: nowMs + 3 * 24 * 3600 * 1000 });
    expect(offClock.next).toBe('lunch');
  });

  it('is null without macro goals', () => {
    expect(prepareDayAdvice({ profile: {}, log: null, localDate: '2026-11-13', localTime: '11:50', nowMs })).toBeNull();
    expect(prepareDayAdvice({ profile: undefined, log: null, localDate: '2026-11-13', localTime: '11:50', nowMs })).toBeNull();
  });
});

describe('parseAdviceChoice', () => {
  const prep = prepare();
  const fits = prep.fits!;
  const addIndex = fits.findIndex((f) => f.verdict === 'add') + 1;
  const json = (value: object) => JSON.stringify(value);

  it('takes the 1-based numbers of the context as indexes', () => {
    const choice = parseAdviceChoice(json({ text: ' Haz tu opción. ', optionIndex: addIndex, complementIndex: 1, reductionIndex: null }), fits);
    expect(choice).toEqual({ text: 'Haz tu opción.', fit: fits[addIndex - 1], complementIndex: 0, reductionIndex: null });
  });

  it('turns numbers out of range, or not whole, into null', () => {
    expect(parseAdviceChoice(json({ text: 'x', optionIndex: 9, complementIndex: 1 }), fits)).toMatchObject({ fit: null, complementIndex: null });
    expect(parseAdviceChoice(json({ text: 'x', optionIndex: 0 }), fits).fit).toBeNull();
    expect(parseAdviceChoice(json({ text: 'x', optionIndex: 1.5 }), fits).fit).toBeNull();
    expect(parseAdviceChoice(json({ text: 'x', optionIndex: addIndex, complementIndex: 99 }), fits).complementIndex).toBeNull();
    expect(parseAdviceChoice(json({ text: 'x', optionIndex: '1' }), fits).fit).toBeNull();
  });

  it('keeps only the adjustment the option needs', () => {
    const choice = parseAdviceChoice(json({ text: 'x', optionIndex: addIndex, complementIndex: 1, reductionIndex: 1 }), fits);
    expect(choice.reductionIndex).toBeNull();
    expect(choice.complementIndex).toBe(0);
  });

  it('without a plan or with an answer that is not JSON, there is no choice', () => {
    expect(parseAdviceChoice(json({ text: 'Come proteína.', optionIndex: 1 }), null)).toEqual({ text: 'Come proteína.', fit: null, complementIndex: null, reductionIndex: null });
    expect(parseAdviceChoice('Solo texto', fits)).toEqual({ text: 'Solo texto', fit: null, complementIndex: null, reductionIndex: null });
    expect(parseAdviceChoice(undefined, fits).text).toBe('');
  });
});

describe('buildAdviceProposal', () => {
  const prep = prepare();
  const fits = prep.fits!;

  it('builds the exact meal of the chosen option and complement, for the next slot', () => {
    const optionNumber = fits.findIndex((f) => f.title === 'Arroz con carne molida') + 1;
    const fit = fits[optionNumber - 1];
    expect(fit.verdict).toBe('add');
    const choice = parseAdviceChoice(JSON.stringify({ text: 'x', optionIndex: optionNumber, complementIndex: 1, reductionIndex: null }), fits);
    const proposal = buildAdviceProposal(prep, choice)!;

    expect(proposal.slot).toBe('lunch');
    expect(proposal.name).toBe(`Arroz con carne molida + ${fit.complements[0].name.toLowerCase()}`);
    expect(proposal.macros).toEqual(sumMacros([fit.macros, fit.complements[0].adds]));
    expect(proposal.ingredients.map((i) => i.name)).toEqual(['Arroz blanco cocido', 'Carne molida', fit.complements[0].name]);
  });

  it('is null when no option was chosen', () => {
    expect(buildAdviceProposal(prep, parseAdviceChoice(JSON.stringify({ text: 'x', optionIndex: null }), fits))).toBeNull();
  });
});
