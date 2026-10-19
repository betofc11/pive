import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { StrengthRecord } from '../types';

/**
 * Subscribes to the user's strength records and keeps the heaviest one per exercise,
 * keyed by the exercise name in lowercase.
 */
export function usePersonalRecords(uid: string | undefined) {
  const [records, setRecords] = useState<Record<string, StrengthRecord>>({});

  useEffect(() => {
    if (!uid) {
      setRecords({});
      return;
    }

    const q = query(collection(db, `users/${uid}/strengthRecords`), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map: Record<string, StrengthRecord> = {};
      snapshot.docs.forEach((docSnap) => {
        const record = { ...docSnap.data(), id: docSnap.id } as StrengthRecord;
        if (record.exercise) {
          const key = record.exercise.toLowerCase().trim();
          if (!map[key] || record.weight > map[key].weight) {
            map[key] = record;
          }
        }
      });
      setRecords(map);
    });

    return () => unsubscribe();
  }, [uid]);

  return records;
}
