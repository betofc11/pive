// Pive's memory of each user: durable facts that change the advice, keyed by topic (an address book, not a diary).
// Lives in users/{uid}/coach/memory. Shared by the app and the Cloud Functions: pure TypeScript, no imports from
// npm, React Native or Node.

export const MEMORY_CATEGORIES = ['allergy', 'restriction', 'food', 'injury', 'schedule', 'equipment', 'goal', 'context'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/** One fact's label, as the prompt and the app show it */
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  allergy: 'Alergia',
  restriction: 'Restricción',
  food: 'Alimento',
  injury: 'Lesión',
  schedule: 'Horario',
  equipment: 'Equipo',
  goal: 'Objetivo',
  context: 'Contexto',
};

/** "category.topic", the topic in snake_case: "food.pan_cuadrado" */
export const MEMORY_KEY_RE = /^(allergy|restriction|food|injury|schedule|equipment|goal|context)\.[a-z0-9_]{2,40}$/;

export const MAX_FACT_TEXT = 120;

export interface MemoryFact {
  key: string;
  category: MemoryCategory;
  /** ≤ 120 characters, as Pive says it ("No le gusta el pan cuadrado") */
  text: string;
  /** Normalized foods the fact talks about (normalizeText), to filter complements in code */
  foods?: string[];
  stance?: 'avoid' | 'prefer';
  source: 'chat' | 'plan' | 'app';
  /** The user's own words it came from */
  evidence?: string;
  createdAt: number;
  updatedAt: number;
  lastConfirmedAt: number;
  expiresAt?: number;
  previous?: { text: string; updatedAt: number };
}

export interface CoachMemory {
  /** If the document doesn't exist, the memory is { enabled: true, facts: {} } */
  enabled: boolean;
  /** When the user saw the notice that Pive remembers things (phase 3, first chat) */
  noticeSeenAt?: number;
  facts: Record<string, MemoryFact>;
  updatedAt: number;
}

/** What the model proposes when it consolidates a conversation. `expiresAt` is a 'YYYY-MM-DD' date */
export type MemoryOp =
  | {
      op: 'create' | 'update';
      key: string;
      category: MemoryCategory;
      text: string;
      foods?: string[];
      stance?: 'avoid' | 'prefer';
      expiresAt?: string | null;
      evidence: string;
    }
  | { op: 'delete' | 'confirm'; key: string; evidence: string };

/** Beta's limit. From phase 3 on, it comes from PLAN_LIMITS[tier].memoryFacts */
export const DEFAULT_MAX_FACTS = 40;
/** Food, schedule and equipment facts not confirmed in this long go to "to confirm" */
export const STALE_AFTER_DAYS = 180;
/** …and if nobody confirms them in this many more days, they're removed */
export const CONFIRM_GRACE_DAYS = 30;
/** Injuries are reviewed sooner (diseno §4.5: 4–6 weeks), but never removed on their own */
export const INJURY_REVIEW_DAYS = 42;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const isMemoryCategory = (value: unknown): value is MemoryCategory =>
  typeof value === 'string' && (MEMORY_CATEGORIES as readonly string[]).includes(value);

/** The category a key starts with ("food.pan" → 'food'), or null if the key is not valid */
export function categoryOfKey(key: unknown): MemoryCategory | null {
  if (typeof key !== 'string' || !MEMORY_KEY_RE.test(key)) return null;
  return key.slice(0, key.indexOf('.')) as MemoryCategory;
}

/** Lowercase, no accents, whitespace collapsed: "  Alérgico   al MANÍ " → "alergico al mani" */
export function normalizeText(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const emptyMemory = (): CoachMemory => ({ enabled: true, facts: {}, updatedAt: 0 });

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parseFact(key: string, raw: unknown): MemoryFact | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const category = categoryOfKey(key);
  if (!category || typeof f.text !== 'string' || !f.text.trim()) return null;

  const updatedAt = isNumber(f.updatedAt) ? f.updatedAt : 0;
  const fact: MemoryFact = {
    key,
    category,
    text: f.text.trim(),
    source: f.source === 'plan' || f.source === 'app' ? f.source : 'chat',
    createdAt: isNumber(f.createdAt) ? f.createdAt : updatedAt,
    updatedAt,
    lastConfirmedAt: isNumber(f.lastConfirmedAt) ? f.lastConfirmedAt : updatedAt,
  };
  if (Array.isArray(f.foods)) {
    const foods = f.foods.filter((food): food is string => typeof food === 'string' && food.trim() !== '');
    if (foods.length > 0) fact.foods = foods;
  }
  if (f.stance === 'avoid' || f.stance === 'prefer') fact.stance = f.stance;
  if (typeof f.evidence === 'string' && f.evidence) fact.evidence = f.evidence;
  if (isNumber(f.expiresAt)) fact.expiresAt = f.expiresAt;
  const previous = f.previous as Record<string, unknown> | undefined;
  if (previous && typeof previous.text === 'string' && isNumber(previous.updatedAt)) {
    fact.previous = { text: previous.text, updatedAt: previous.updatedAt };
  }
  return fact;
}

/**
 * The memory document as Firestore returns it (or undefined if it doesn't exist), checked field by field.
 * Facts that don't make sense (bad key or no text) are dropped.
 */
export function parseCoachMemory(raw: unknown): CoachMemory {
  if (!raw || typeof raw !== 'object') return emptyMemory();
  const doc = raw as Record<string, unknown>;
  const facts: Record<string, MemoryFact> = {};
  if (doc.facts && typeof doc.facts === 'object') {
    for (const [key, value] of Object.entries(doc.facts as Record<string, unknown>)) {
      const fact = parseFact(key, value);
      if (fact) facts[key] = fact;
    }
  }
  const memory: CoachMemory = { enabled: doc.enabled !== false, facts, updatedAt: isNumber(doc.updatedAt) ? doc.updatedAt : 0 };
  if (isNumber(doc.noticeSeenAt)) memory.noticeSeenAt = doc.noticeSeenAt;
  return memory;
}
