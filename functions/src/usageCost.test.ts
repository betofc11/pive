import { featureUsageDelta, MODEL_PRICES, resolveUsageDate } from './usageCost';

describe('featureUsageDelta', () => {
  it('counts tokens and estimates the cost with the model price', () => {
    const delta = featureUsageDelta(
      { promptTokenCount: 1_000_000, cachedContentTokenCount: 400_000, candidatesTokenCount: 100_000, thoughtsTokenCount: 50_000 },
      'gemini-3.5-flash-lite',
    );
    const price = MODEL_PRICES['gemini-3.5-flash-lite'];
    expect(delta).toEqual({
      calls: 1,
      inputTokens: 1_000_000,
      cachedTokens: 400_000,
      outputTokens: 100_000,
      thinkingTokens: 50_000,
      estCostUsd: expect.any(Number),
    });
    expect(delta.estCostUsd).toBeCloseTo(0.6 * price.input + 0.4 * price.cachedInput + 0.15 * price.output, 10);
  });

  it('adds tool-use prompt tokens to the input', () => {
    expect(featureUsageDelta({ promptTokenCount: 100, toolUsePromptTokenCount: 20 }, 'gemini-3.8-flash').inputTokens).toBe(120);
  });

  it('only counts the call when there is no metadata', () => {
    expect(featureUsageDelta(undefined, undefined)).toEqual({
      calls: 1,
      inputTokens: 0,
      cachedTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      estCostUsd: 0,
    });
  });

  it('counts tokens but no cost for a model without a price', () => {
    const delta = featureUsageDelta({ promptTokenCount: 500, candidatesTokenCount: 50 }, 'gemini-unknown');
    expect(delta.inputTokens).toBe(500);
    expect(delta.estCostUsd).toBe(0);
  });

  it('ignores negative or invalid counts', () => {
    const delta = featureUsageDelta({ promptTokenCount: -5, candidatesTokenCount: NaN, cachedContentTokenCount: 10 }, 'gemini-3.8-flash');
    expect(delta).toMatchObject({ inputTokens: 0, cachedTokens: 0, outputTokens: 0, estCostUsd: 0 });
  });
});

describe('resolveUsageDate', () => {
  // 2026-11-13 03:00 UTC: still the 12th in the Americas
  const now = Date.UTC(2026, 10, 13, 3, 0);

  it('uses the local date when it is within a day of the UTC date', () => {
    expect(resolveUsageDate('2026-11-12', now)).toBe('2026-11-12');
    expect(resolveUsageDate('2026-11-13', now)).toBe('2026-11-13');
    expect(resolveUsageDate('2026-11-14', now)).toBe('2026-11-14');
  });

  it.each([undefined, null, 42, '', '13/11/2026', '2026-11-10', '2026-11-16', '2026-02-30', '2026-13-01'])(
    'falls back to the UTC date for %p',
    (localDate) => {
      expect(resolveUsageDate(localDate, now)).toBe('2026-11-13');
    },
  );
});
