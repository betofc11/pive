// The user's memory as the AI sees it (diseno §4.8). Pure (no SDK imports), so the root Jest can test it.
import { type CoachMemory, MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS } from "../../shared/memory/memory";
import { pruneMemory } from "../../shared/memory/prune";

const shortDate = (ms: number) => {
  const d = new Date(ms - 1); // expiresAt is the end of the day: the day itself is the one before
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * The lines of the memory for the prompt, allergies first. Empty if the memory is off or has no facts.
 * Expired facts are left out; old ones are marked "por confirmar", so Pive can ask about them.
 */
export function formatMemoryContext(memory: CoachMemory | null | undefined, now: number): string {
  if (!memory || !memory.enabled) return "";
  const facts = Object.values(memory.facts).filter((f) => f.expiresAt === undefined || f.expiresAt > now);
  if (facts.length === 0) return "";

  const toConfirm = new Set(pruneMemory(memory, now, Number.POSITIVE_INFINITY).toConfirm);
  const order = (category: string) => MEMORY_CATEGORIES.indexOf(category as (typeof MEMORY_CATEGORIES)[number]);
  facts.sort((a, b) => order(a.category) - order(b.category) || a.key.localeCompare(b.key));

  const lines = ["MEMORIA DEL USUARIO (respétala; las alergias son absolutas):"];
  for (const fact of facts) {
    const notes: string[] = [];
    if (fact.source === "plan") notes.push("de su plan");
    if (fact.expiresAt !== undefined) notes.push(`hasta el ${shortDate(fact.expiresAt)}`);
    if (toConfirm.has(fact.key)) notes.push("por confirmar");
    lines.push(`- [${MEMORY_CATEGORY_LABELS[fact.category]}] ${fact.text}${notes.length ? ` (${notes.join(", ")})` : ""}`);
  }
  return lines.join("\n");
}
