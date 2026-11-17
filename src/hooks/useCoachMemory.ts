import { useEffect, useState } from 'react';
import { subscribeToMemory } from '../services/memoryService';
import type { CoachMemory } from '../../functions/src/shared/memory/memory';

/** Pive's memory of the user, live. `memory` is null until the first read (or if it fails). */
export function useCoachMemory(uid: string | undefined) {
  const [memory, setMemory] = useState<CoachMemory | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setMemory(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeToMemory(
      uid,
      (next) => {
        setMemory(next);
        setLoading(false);
      },
      (error) => {
        console.error('[Memory] Could not read the memory:', error);
        setLoading(false);
      },
    );
  }, [uid]);

  return { memory, loading };
}
