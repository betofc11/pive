// Pure part of the usage log: token counts, estimated cost and the date of the document.
// No Firebase or Gemini imports, so the root Jest can test it.

/** Each feature that calls the AI. Later phases add 'chat', 'memory', 'routine' and 'location'. */
export type UsageFeature = "advice" | "food" | "ingredients" | "nutritionPlan" | "bodyComposition" | "workoutPlan";

export interface FeatureUsage {
  calls: number;
  /** Every input token, cached ones included */
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  estCostUsd: number;
}

/** users/{uid}/usage/{YYYY-MM-DD}. Only the server writes it; the owner can read it. */
export interface DailyUsage {
  date: string; // YYYY-MM-DD
  updatedAt: number;
  features: Partial<Record<UsageFeature, FeatureUsage>>;
}

/** The fields we read from Gemini's `usageMetadata` (GenerateContentResponseUsageMetadata). */
export interface TokenUsageMetadata {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  toolUsePromptTokenCount?: number;
}

interface ModelPrice {
  /** USD per million tokens */
  input: number;
  cachedInput: number;
  /** Thinking tokens are billed as output */
  output: number;
}

/**
 * USD per million tokens, for text/image input up to the standard context size.
 * VERIFY THESE VALUES on the official pricing page (https://ai.google.dev/gemini-api/docs/pricing):
 * they come from secondary sources (docs/plans/pive-coach/diseno.md §9), and 3.8-flash's cached price is assumed
 * to be 10% of its input price, as on the other models.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  "gemini-3.5-flash-lite": { input: 0.3, cachedInput: 0.03, output: 2.5 },
  "gemini-3.8-flash": { input: 0.75, cachedInput: 0.075, output: 3.75 },
};

const count = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

/** What one call adds to a feature's counters. Without metadata (a call that doesn't use the AI) it only counts the call. */
export function featureUsageDelta(usage: TokenUsageMetadata | undefined, model: string | undefined): FeatureUsage {
  const inputTokens = count(usage?.promptTokenCount) + count(usage?.toolUsePromptTokenCount);
  const cachedTokens = Math.min(count(usage?.cachedContentTokenCount), inputTokens);
  const outputTokens = count(usage?.candidatesTokenCount);
  const thinkingTokens = count(usage?.thoughtsTokenCount);

  const price = model ? MODEL_PRICES[model] : undefined;
  const estCostUsd = price
    ? ((inputTokens - cachedTokens) * price.input + cachedTokens * price.cachedInput + (outputTokens + thinkingTokens) * price.output) / 1_000_000
    : 0;

  return { calls: 1, inputTokens, cachedTokens, outputTokens, thinkingTokens, estCostUsd };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const utcDateString = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Date of the usage document: the user's local date if it is valid and within one day of the UTC date
 * (time zones go from UTC-12 to UTC+14), otherwise the UTC date. A client can't pick an arbitrary day.
 */
export function resolveUsageDate(localDate: unknown, now: number = Date.now()): string {
  const utcToday = utcDateString(now);
  if (typeof localDate !== "string") return utcToday;
  const match = DATE_RE.exec(localDate);
  if (!match) return utcToday;

  const [, y, m, d] = match.map(Number);
  const asUtc = Date.UTC(y, m - 1, d);
  // Rejects dates like 2026-02-30, which Date.UTC would roll over to March
  if (utcDateString(asUtc) !== localDate) return utcToday;
  if (Math.abs(asUtc - Date.parse(utcToday)) > DAY_MS) return utcToday;
  return localDate;
}
