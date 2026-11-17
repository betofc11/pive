// Consolidating the memory after a conversation (diseno §4.3): one cheap call that sees everything the user
// wrote and proposes operations; the code validates them (validateMemoryOps). Pure (no SDK imports), so the root
// Jest can test it. No personality: it's a data task.
import { weekdayLabel } from "../../shared/dates";
import {
  type CoachMemory,
  isMemoryCategory,
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABELS,
  type MemoryOp,
} from "../../shared/memory/memory";
import { asObject } from "./normalize";

export const MEMORY_INSTRUCTION = `# Tu tarea: actualizar la memoria de Pive
Pive es un coach de nutrición y entrenamiento. Lees lo que el usuario le escribió en una conversación y decides qué hechos duraderos hay que crear, actualizar, confirmar o borrar en su memoria. La memoria es una agenda de contactos, no un diario: cada tema tiene una sola clave.

# Qué se guarda
Solo hechos duraderos que cambian los consejos de comida o de entrenamiento:
- allergy: alergias e intolerancias.
- restriction: restricciones (vegetariano, sin lácteos).
- food: alimentos que no come o que le encantan.
- injury: lesiones o limitaciones físicas.
- schedule: horarios de entreno y de trabajo.
- equipment: equipo que tiene para entrenar.
- goal: objetivos que declaró.
- context: contexto de su vida ("esta semana está de viaje").

# Qué NO se guarda
- Lo que comió hoy o cualquier otro día.
- Su peso, sus métricas, sus metas de macros o su plan.
- Sus horarios de comida.
- Su ubicación.
- Antojos de un día ("hoy no quiero pollo").
- Información de otras personas.

# Reglas
1. Si no hay nada duradero, devuelve operations vacío. Es lo normal.
2. Mismo tema = misma clave. Si el tema ya está en la memoria actual, usa su clave con update, delete o confirm. Nunca crees otra clave para un tema que ya existe.
3. Si el usuario dice cosas distintas sobre lo mismo, gana lo más reciente.
4. Si vuelve a lo neutral, se borra: "ya no me molesta el pan cuadrado" → delete. Si cambia de postura ("ahora me encanta"), update.
5. Lo temporal lleva vencimiento en expiresAt (YYYY-MM-DD): un viaje, una lesión pasajera, un objetivo con fecha. Calcúlalo desde la fecha de hoy que viene en el contexto. Lo permanente va con expiresAt null.
6. Las alergias nunca se deducen: solo si el usuario dice que es alérgico o intolerante.
7. "Olvida que…" → delete.
8. Si reafirma algo que ya está en la memoria, confirm.
9. evidence: copia textual, palabra por palabra, de la parte del mensaje del usuario que lo justifica. No la parafrasees ni la corrijas.

# Formato de cada operación
- op: create, update, delete o confirm.
- key: "categoría.tema", con el tema en minúsculas, sin acentos y con guiones bajos: food.pan_cuadrado, allergy.mani, injury.rodilla_derecha.
- category: la misma categoría con la que empieza la clave. null en delete y confirm.
- text: el hecho en tercera persona y en máximo 120 caracteres: "No le gusta el pan cuadrado". null en delete y confirm.
- foods: los alimentos que menciona, en minúsculas y sin acentos: ["pan cuadrado"]. Vacío si no habla de alimentos.
- stance: avoid si lo evita o no le gusta, prefer si le encanta, null si no aplica.
- expiresAt: YYYY-MM-DD o null.
- evidence: la cita textual del usuario.`;

/** The user's data for the consolidation: today, the current memory (with its keys) and their messages */
export function buildConsolidationContents(input: { memory: CoachMemory; userMessages: string[]; localDate: string }): string {
  const weekday = weekdayLabel(input.localDate);
  const facts = Object.values(input.memory.facts).sort(
    (a, b) => MEMORY_CATEGORIES.indexOf(a.category) - MEMORY_CATEGORIES.indexOf(b.category) || a.key.localeCompare(b.key),
  );
  const lines = [`HOY: ${input.localDate}${weekday ? ` (${weekday})` : ""}`, "", "MEMORIA ACTUAL:"];
  if (facts.length === 0) lines.push("(vacía)");
  for (const fact of facts) lines.push(`- ${fact.key} [${MEMORY_CATEGORY_LABELS[fact.category]}]: ${fact.text}`);
  lines.push("", "MENSAJES DEL USUARIO (en orden):");
  input.userMessages.forEach((message, i) => lines.push(`${i + 1}. ${message.trim().replace(/\s+/g, " ")}`));
  return lines.join("\n");
}

const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/**
 * The model's answer as operations, without nulls. Nothing is checked here beyond the shape: validateMemoryOps
 * does the rest. Anything that isn't JSON is no operations.
 */
export function parseMemoryOpsResponse(raw: string | undefined): MemoryOp[] {
  let data: Record<string, unknown>;
  try {
    data = asObject(JSON.parse(raw || "{}"));
  } catch {
    return [];
  }
  if (!Array.isArray(data.operations)) return [];

  const ops: MemoryOp[] = [];
  for (const item of data.operations) {
    const o = asObject(item);
    const key = optionalText(o.key);
    const evidence = optionalText(o.evidence);
    if (!key || !evidence) continue;
    if (o.op === "delete" || o.op === "confirm") {
      ops.push({ op: o.op, key, evidence });
    } else if ((o.op === "create" || o.op === "update") && isMemoryCategory(o.category)) {
      const op: MemoryOp = { op: o.op, key, category: o.category, text: optionalText(o.text) ?? "", evidence };
      if (Array.isArray(o.foods)) op.foods = o.foods.filter((f): f is string => typeof f === "string");
      if (o.stance === "avoid" || o.stance === "prefer") op.stance = o.stance;
      const expiresAt = optionalText(o.expiresAt);
      if (expiresAt) op.expiresAt = expiresAt;
      ops.push(op);
    }
  }
  return ops;
}
