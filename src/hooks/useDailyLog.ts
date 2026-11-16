import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { DailyLog } from '../types';

/** The daily log of a date, live. Null while it loads, if the day has no log, or without a uid. */
export function useDailyLog(uid: string | undefined, date: string): DailyLog | null {
  const [log, setLog] = useState<{ key: string; value: DailyLog | null } | null>(null);
  const key = uid ? `${uid}/${date}` : '';

  useEffect(() => {
    if (!uid) return;
    const path = `users/${uid}/dailyLogs`;
    return onSnapshot(
      doc(db, path, date),
      (snap) => setLog({ key: `${uid}/${date}`, value: snap.exists() ? (snap.data() as DailyLog) : null }),
      (error) => console.error(`Error reading ${path}/${date}:`, error),
    );
  }, [uid, date]);

  // A log of another day or user (while the new one loads) is never returned
  return log && log.key === key ? log.value : null;
}
