// The user's day as the AI sees it: slots, budgets and the plan options already fitted.
// Pure (no SDK imports), so the root Jest can test it. Every number comes calculated: the model doesn't do math.
import type { Macros } from "../../shared/macros";
import type { computeSlotStatuses, SlotStatus } from "../../shared/meals/budget";
import type { PlanOptionFit } from "../../shared/meals/planFit";
import { MEAL_SLOT_LABELS, type MealSlot, type PlannedSlot } from "../../shared/meals/slots";

const WITH_ARTICLE: Record<PlannedSlot, string> = {
  breakfast: "EL DESAYUNO",
  morning_snack: "LA MERIENDA AM",
  lunch: "EL ALMUERZO",
  afternoon_snack: "LA MERIENDA PM",
  dinner: "LA CENA",
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** "380 kcal · P 22 · C 45 · G 12" */
export const formatMacrosShort = (m: Macros) => `${m.calories} kcal · P ${m.protein} · C ${m.carbs} · G ${m.fats}`;

/** "+100 kcal · P +10 · C -5 · G 0" */
const formatSigned = (m: Macros) => `${signed(m.calories)} kcal · P ${signed(m.protein)} · C ${signed(m.carbs)} · G ${signed(m.fats)}`;

function formatSlot(status: SlotStatus, meals: Array<{ time: string; name: string; macros: Macros }>): string[] {
  const label = MEAL_SLOT_LABELS[status.slot];
  const lines: string[] = [];
  switch (status.state) {
    case "logged":
      lines.push(`- ${label} ✓ ${formatMacrosShort(status.consumed)}`);
      break;
    case "missed":
      lines.push(`- ${label} · sin registrar, ya pasó su horario`);
      break;
    case "next":
    case "pending": {
      const parts = [`- ${label}`, status.state === "next" ? "PRÓXIMA" : "pendiente"];
      if (status.isLastOfDay) parts.push("última del día");
      if (status.budget) parts.push(`presupuesto ~${formatMacrosShort(status.budget)}`);
      if (status.light) parts.push("ligera: ya no queda presupuesto del día, prioriza proteína y verduras");
      lines.push(parts.join(" · "));
      break;
    }
  }
  for (const meal of meals) lines.push(`  · ${meal.time} ${meal.name} · ${formatMacrosShort(meal.macros)}`);
  return lines;
}

function formatFit(fit: PlanOptionFit, position: number, ingredients?: string): string[] {
  const lines = [`Opción ${position}: ${fit.title}${ingredients ? ` — ${ingredients}` : ""} → ${formatMacrosShort(fit.macros)}`];
  const gap = `brecha (presupuesto − opción): ${formatSigned(fit.gap)}`;
  if (fit.verdict === "as_is") {
    lines.push(`  Encaja tal cual (${gap}).`);
  } else if (fit.verdict === "add") {
    lines.push(`  Le falta: ${gap}`);
    if (fit.complements.length === 0) {
      lines.push("  Ningún complemento encaja: recomiéndala tal cual.");
    } else {
      lines.push("  Complementos (elige uno):");
      fit.complements.forEach((c, i) => {
        const amount = c.pieces ? `${c.pieces.count} × ${c.pieces.label} (~${c.grams} ${c.unit})` : `${c.grams} ${c.unit}`;
        const origin = c.fromPlan ? " (está en tu plan)" : "";
        lines.push(`  ${i + 1}) ${c.name} ${amount} → ${formatSigned(c.adds)}${origin}`);
      });
    }
  } else {
    lines.push(`  Se pasa: ${gap}`);
    if (fit.reductions.length === 0) {
      lines.push("  Ninguna porción se puede reducir: recomiéndala tal cual.");
    } else {
      lines.push("  Reducciones (elige una):");
      fit.reductions.forEach((r, i) => {
        const removes = formatSigned({
          calories: -r.removes.calories,
          protein: -r.removes.protein,
          carbs: -r.removes.carbs,
          fats: -r.removes.fats,
        });
        lines.push(`  ${i + 1}) ${r.name} de ${r.fromQuantity} ${r.unit} a ${r.toQuantity} ${r.unit} → ${removes}`);
      });
    }
  }
  return lines;
}

/**
 * The day for the advice and the chat. The plan's options are numbered from 1 in the order given (best fit
 * first), and so are their complements and reductions: the model answers with those numbers.
 * `ingredientsByOption` (optional) describes each option's ingredients, by optionIndex.
 */
export function formatDayContext(input: {
  weekday: string;
  now: string;
  statuses: ReturnType<typeof computeSlotStatuses>;
  dayMeals: Array<{ slot: MealSlot; time: string; name: string; macros: Macros }>;
  /** null if the plan has nothing for that slot (or there's no plan) */
  nextSlotFits: PlanOptionFit[] | null;
  ingredientsByOption?: Record<number, string>;
}): string {
  const { statuses, dayMeals, nextSlotFits } = input;
  const lines = [`COMIDAS DE HOY (${input.weekday}, ahora ${input.now}):`];

  const inStructure = new Set<MealSlot>(statuses.slots.map((s) => s.slot));
  for (const status of statuses.slots) {
    lines.push(...formatSlot(status, dayMeals.filter((m) => m.slot === status.slot)));
  }
  const extras = dayMeals.filter((m) => !inStructure.has(m.slot));
  if (extras.length > 0) {
    lines.push(`- ${MEAL_SLOT_LABELS.extra} (fuera de sus tiempos) · ${formatMacrosShort(statuses.extras)}`);
    for (const meal of extras) lines.push(`  · ${meal.time} ${meal.name} · ${formatMacrosShort(meal.macros)}`);
  }

  const { remaining } = statuses;
  const over = remaining.calories < 0 || remaining.protein < 0 || remaining.carbs < 0 || remaining.fats < 0;
  lines.push(`RESTANTE DEL DÍA: ${formatMacrosShort(remaining)}${over ? " (negativo = ya se pasó)" : ""}`);

  const next = statuses.next;
  lines.push("");
  if (!next) {
    lines.push("No quedan tiempos pendientes hoy.");
  } else if (nextSlotFits === null) {
    lines.push(`SIN PLAN PARA ${WITH_ARTICLE[next]}: recomienda algo general que respete su presupuesto.`);
  } else if (nextSlotFits.length === 0) {
    lines.push(`TU PLAN PARA ${WITH_ARTICLE[next]}: sus opciones no tienen macros para calcular; recomienda algo general que respete su presupuesto.`);
  } else {
    lines.push(`TU PLAN PARA ${WITH_ARTICLE[next]} (de mejor a peor ajuste):`);
    nextSlotFits.forEach((fit, i) => lines.push(...formatFit(fit, i + 1, input.ingredientsByOption?.[fit.optionIndex])));
  }
  return lines.join("\n");
}
