import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { type CoachMemory, parseCoachMemory } from '../../functions/src/shared/memory/memory';
import { clearFacts, editFactText, removeFact } from '../../functions/src/shared/memory/edit';
import { replacePlanFacts } from '../../functions/src/shared/memory/plan';

// Pive's memory: users/{uid}/coach/memory. The owner reads and writes it; the Functions add what the chat learns.
// Every change that reads the facts goes in a transaction, so it never steps on a write from the server.

const memoryRef = (uid: string) => doc(db, 'users', uid, 'coach', 'memory');

/** Calls `onChange` with the memory now and on every change. A missing document is an empty, enabled memory. */
export const subscribeToMemory = (uid: string, onChange: (memory: CoachMemory) => void, onError?: (error: Error) => void) =>
  onSnapshot(memoryRef(uid), (snap) => onChange(parseCoachMemory(snap.data())), onError);

/** Changes the memory with a pure function, in a transaction */
const changeMemory = (uid: string, change: (memory: CoachMemory, now: number) => CoachMemory) =>
  runTransaction(db, async (tx) => {
    const ref = memoryRef(uid);
    const snap = await tx.get(ref);
    const current = parseCoachMemory(snap.data());
    const next = change(current, Date.now());
    if (next !== current) tx.set(ref, next);
  });

/** Off: Pive neither uses the memory nor learns new things; the facts are kept */
export const setMemoryEnabled = (uid: string, enabled: boolean) =>
  setDoc(memoryRef(uid), { enabled, updatedAt: Date.now() }, { merge: true });

export const updateFactText = (uid: string, key: string, text: string) =>
  changeMemory(uid, (memory, now) => editFactText(memory, key, text, now));

export const deleteFact = (uid: string, key: string) => changeMemory(uid, (memory, now) => removeFact(memory, key, now));

export const deleteAllFacts = (uid: string) => changeMemory(uid, (memory, now) => clearFacts(memory, now));

/** After saving a nutrition plan: its restrictions replace the old plan's facts */
export const applyPlanRestrictions = (uid: string, restrictions: string[]) =>
  changeMemory(uid, (memory, now) => replacePlanFacts(memory, restrictions, now));
