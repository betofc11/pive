import { LEGACY_ADVICE_INSTRUCTION, buildLegacyAdviceContents } from './adviceLegacy';
import { PIVE_CORE } from '../prompts/core';
import { NUTRITION_RULES } from '../prompts/nutrition';

const goals = { calories: 2000, protein: 150, carbs: 200, fats: 60 };
const dailyMacros = { calories: 2100.4, protein: 90.6, carbs: 120, fats: 70 };

it('the instruction starts with the shared core and the nutrition rules, in that order (for the cache)', () => {
  expect(LEGACY_ADVICE_INSTRUCTION.startsWith(`${PIVE_CORE}\n\n${NUTRITION_RULES}\n\n`)).toBe(true);
});

describe('buildLegacyAdviceContents (TODO(fase-3): remove with the old route)', () => {
  it('includes the date with its weekday, the time, and the numbers already calculated and rounded', () => {
    const text = buildLegacyAdviceContents({
      dailyMacros,
      goals,
      currentTime: '13:30 (1:30 PM)',
      localDate: '2026-11-13',
      meals: [{ name: 'Avena con plátano', time: '08:10', macros: { calories: 420.2, protein: 15, carbs: 70, fats: 9 } }],
    });

    expect(text).toContain('Fecha del usuario: viernes 2026-11-13');
    expect(text).toContain('Hora actual del usuario: 13:30 (1:30 PM)');
    expect(text).toContain('Meta diaria: 2000 kcal · proteína 150 g · carbohidratos 200 g · grasa 60 g');
    expect(text).toContain('Consumido hoy: 2100 kcal · proteína 91 g · carbohidratos 120 g · grasa 70 g');
    // Over on calories and fat: those stay at 0, never negative
    expect(text).toContain('Le falta hoy: 0 kcal · proteína 59 g · carbohidratos 80 g · grasa 0 g');
    expect(text).toContain('- 08:10 · Avena con plátano · 420 kcal · proteína 15 g · carbohidratos 70 g · grasa 9 g');
  });

  it('never mentions body metrics, even if an old client sends them', () => {
    const text = buildLegacyAdviceContents({ dailyMacros, goals, bodyMetrics: { weight: 80 } } as never);
    expect(text).not.toMatch(/peso|grasa corporal|métricas/i);
  });

  it('tolerates missing or malformed data from older clients', () => {
    const text = buildLegacyAdviceContents({ localDate: '13/11/2026', meals: 'nope' });
    expect(text).not.toContain('Fecha del usuario');
    expect(text).toContain('Hora actual del usuario: No provista');
    expect(text).toContain('Meta diaria: 0 kcal');
    expect(text).toContain('Comidas registradas hoy:\n- Ninguna todavía');
  });
});
