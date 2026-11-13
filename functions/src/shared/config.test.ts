import appConfig from '../../../firebase-applet-config.json';
import firebaseJson from '../../../firebase.json';
import { FIRESTORE_DATABASE_ID } from './config';

it('FIRESTORE_DATABASE_ID matches the database the app uses', () => {
  expect(FIRESTORE_DATABASE_ID).toBe(appConfig.firestoreDatabaseId);
});

it('the rules are deployed to that same database', () => {
  expect(firebaseJson.firestore.map((entry) => entry.database)).toContain(FIRESTORE_DATABASE_ID);
});
