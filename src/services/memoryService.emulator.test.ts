/**
 * @jest-environment node
 */
// Runs against the Firestore and Auth emulators: `npm run test:emulator` (needs Java). Excluded from `npm test`.
import { signInAnonymously, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  applyPlanRestrictions,
  deleteAllFacts,
  deleteFact,
  setMemoryEnabled,
  subscribeToMemory,
  updateFactText,
} from './memoryService';
import type { CoachMemory } from '../../functions/src/shared/memory/memory';

// jest.mock factories can't use imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../firebase', () => require('../test/emulatorFirebase'));

jest.setTimeout(30000);

let uid: string;
const memoryDoc = () => doc(db, `users/${uid}/coach/memory`);
const readMemory = async () => (await getDoc(memoryDoc())).data() as CoachMemory | undefined;

beforeAll(async () => {
  uid = (await signInAnonymously(auth)).user.uid;
});

afterAll(async () => {
  await signOut(auth);
  await terminate(db);
});

it('applyPlanRestrictions creates the memory with the plan facts, and a new plan replaces them', async () => {
  expect(await readMemory()).toBeUndefined();
  await applyPlanRestrictions(uid, ['Sin lácteos', 'Alergia al maní']);
  let memory = await readMemory();
  expect(memory?.enabled).toBe(true);
  expect(Object.keys(memory!.facts).sort()).toEqual(['restriction.plan_alergia_al_mani', 'restriction.plan_sin_lacteos']);
  expect(memory!.facts['restriction.plan_sin_lacteos']).toMatchObject({ source: 'plan', foods: ['lacteos'], stance: 'avoid' });

  await applyPlanRestrictions(uid, ['Sin gluten']);
  memory = await readMemory();
  expect(Object.keys(memory!.facts)).toEqual(['restriction.plan_sin_gluten']);
});

it('the owner edits, deletes and clears facts, and turns the memory off', async () => {
  // A fact from the chat (the Functions write it; the owner may too)
  await setDoc(
    memoryDoc(),
    {
      facts: {
        'food.atun': { key: 'food.atun', category: 'food', text: 'No le gusta el atún', source: 'chat', createdAt: 1, updatedAt: 1, lastConfirmedAt: 1 },
      },
    },
    { merge: true },
  );

  await updateFactText(uid, 'food.atun', 'Le encanta el atún');
  let memory = await readMemory();
  expect(memory!.facts['food.atun']).toMatchObject({ text: 'Le encanta el atún', source: 'app', previous: { text: 'No le gusta el atún' } });
  expect(memory!.facts['restriction.plan_sin_gluten']).toBeDefined();

  await deleteFact(uid, 'food.atun');
  expect(Object.keys((await readMemory())!.facts)).toEqual(['restriction.plan_sin_gluten']);

  await setMemoryEnabled(uid, false);
  await deleteAllFacts(uid);
  memory = await readMemory();
  expect(memory).toMatchObject({ enabled: false, facts: {} });
});

it('subscribeToMemory delivers the parsed memory', async () => {
  const received = await new Promise<CoachMemory>((resolve, reject) => {
    const unsubscribe = subscribeToMemory(
      uid,
      (memory) => {
        unsubscribe();
        resolve(memory);
      },
      reject,
    );
  });
  expect(received).toMatchObject({ enabled: false, facts: {} });
});

it("another user can neither read nor write someone else's memory", async () => {
  const ownerUid = uid;
  await signOut(auth);
  await signInAnonymously(auth);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(getDoc(doc(db, `users/${ownerUid}/coach/memory`))).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(setDoc(doc(db, `users/${ownerUid}/coach/memory`), { enabled: true })).rejects.toMatchObject({ code: 'permission-denied' });
  warnSpy.mockRestore();
});
