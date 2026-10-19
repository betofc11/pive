/**
 * @jest-environment node
 */
// Runs against the Firestore and Auth emulators: `npm run test:emulator` (needs Java).
// Excluded from `npm test`.
import { signInAnonymously, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Meal } from '../types';
import { addMealToDailyLog, removeMealFromDailyLog } from './dailyLogService';

jest.mock('../firebase', () => {
  const { initializeApp } = require('firebase/app');
  const { getAuth, connectAuthEmulator } = require('firebase/auth');
  const { getFirestore, connectFirestoreEmulator } = require('firebase/firestore');
  const config = require('../../firebase-applet-config.json');

  const app = initializeApp({ projectId: 'demo-pive', apiKey: 'demo-key' });
  // Same named database as the app, so firestore.rules apply as in production
  const db = getFirestore(app, config.firestoreDatabaseId);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  connectFirestoreEmulator(db, host, Number(port));
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  return { db, auth };
});

jest.setTimeout(30000);

const meal = (id: string, calories = 100): Meal => ({
  id,
  name: `Comida ${id}`,
  time: '2026-10-19T12:00:00.000Z',
  macros: { protein: 10, carbs: 20, fats: 5, calories },
});

let uid: string;
let dayCounter = 0;
// Each test writes to its own day, so they don't depend on each other
const nextDate = () => `2026-01-${String(++dayCounter).padStart(2, '0')}`;
const readLog = async (date: string) => (await getDoc(doc(db, `users/${uid}/dailyLogs`, date))).data()!;
const totalOfMeals = (meals: Meal[]) => meals.reduce((sum, m) => sum + m.macros.calories, 0);

beforeAll(async () => {
  uid = (await signInAnonymously(auth)).user.uid;
});

afterAll(async () => {
  await signOut(auth);
  await terminate(db);
});

describe('addMealToDailyLog', () => {
  it('creates the day log on the first meal, with the fields the app reads', async () => {
    const date = nextDate();
    await addMealToDailyLog(uid, date, meal('a', 350));

    const log = await readLog(date);
    expect(log).toMatchObject({
      id: date,
      userId: uid,
      macros: { protein: 10, carbs: 20, fats: 5, calories: 350 },
      meals: [meal('a', 350)],
    });
    expect(typeof log.date).toBe('string');
    // 90 calendar days later (not 90 × 24 h: a daylight saving change in between adds or removes an hour)
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);
    expect(Math.abs(log.expireAt.toDate().getTime() - in90Days.getTime())).toBeLessThan(60_000);
  });

  it('adds to an existing day: sums the totals and appends the meal', async () => {
    const date = nextDate();
    await addMealToDailyLog(uid, date, meal('a', 100));
    await addMealToDailyLog(uid, date, meal('b', 250));

    const log = await readLog(date);
    expect(log.meals.map((m: Meal) => m.id)).toEqual(['a', 'b']);
    expect(log.macros).toEqual({ protein: 20, carbs: 40, fats: 10, calories: 350 });
  });

  it('keeps every meal when many are saved at the same time', async () => {
    const date = nextDate();
    await Promise.all(Array.from({ length: 20 }, (_, i) => addMealToDailyLog(uid, date, meal(`m${i}`))));

    const log = await readLog(date);
    expect(log.meals).toHaveLength(20);
    expect(log.macros.calories).toBe(2000);
  });
});

describe('removeMealFromDailyLog', () => {
  it('removes the meal by id and subtracts its macros', async () => {
    const date = nextDate();
    await addMealToDailyLog(uid, date, meal('a', 100));
    await addMealToDailyLog(uid, date, meal('b', 250));

    await removeMealFromDailyLog(uid, date, 'a');

    const log = await readLog(date);
    expect(log.meals.map((m: Meal) => m.id)).toEqual(['b']);
    expect(log.macros).toEqual({ protein: 10, carbs: 20, fats: 5, calories: 250 });
  });

  it('never lets a total go below zero', async () => {
    const date = nextDate();
    // A log whose stored total is already lower than its meal (e.g. older inconsistent data)
    await setDoc(doc(db, `users/${uid}/dailyLogs`, date), {
      id: date,
      userId: uid,
      date: new Date().toISOString(),
      macros: { protein: 0, carbs: 0, fats: 0, calories: 50 },
      meals: [meal('a', 100)],
    });

    await removeMealFromDailyLog(uid, date, 'a');

    expect((await readLog(date)).macros).toEqual({ protein: 0, carbs: 0, fats: 0, calories: 0 });
  });

  it('does nothing for a meal or a day that does not exist', async () => {
    const date = nextDate();
    await addMealToDailyLog(uid, date, meal('a', 100));

    await removeMealFromDailyLog(uid, date, 'missing');
    await removeMealFromDailyLog(uid, nextDate(), 'a');

    const log = await readLog(date);
    expect(log.meals).toHaveLength(1);
    expect(log.macros.calories).toBe(100);
  });

  it('stays consistent when saves and deletes overlap', async () => {
    const date = nextDate();
    for (let i = 0; i < 10; i++) await addMealToDailyLog(uid, date, meal(`old${i}`));

    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) => removeMealFromDailyLog(uid, date, `old${i}`)),
      ...Array.from({ length: 5 }, (_, i) => addMealToDailyLog(uid, date, meal(`new${i}`))),
    ]);

    const log = await readLog(date);
    expect(log.meals).toHaveLength(10);
    expect(log.macros.calories).toBe(totalOfMeals(log.meals));
  });
});

describe('firestore.rules', () => {
  it("doesn't let another user write to someone else's log", async () => {
    const ownerUid = uid;
    const date = nextDate();
    await addMealToDailyLog(ownerUid, date, meal('a'));

    await signOut(auth);
    await signInAnonymously(auth);

    await expect(addMealToDailyLog(ownerUid, date, meal('intruder'))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(removeMealFromDailyLog(ownerUid, date, 'a')).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
