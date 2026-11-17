// The anti-junk filter (diseno §4.4) and applying what passes it. Every operation the model proposes is checked
// in code before it touches the memory: the evidence is the most important check.
// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.
import { dateKeyToUtcMs } from '../dates';
import {
  type CoachMemory,
  categoryOfKey,
  DAY_MS,
  DEFAULT_MAX_FACTS,
  isMemoryCategory,
  MAX_FACT_TEXT,
  type MemoryCategory,
  type MemoryFact,
  type MemoryOp,
  normalizeText,
} from './memory';

/** More than this in one conversation is the model going off the rails */
export const MAX_OPS_PER_SESSION = 20;
const MIN_EVIDENCE_CHARS = 4;
const MAX_FOODS = 10;
const MAX_FOOD_CHARS = 60;

/** For matching quotes: normalized and without punctuation ("¡No me gusta el pan!" → "no me gusta el pan") */
const forMatch = (s: string) =>
  normalizeText(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** An allergy is only saved if the user said it in so many words (diseno §4.3, rule 6) */
const EXPLICIT_ALLERGY_RE = /alergi|alergic|intoleran|celiac|anafila|no tolero/;
/** "hoy no quiero pollo" is a craving, not a dislike: a food fact about today needs an expiry */
const ONE_DAY_RE = /\b(hoy|ahorita|esta noche)\b/;

export type RejectReason =
  | 'invalid_op'
  | 'too_many'
  | 'evidence_not_found'
  | 'invalid_key'
  | 'category_mismatch'
  | 'invalid_text'
  | 'invalid_expiry'
  | 'allergy_not_explicit'
  | 'one_day'
  | 'unknown_key';

const cleanFoods = (foods: unknown): string[] | undefined => {
  if (!Array.isArray(foods)) return undefined;
  const clean = [
    ...new Set(
      foods
        .filter((f): f is string => typeof f === 'string')
        .map(normalizeText)
        .filter((f) => f.length > 0 && f.length <= MAX_FOOD_CHARS),
    ),
  ].slice(0, MAX_FOODS);
  return clean.length > 0 ? clean : undefined;
};

/** End of a 'YYYY-MM-DD' day (UTC), or null if it's not a valid date */
const endOfDayMs = (dateKey: string) => {
  const ms = dateKeyToUtcMs(dateKey);
  return ms === null ? null : ms + DAY_MS;
};

/**
 * Checks the operations the model proposed against the memory and what the user actually wrote.
 * - The evidence must appear in one of the user's messages (no case, accents or punctuation).
 * - The key is `category.topic` (MEMORY_KEY_RE) and its prefix is the operation's category.
 * - The text has 1–120 characters; an expiry is a valid date that hasn't passed.
 * - create over an existing key → update; update of a missing key → create; delete or confirm of a missing key
 *   → rejected.
 * - An allergy needs explicit evidence ("soy alérgico…"), and a food fact about today needs an expiry.
 * Accepted operations come back normalized (trimmed text, normalized foods) and in order.
 */
export function validateMemoryOps(
  ops: MemoryOp[],
  memory: CoachMemory,
  userMessages: string[],
  now: number,
): { accepted: MemoryOp[]; rejected: Array<{ op: MemoryOp; reason: RejectReason }> } {
  const messages = userMessages.filter((m) => typeof m === 'string').map(forMatch);
  const keys = new Set(Object.keys(memory.facts));
  const accepted: MemoryOp[] = [];
  const rejected: Array<{ op: MemoryOp; reason: RejectReason }> = [];
  const reject = (op: MemoryOp, reason: RejectReason) => rejected.push({ op, reason });

  for (const op of Array.isArray(ops) ? ops : []) {
    if (!op || typeof op !== 'object' || !['create', 'update', 'delete', 'confirm'].includes(op.op)) {
      reject(op, 'invalid_op');
      continue;
    }
    if (accepted.length >= MAX_OPS_PER_SESSION) {
      reject(op, 'too_many');
      continue;
    }

    const evidence = typeof op.evidence === 'string' ? forMatch(op.evidence) : '';
    if (evidence.length < MIN_EVIDENCE_CHARS || !messages.some((m) => m.includes(evidence))) {
      reject(op, 'evidence_not_found');
      continue;
    }

    const keyCategory = categoryOfKey(op.key);
    if (!keyCategory) {
      reject(op, 'invalid_key');
      continue;
    }

    if (op.op === 'delete' || op.op === 'confirm') {
      if (!keys.has(op.key)) {
        reject(op, 'unknown_key');
        continue;
      }
      if (op.op === 'delete') keys.delete(op.key);
      accepted.push({ op: op.op, key: op.key, evidence: op.evidence.trim() });
      continue;
    }

    // create or update (the model's output can have any shape: nothing is trusted)
    const write = op as Extract<MemoryOp, { op: 'create' | 'update' }>;
    if (!isMemoryCategory(write.category) || write.category !== keyCategory) {
      reject(op, 'category_mismatch');
      continue;
    }
    const text = typeof write.text === 'string' ? write.text.trim() : '';
    if (!text || text.length > MAX_FACT_TEXT) {
      reject(op, 'invalid_text');
      continue;
    }
    let expiresAt: string | null = null;
    if (write.expiresAt !== undefined && write.expiresAt !== null) {
      const end = typeof write.expiresAt === 'string' ? endOfDayMs(write.expiresAt) : null;
      if (end === null || end <= now) {
        reject(op, 'invalid_expiry');
        continue;
      }
      expiresAt = write.expiresAt;
    }
    if (write.category === 'allergy' && !EXPLICIT_ALLERGY_RE.test(evidence)) {
      reject(op, 'allergy_not_explicit');
      continue;
    }
    if (write.category === 'food' && !expiresAt && ONE_DAY_RE.test(evidence)) {
      reject(op, 'one_day');
      continue;
    }

    const normalized: Extract<MemoryOp, { op: 'create' | 'update' }> = {
      op: keys.has(write.key) ? 'update' : 'create',
      key: write.key,
      category: write.category,
      text,
      evidence: write.evidence.trim(),
    };
    const foods = cleanFoods(write.foods);
    if (foods) normalized.foods = foods;
    if (write.stance === 'avoid' || write.stance === 'prefer') normalized.stance = write.stance;
    if (expiresAt) normalized.expiresAt = expiresAt;
    keys.add(op.key);
    accepted.push(normalized);
  }

  return { accepted, rejected };
}

// ---------------------------------------------------------------------------------------------------------------
// The cap per plan: least important and least confirmed first; never allergies, injuries or the plan's own
// restrictions.

/** Lower goes first. null = never removed by the cap */
function evictionTier(fact: MemoryFact): number | null {
  switch (fact.category) {
    case 'food':
    case 'schedule':
    case 'equipment':
      return 0;
    case 'context':
    case 'goal':
      return 1;
    case 'restriction':
      return fact.source === 'plan' ? null : 2;
    default:
      return null;
  }
}

/** Removes facts until there are `maxFacts` (if it can). Returns the removed keys; `facts` is changed in place. */
export function enforceCap(facts: Record<string, MemoryFact>, maxFacts: number): string[] {
  const excess = Object.keys(facts).length - Math.max(0, maxFacts);
  if (excess <= 0) return [];
  const candidates = Object.values(facts)
    .map((fact) => ({ fact, tier: evictionTier(fact) }))
    .filter((c): c is { fact: MemoryFact; tier: number } => c.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.fact.lastConfirmedAt - b.fact.lastConfirmedAt ||
        a.fact.updatedAt - b.fact.updatedAt ||
        a.fact.key.localeCompare(b.fact.key),
    );
  const removed = candidates.slice(0, excess).map((c) => c.fact.key);
  for (const key of removed) delete facts[key];
  return removed;
}

// ---------------------------------------------------------------------------------------------------------------

function factFromOp(
  op: Extract<MemoryOp, { op: 'create' | 'update' }>,
  category: MemoryCategory,
  now: number,
  source: MemoryFact['source'],
): MemoryFact {
  const fact: MemoryFact = {
    key: op.key,
    category,
    text: op.text.trim().slice(0, MAX_FACT_TEXT),
    source,
    evidence: op.evidence,
    createdAt: now,
    updatedAt: now,
    lastConfirmedAt: now,
  };
  const foods = cleanFoods(op.foods);
  if (foods) fact.foods = foods;
  if (op.stance) fact.stance = op.stance;
  const expiresAt = op.expiresAt ? endOfDayMs(op.expiresAt) : null;
  if (expiresAt !== null) fact.expiresAt = expiresAt;
  return fact;
}

/**
 * Applies operations that already passed validateMemoryOps. An update keeps the creation date and saves the
 * previous text in `previous` (only the last one). Then the cap is applied.
 */
export function applyMemoryOps(
  memory: CoachMemory,
  ops: MemoryOp[],
  now: number,
  source: MemoryFact['source'],
  maxFacts: number = DEFAULT_MAX_FACTS,
): CoachMemory {
  const facts: Record<string, MemoryFact> = { ...memory.facts };

  for (const op of ops) {
    const current = facts[op.key];
    if (op.op === 'create' || op.op === 'update') {
      const category = categoryOfKey(op.key);
      if (!category) continue;
      const next = factFromOp(op, category, now, source);
      if (current) {
        next.createdAt = current.createdAt;
        if (current.text !== next.text) next.previous = { text: current.text, updatedAt: current.updatedAt };
        else if (current.previous) next.previous = current.previous;
      }
      facts[op.key] = next;
    } else if (op.op === 'delete') {
      delete facts[op.key];
    } else if (current) {
      facts[op.key] = { ...current, lastConfirmedAt: now };
    }
  }

  enforceCap(facts, maxFacts);
  return { ...memory, facts, updatedAt: now };
}
