/**
 * @jest-environment node
 */
// Runs against the Firestore and Auth emulators: `npm run test:emulator` (needs Java).
// Excluded from `npm test`.
import { signInAnonymously, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, terminate } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { saveBodyMetrics, saveProfileInfo } from './profileService';

// jest.mock factories can't use imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../firebase', () => require('../test/emulatorFirebase'));

jest.setTimeout(30000);

let uid: string;
const readProfile = async () => (await getDoc(doc(db, 'users', uid))).data()!;
const readHistory = async () => (await getDocs(collection(db, `users/${uid}/bodyMetricsHistory`))).docs.map((d) => d.data());

beforeAll(async () => {
  uid = (await signInAnonymously(auth)).user.uid;
  await setDoc(doc(db, 'users', uid), { uid, email: 'luis@pive.test', displayName: 'Luis', createdAt: Date.now() });
});

afterAll(async () => {
  await signOut(auth);
  await terminate(db);
});

it('saveProfileInfo updates name, bio and metrics, and adds the metrics to the history', async () => {
  const metrics = { weight: 76.5, bodyFat: 14.8, muscleMass: 37.1, updatedAt: Date.now() };
  await saveProfileInfo(uid, { displayName: 'Luis Fonseca', bio: 'Entreno 4 veces por semana.', bodyMetrics: metrics });

  expect(await readProfile()).toMatchObject({ displayName: 'Luis Fonseca', bio: 'Entreno 4 veces por semana.', bodyMetrics: metrics });
  const history = await readHistory();
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({ userId: uid, ...metrics });
  expect(typeof history[0].date).toBe('string');
  expect(typeof history[0].createdAt).toBe('number');
});

it('saveBodyMetrics only touches the metrics, and also adds them to the history', async () => {
  const metrics = { weight: 77.4, bodyFat: 15.2, muscleMass: 37.1, updatedAt: Date.now() };
  await saveBodyMetrics(uid, metrics);

  const profile = await readProfile();
  expect(profile.bodyMetrics).toEqual(metrics);
  expect(profile.displayName).toBe('Luis Fonseca');
  expect(profile.bio).toBe('Entreno 4 veces por semana.');
  expect(await readHistory()).toHaveLength(2);
});

it("doesn't let another user change someone else's profile or history", async () => {
  const ownerUid = uid;
  // The SDK logs each rejected write as a warning; here they're expected
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await signOut(auth);
  await signInAnonymously(auth);

  const metrics = { weight: 1, bodyFat: 1, muscleMass: 1, updatedAt: Date.now() };
  await expect(saveBodyMetrics(ownerUid, metrics)).rejects.toMatchObject({ code: 'permission-denied' });
  await expect(saveProfileInfo(ownerUid, { displayName: 'Intruso', bio: '', bodyMetrics: metrics })).rejects.toMatchObject({ code: 'permission-denied' });
});
