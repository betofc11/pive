/**
 * @jest-environment node
 */
// Runs against the Firestore emulator: `npm run test:emulator` (needs Java). Excluded from `npm test`.
// The Admin SDK reads the project from the environment; it must be set before ./store initializes the app
process.env.GCLOUD_PROJECT ??= 'demo-pive';
/* eslint-disable @typescript-eslint/no-require-imports */
const { deleteMemoryFacts, loadActiveMemory, memoryDoc } = require('./store') as typeof import('./store');
const { db } = require('../firestore') as typeof import('../firestore');
/* eslint-enable @typescript-eslint/no-require-imports */

jest.setTimeout(30000);

const NOW = Date.UTC(2026, 10, 17, 15);
const DAY = 24 * 60 * 60 * 1000;
const fact = (key: string, extra: Record<string, unknown> = {}) => ({
  key,
  category: key.split('.')[0],
  text: key,
  source: 'chat',
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
  lastConfirmedAt: NOW - DAY,
  ...extra,
});

afterAll(async () => {
  await db.terminate();
});

it('loadActiveMemory leaves out and deletes expired facts, keeping the rest and the settings', async () => {
  const uid = 'store-user-1';
  await memoryDoc(uid).set({
    enabled: true,
    noticeSeenAt: 5,
    updatedAt: NOW - DAY,
    facts: {
      'allergy.mani': fact('allergy.mani'),
      'context.viaje': fact('context.viaje', { expiresAt: NOW - 1 }),
      'food.pan': fact('food.pan', { lastConfirmedAt: NOW - 300 * DAY }),
    },
  });

  const memory = await loadActiveMemory(uid, NOW);
  expect(Object.keys(memory!.facts)).toEqual(['allergy.mani']);

  const stored = (await memoryDoc(uid).get()).data()!;
  expect(Object.keys(stored.facts)).toEqual(['allergy.mani']);
  expect(stored.noticeSeenAt).toBe(5);
});

it('loadActiveMemory is null with the memory off, and an empty memory without a document', async () => {
  await memoryDoc('store-user-2').set({ enabled: false, facts: { 'allergy.mani': fact('allergy.mani') } });
  expect(await loadActiveMemory('store-user-2', NOW)).toBeNull();
  expect(await loadActiveMemory('store-user-3', NOW)).toEqual({ enabled: true, facts: {}, updatedAt: 0 });
});

it('deleteMemoryFacts deletes keys with dots one by one and ignores missing ones', async () => {
  const uid = 'store-user-4';
  await memoryDoc(uid).set({ enabled: true, facts: { 'food.atun': fact('food.atun'), 'food.pan': fact('food.pan') } });
  await deleteMemoryFacts(uid, ['food.atun', 'food.no_existe']);
  const stored = (await memoryDoc(uid).get()).data()!;
  expect(Object.keys(stored.facts)).toEqual(['food.pan']);
});
