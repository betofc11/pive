/**
 * @jest-environment node
 */
// Runs against the Firestore and Auth emulators: `npm run test:emulator` (needs Java). Excluded from `npm test`.
// recordUsage writes with the Admin SDK (as in production); the app's client SDK checks firestore.rules.
import { signInAnonymously, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import { auth, db as clientDb } from '../../src/test/emulatorFirebase';

// The Admin SDK reads the project from the environment; it must be set before ./usage initializes the app
process.env.GCLOUD_PROJECT ??= 'demo-pive';
/* eslint-disable @typescript-eslint/no-require-imports */
const { recordUsage } = require('./usage') as typeof import('./usage');
const { db: adminDb } = require('./firestore') as typeof import('./firestore');
/* eslint-enable @typescript-eslint/no-require-imports */

jest.setTimeout(30000);

const today = new Date().toISOString().slice(0, 10);
let ownerUid: string;

beforeAll(async () => {
  ownerUid = (await signInAnonymously(auth)).user.uid;
});

afterAll(async () => {
  await signOut(auth);
  await terminate(clientDb);
  await adminDb.terminate();
});

it('recordUsage adds up calls, tokens and cost per feature in the day document', async () => {
  const usage = { promptTokenCount: 1000, cachedContentTokenCount: 200, candidatesTokenCount: 100, thoughtsTokenCount: 50 };
  await recordUsage(ownerUid, 'food', usage, 'gemini-3.5-flash-lite', today);
  await recordUsage(ownerUid, 'food', usage, 'gemini-3.5-flash-lite', today);
  await recordUsage(ownerUid, 'advice', { promptTokenCount: 300, candidatesTokenCount: 40 }, 'gemini-3.5-flash-lite', today);

  const data = (await adminDb.doc(`users/${ownerUid}/usage/${today}`).get()).data()!;
  expect(data.date).toBe(today);
  expect(typeof data.updatedAt).toBe('number');
  expect(data.features.food).toMatchObject({ calls: 2, inputTokens: 2000, cachedTokens: 400, outputTokens: 200, thinkingTokens: 100 });
  expect(data.features.food.estCostUsd).toBeGreaterThan(0);
  expect(data.features.advice).toMatchObject({ calls: 1, inputTokens: 300, outputTokens: 40 });
});

it('recordUsage never throws: a failed write is only logged', async () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  // A uid with a slash makes an invalid document path
  await expect(recordUsage('bad/uid', 'food')).resolves.toBeUndefined();
  expect(errorSpy).toHaveBeenCalled();
  errorSpy.mockRestore();
});

it('the owner can read their usage but cannot write it', async () => {
  const ref = doc(clientDb, `users/${ownerUid}/usage/${today}`);
  expect((await getDoc(ref)).data()?.features.food.calls).toBe(2);

  // The SDK logs each rejected write as a warning; here they're expected
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(setDoc(ref, { features: {} })).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(setDoc(doc(clientDb, `users/${ownerUid}/usage/2026-01-01`), { date: '2026-01-01' })).rejects.toMatchObject({
    code: 'permission-denied',
  });
  warnSpy.mockRestore();
});

it("another user cannot read someone else's usage", async () => {
  await signOut(auth);
  await signInAnonymously(auth);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(getDoc(doc(clientDb, `users/${ownerUid}/usage/${today}`))).rejects.toMatchObject({ code: 'permission-denied' });
  warnSpy.mockRestore();
});
