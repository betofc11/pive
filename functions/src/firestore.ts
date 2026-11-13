import { getFirestore } from "firebase-admin/firestore";
import { adminApp } from "./admin";
import { FIRESTORE_DATABASE_ID } from "./shared/config";

// The app uses a named database. getFirestore(adminApp) alone would point to "(default)", which is empty.
export const db = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
