import { addDoc, collection, deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BodyMetrics, DayStructure } from '../types';

type MetricsInput = Omit<BodyMetrics, 'height'>;

// Every metrics change is also kept in bodyMetricsHistory, which the Stats charts read
const addToHistory = (uid: string, metrics: MetricsInput) =>
  addDoc(collection(db, `users/${uid}/bodyMetricsHistory`), {
    userId: uid,
    ...metrics,
    date: new Date().toISOString(),
    createdAt: Date.now()
  });

export const saveProfileInfo = async (uid: string, info: { displayName: string; bio: string; bodyMetrics: MetricsInput }) => {
  await updateDoc(doc(db, 'users', uid), {
    displayName: info.displayName,
    bio: info.bio,
    bodyMetrics: info.bodyMetrics
  });
  await addToHistory(uid, info.bodyMetrics);
};

export const saveBodyMetrics = async (uid: string, metrics: MetricsInput) => {
  await updateDoc(doc(db, 'users', uid), {
    bodyMetrics: metrics
  });
  await addToHistory(uid, metrics);
};

/** Saves the meal slots the user customized ("Mis comidas del día"). */
export const saveDayStructure = (uid: string, structure: DayStructure) =>
  updateDoc(doc(db, 'users', uid), { dayStructure: { ...structure, source: 'user' } });

/** Back to the slots of the plan (or the default ones): the customized structure is deleted. */
export const clearDayStructure = (uid: string) => updateDoc(doc(db, 'users', uid), { dayStructure: deleteField() });
