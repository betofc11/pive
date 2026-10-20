import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { BodyMetricsHistory, CompletedWorkout, StrengthRecord, UserProfile } from '../types';
import { buildActivityItems, MAX_ACTIVITY_ITEMS } from '../lib/activity';

// Latest entries of a user subcollection ordered by its ISO `date`, kept up to date
function useLatestByDate<T>(uid: string | undefined, subcollection: string) {
  const [entries, setEntries] = useState<T[]>([]);

  useEffect(() => {
    if (!uid) {
      setEntries([]);
      return;
    }
    const q = query(collection(db, `users/${uid}/${subcollection}`), orderBy('date', 'desc'), limit(MAX_ACTIVITY_ITEMS));
    return onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }) as T));
    }, (error) => {
      console.warn(`[ActivityHistory] Could not read ${subcollection}:`, error);
    });
  }, [uid, subcollection]);

  return entries;
}

/** The user's recent activity, from real data: metrics updates, strength records, finished workouts and plan uploads. */
export function useActivityHistory(uid: string | undefined, profile: UserProfile | null) {
  const metricsHistory = useLatestByDate<BodyMetricsHistory>(uid, 'bodyMetricsHistory');
  const records = useLatestByDate<StrengthRecord>(uid, 'strengthRecords');
  const workouts = useLatestByDate<CompletedWorkout>(uid, 'workoutHistory');

  return useMemo(
    () => buildActivityItems(metricsHistory, records, workouts, profile),
    [metricsHistory, records, workouts, profile],
  );
}
