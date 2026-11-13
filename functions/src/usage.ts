import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firestore";
import { featureUsageDelta, resolveUsageDate, type TokenUsageMetadata, type UsageFeature } from "./usageCost";

export type { DailyUsage, FeatureUsage, UsageFeature } from "./usageCost";

/**
 * Adds one call of `feature` to users/{uid}/usage/{YYYY-MM-DD}: tokens and estimated cost.
 * Pass `response.usageMetadata` and the model of the Gemini call; without them it only counts the call.
 * Never throws: a failure here must not break the response, so it is only logged.
 */
export async function recordUsage(
  uid: string,
  feature: UsageFeature,
  usageMetadata?: TokenUsageMetadata,
  model?: string,
  localDate?: unknown
): Promise<void> {
  try {
    const date = resolveUsageDate(localDate);
    const delta = featureUsageDelta(usageMetadata, model);
    const increments = Object.fromEntries(Object.entries(delta).map(([field, value]) => [field, FieldValue.increment(value)]));

    // merge: true merges the nested maps, so the other features and counters stay as they are
    await db.doc(`users/${uid}/usage/${date}`).set({ date, updatedAt: Date.now(), features: { [feature]: increments } }, { merge: true });
  } catch (error) {
    console.error(`recordUsage failed (${feature}):`, error);
  }
}
