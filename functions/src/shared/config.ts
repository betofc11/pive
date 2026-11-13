// Shared by the app and the Cloud Functions: pure TypeScript, no imports from npm, React Native or Node.

/**
 * The app uses a named Firestore database, not the default one. Only `functions/` is deployed, so the Functions
 * can't read `firebase-applet-config.json`: this constant must match its `firestoreDatabaseId` (a test checks it).
 */
export const FIRESTORE_DATABASE_ID = 'ai-studio-331e3929-266e-4062-bdd5-b4cbf0b60c7b';
