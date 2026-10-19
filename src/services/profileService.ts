import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BodyMetrics } from '../types';

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
