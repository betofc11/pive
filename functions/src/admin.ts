import { getApps, initializeApp } from "firebase-admin/app";

// Initialized here, not in index.ts: imports run before the body of index.ts, and the modules that
// use the Admin SDK (http.ts, firestore.ts) need the app as soon as they load.
export const adminApp = getApps()[0] ?? initializeApp();
