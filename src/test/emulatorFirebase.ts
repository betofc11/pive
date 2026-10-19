// Firebase connected to the local emulators, for the *.emulator.test.ts files (`npm run test:emulator`).
// Uses the app's own named database, so firestore.rules apply as in production.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

const app = initializeApp({ projectId: 'demo-pive', apiKey: 'demo-key' });

export const db = getFirestore(app, config.firestoreDatabaseId);
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
connectFirestoreEmulator(db, host, Number(port));

export const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
