import { formatDayContext } from './day';
import { computeSlotStatuses } from '../../shared/meals/budget';
import { COMPLEMENTS } from '../../shared/meals/complements';
import { DEFAULT_DAY_STRUCTURE } from '../../shared/meals/dayStructure';
import { fitPlanOptions } from '../../shared/meals/planFit';
import type { MealSlot } from '../../shared/meals/slots';

const m = (calories: number, protein: number, carbs: number, fats: number) => ({ calories, protein, carbs, fats });
const goals = m(2000, 150, 200, 60);

const dayMeals = [
  { slot: 'breakfast' as MealSlot, time: '07:30', name: 'Avena con banano', macros: m(380, 22, 50, 10) },
  { slot: 'extra' as MealSlot, time: '10:00', name: 'Galletas', macros: m(150, 2, 20, 7) },
];
const statuses = computeSlotStatuses({ now: '11:50', isToday: true, structure: DEFAULT_DAY_STRUCTURE, goals, meals: dayMeals });

const riceAndBeef = {
  title: 'Arroz con carne molida',
  ingredients: [
    { name: 'Arroz blanco cocido', quantity: 100, unit: 'g', macros: m(130, 3, 28, 0) },
    { name: 'Carne molida', quantity: 120, unit: 'g', macros: m(370, 32, 0, 24) },
  ],
};
const lunchBudget = statuses.slots.find((s) => s.slot === 'lunch')!.budget!;
// The budget of diseno.md §3.8, where the plan's fresh cheese fits
const fits = fitPlanOptions({
  options: [riceAndBeef],
  budget: m(600, 45, 60, 25),
  planFoods: [{ name: 'Queso tierno', quantity: 40, unit: 'g', macros: m(120, 7, 1, 9) }],
  complements: COMPLEMENTS,
});

it('shows the day by slot, what is left, and the plan for the next slot with numbered choices', () => {
  const text = formatDayContext({
    weekday: 'martes',
    now: '11:50',
    statuses,
    dayMeals,
    nextSlotFits: fits,
    ingredientsByOption: { 0: 'Arroz blanco cocido 100 g + Carne molida 120 g' },
  });
  expect(text).toBe(
    [
      'COMIDAS DE HOY (martes, ahora 11:50):',
      '- Desayuno ✓ 380 kcal · P 22 · C 50 · G 10',
      '  · 07:30 Avena con banano · 380 kcal · P 22 · C 50 · G 10',
      '- Almuerzo · PRÓXIMA · presupuesto ~686 kcal · P 59 · C 61 · G 20',
      '- Merienda PM · pendiente · presupuesto ~196 kcal · P 17 · C 17 · G 6',
      '- Cena · pendiente · última del día · presupuesto ~588 kcal · P 50 · C 52 · G 17',
      '- Snack (fuera de sus tiempos) · 150 kcal · P 2 · C 20 · G 7',
      '  · 10:00 Galletas · 150 kcal · P 2 · C 20 · G 7',
      'RESTANTE DEL DÍA: 1470 kcal · P 126 · C 130 · G 43',
      '',
      'TU PLAN PARA EL ALMUERZO (de mejor a peor ajuste):',
      'Opción 1: Arroz con carne molida — Arroz blanco cocido 100 g + Carne molida 120 g → 500 kcal · P 35 · C 28 · G 24',
      '  Le falta: brecha (presupuesto − opción): +100 kcal · P +10 · C +32 · G +1',
      '  Complementos (elige uno):',
      '  1) Queso tierno 40 g → +120 kcal · P +7 · C +1 · G +9 (está en tu plan)',
      '  2) Queso cottage 125 g → +101 kcal · P +13 · C +6 · G +3',
      '  3) Jamón de pavo 90 g → +99 kcal · P +15 · C +3 · G +3',
    ].join('\n'),
  );
});

it('says when an option fits as it is or goes over, with its reductions', () => {
  const big = { ...riceAndBeef, ingredients: [{ ...riceAndBeef.ingredients[0], quantity: 300, macros: m(390, 9, 84, 1) }, riceAndBeef.ingredients[1]] };
  const [over] = fitPlanOptions({ options: [big], budget: lunchBudget, planFoods: [], complements: COMPLEMENTS });
  const [asIs] = fitPlanOptions({ options: [riceAndBeef], budget: m(520, 37, 30, 24), planFoods: [], complements: COMPLEMENTS });
  const text = formatDayContext({ weekday: 'martes', now: '11:50', statuses, dayMeals, nextSlotFits: [over, asIs] });
  expect(text).toContain('Opción 1: Arroz con carne molida → 760 kcal · P 41 · C 84 · G 25\n  Se pasa: brecha (presupuesto − opción): -74 kcal');
  expect(text).toContain('  Reducciones (elige una):\n  1) Arroz blanco cocido de 300 g a 240 g → -78 kcal · P -2 · C -17 · G 0');
  expect(text).toContain('Opción 2: Arroz con carne molida → 500 kcal · P 35 · C 28 · G 24\n  Encaja tal cual (brecha (presupuesto − opción): +20 kcal · P +2 · C +2 · G 0).');
});

it('without a plan for the next slot, or without slots left, says so', () => {
  expect(formatDayContext({ weekday: 'martes', now: '11:50', statuses, dayMeals, nextSlotFits: null })).toContain(
    'SIN PLAN PARA EL ALMUERZO: recomienda algo general que respete su presupuesto.',
  );
  expect(formatDayContext({ weekday: 'martes', now: '11:50', statuses, dayMeals, nextSlotFits: [] })).toContain(
    'TU PLAN PARA EL ALMUERZO: sus opciones no tienen macros',
  );

  const done = computeSlotStatuses({
    now: '21:00',
    isToday: true,
    structure: DEFAULT_DAY_STRUCTURE,
    goals,
    meals: DEFAULT_DAY_STRUCTURE.slots.map((s) => ({ slot: s.slot, macros: m(600, 40, 60, 20) })),
  });
  const text = formatDayContext({ weekday: 'martes', now: '21:00', statuses: done, dayMeals: [], nextSlotFits: null });
  expect(text).toContain('RESTANTE DEL DÍA: -400 kcal · P -10 · C -40 · G -20 (negativo = ya se pasó)');
  expect(text).toContain('No quedan tiempos pendientes hoy.');
});

it('marks missed slots and light ones', () => {
  // 50 g of protein left: 13 (12.5) for the snack and 38 (37.5) for dinner
  const late = computeSlotStatuses({
    now: '16:30',
    isToday: true,
    structure: DEFAULT_DAY_STRUCTURE,
    goals,
    meals: [{ slot: 'lunch', macros: m(2100, 100, 200, 80) }],
  });
  const text = formatDayContext({ weekday: 'martes', now: '16:30', statuses: late, dayMeals: [], nextSlotFits: null });
  expect(text).toContain('- Desayuno · sin registrar, ya pasó su horario');
  expect(text).toContain('- Merienda PM · PRÓXIMA · presupuesto ~0 kcal · P 13 · C 0 · G 0 · ligera: ya no queda presupuesto del día, prioriza proteína y verduras');
});
