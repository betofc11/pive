/**
 * @jest-environment node
 */
// Runs against the Firestore and Auth emulators: `npm run test:emulator` (needs Java).
// Excluded from `npm test`.
import { signInAnonymously, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, terminate } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ActiveWorkoutSession, CompletedWorkout, WorkoutDay } from '../types';
import { finishWorkoutSession, saveWorkoutPlan, startWorkoutSession, toggleExerciseDone } from './workoutService';

// jest.mock factories can't use imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../firebase', () => require('../test/emulatorFirebase'));

jest.setTimeout(30000);

const day: WorkoutDay = {
  name: 'Día 1 - Pecho',
  exercises: [
    { name: 'Press de Banca', sets: '4', reps: '8', description: 'Controlado', youtubeUrl: '', muscleGroups: ['Pecho'] },
    { name: 'Fondos', sets: '3', reps: '12', description: 'Torso adelante', youtubeUrl: '' },
  ],
};

let uid: string;
const readProfile = async () => (await getDoc(doc(db, 'users', uid))).data()!;
const readHistory = async () => (await getDocs(collection(db, `users/${uid}/workoutHistory`))).docs.map((d) => d.data() as CompletedWorkout);
// Starts a session and checks off the exercises at the given indexes
const startWithDone = async (...done: number[]): Promise<ActiveWorkoutSession> => {
  await startWorkoutSession(uid, day);
  let session = (await readProfile()).activeWorkoutSession;
  for (const index of done) {
    await toggleExerciseDone(uid, session, index);
    session = (await readProfile()).activeWorkoutSession;
  }
  return session;
};

beforeAll(async () => {
  uid = (await signInAnonymously(auth)).user.uid;
  await setDoc(doc(db, 'users', uid), { uid, email: 'luis@pive.test', displayName: 'Luis', createdAt: Date.now() });
});

afterAll(async () => {
  await signOut(auth);
  await terminate(db);
});

describe('saveWorkoutPlan', () => {
  it('saves the analyzed plan with its extraction time', async () => {
    const before = Date.now();
    await saveWorkoutPlan(uid, { name: 'Fuerza 4 días', days: [day] });

    const { workoutPlan } = await readProfile();
    expect(workoutPlan).toMatchObject({ name: 'Fuerza 4 días', days: [day] });
    expect(workoutPlan.extractedAt).toBeGreaterThanOrEqual(before);
  });

  it('uses a default name when the analysis has none', async () => {
    await saveWorkoutPlan(uid, { days: [day] });
    expect((await readProfile()).workoutPlan.name).toBe('Plan de Entrenamiento Extraído');
  });
});

describe('workout session', () => {
  it('starts with every exercise of the day not done', async () => {
    const before = Date.now();
    await startWorkoutSession(uid, day);

    const session = (await readProfile()).activeWorkoutSession;
    expect(session.dayName).toBe('Día 1 - Pecho');
    expect(session.startedAt).toBeGreaterThanOrEqual(before);
    expect(session.exercises).toEqual(day.exercises.map((ex) => ({ ...ex, done: false })));
  });

  it('toggles only the chosen exercise, and back', async () => {
    await startWorkoutSession(uid, day);
    let session = (await readProfile()).activeWorkoutSession;

    await toggleExerciseDone(uid, session, 1);
    session = (await readProfile()).activeWorkoutSession;
    expect(session.exercises.map((ex: { done: boolean }) => ex.done)).toEqual([false, true]);

    await toggleExerciseDone(uid, session, 1);
    session = (await readProfile()).activeWorkoutSession;
    expect(session.exercises.map((ex: { done: boolean }) => ex.done)).toEqual([false, false]);
  });

  it('finishing clears the session and keeps the plan', async () => {
    await saveWorkoutPlan(uid, { name: 'Fuerza 4 días', days: [day] });
    const session = await startWithDone(0);

    await finishWorkoutSession(uid, session);

    const profile = await readProfile();
    expect(profile.activeWorkoutSession).toBeNull();
    expect(profile.workoutPlan.name).toBe('Fuerza 4 días');
  });
});

describe('workout history', () => {
  it('saves a finished session with what was done and when', async () => {
    const session = await startWithDone(1);
    const before = Date.now();

    await expect(finishWorkoutSession(uid, session)).resolves.toBe(true);

    const saved = (await readHistory()).find((w) => w.startedAt === session.startedAt)!;
    expect(saved).toMatchObject({ id: String(session.startedAt), userId: uid, dayName: 'Día 1 - Pecho', exercises: session.exercises });
    expect(saved.exercises.map((ex) => ex.done)).toEqual([false, true]);
    expect(saved.finishedAt).toBeGreaterThanOrEqual(before);
    expect(saved.date).toBe(new Date(saved.finishedAt).toISOString());
  });

  it("doesn't save a session with no exercise done, but still ends it", async () => {
    const session = await startWithDone();
    const countBefore = (await readHistory()).length;

    await expect(finishWorkoutSession(uid, session)).resolves.toBe(false);

    expect((await readProfile()).activeWorkoutSession).toBeNull();
    expect(await readHistory()).toHaveLength(countBefore);
  });

  it('saves the same session once even if it is finished twice', async () => {
    const session = await startWithDone(0, 1);
    const countBefore = (await readHistory()).length;

    await Promise.all([finishWorkoutSession(uid, session), finishWorkoutSession(uid, session)]);

    expect(await readHistory()).toHaveLength(countBefore + 1);
  });
});

describe('firestore.rules', () => {
  it("doesn't let another user change someone else's workout or read their history", async () => {
    const ownerUid = uid;
    // The SDK logs each rejected write as a warning; here they're expected
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await signOut(auth);
    await signInAnonymously(auth);

    await expect(startWorkoutSession(ownerUid, day)).rejects.toMatchObject({ code: 'permission-denied' });
    const session = { dayName: day.name, startedAt: Date.now(), exercises: day.exercises.map((ex) => ({ ...ex, done: true })) };
    await expect(finishWorkoutSession(ownerUid, session)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(collection(db, `users/${ownerUid}/workoutHistory`))).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
