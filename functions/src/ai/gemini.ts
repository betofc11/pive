import { ApiError, GenerateContentParameters, GoogleGenAI } from "@google/genai";
import type { Response } from "../http";

// gemini-2.5-flash and gemini-2.5-pro were deprecated on 2026-11-02 and are shut down on 2026-12-01.
// These are the successors Google itself reroutes them to.
export const MODELS = {
  // Short calls: advice, a food photo, a list of ingredients
  light: "gemini-3.5-flash-lite",
  // Long structured extraction from PDFs and images: nutrition plans, body composition, workout plans
  heavy: "gemini-3.8-flash",
} as const;
export type GeminiModel = (typeof MODELS)[keyof typeof MODELS];

const getApiKey = (): string | null => {
  return process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
};

/** The Gemini client, or null after answering 500 if the key is not configured. */
export const requireAi = (res: Response): GoogleGenAI | null => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: "Gemini API Key is not configured." });
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GEMINI_MAX_ATTEMPTS = 3;

// 429 (rate limit / quota) and 503 (model overloaded) are usually transient on Gemini's side
const isTransientGeminiError = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return error.status === 429 || error.status === 503;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(message);
};

// Calls Gemini, retrying transient errors with a linear backoff (1s, 2s) before giving up
export const generateContentWithRetry = async (ai: GoogleGenAI, params: GenerateContentParameters) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error) {
      if (attempt >= GEMINI_MAX_ATTEMPTS || !isTransientGeminiError(error)) throw error;
      const backoffMs = attempt * 1000;
      console.warn(`Gemini transient error (attempt ${attempt}/${GEMINI_MAX_ATTEMPTS}), retrying in ${backoffMs}ms:`, error);
      await sleep(backoffMs);
    }
  }
};
