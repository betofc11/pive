import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ActiveWorkoutSession, CompletedWorkout, WorkoutDay } from '../types';

const getUserRef = (uid: string) => doc(db, 'users', uid);

export const saveWorkoutPlan = (uid: string, plan: { name?: string; days: WorkoutDay[] }) =>
  updateDoc(getUserRef(uid), {
    workoutPlan: {
      name: plan.name || 'Plan de Entrenamiento Extraído',
      days: plan.days,
      extractedAt: Date.now(),
    },
  });

export const startWorkoutSession = (uid: string, day: WorkoutDay) =>
  updateDoc(getUserRef(uid), {
    activeWorkoutSession: {
      dayName: day.name,
      startedAt: Date.now(),
      exercises: day.exercises.map((ex) => ({ ...ex, done: false })),
    },
  });

export const toggleExerciseDone = (uid: string, session: ActiveWorkoutSession, index: number) => {
  const exercises = [...session.exercises];
  exercises[index] = { ...exercises[index], done: !exercises[index].done };
  return updateDoc(getUserRef(uid), { activeWorkoutSession: { ...session, exercises } });
};

/**
 * Ends the session and, if any exercise was done, saves it to the workout history.
 * Returns whether it was saved.
 */
export const finishWorkoutSession = async (uid: string, session: ActiveWorkoutSession) => {
  const batch = writeBatch(db);
  batch.update(getUserRef(uid), { activeWorkoutSession: null });

  const saved = session.exercises.some((ex) => ex.done);
  if (saved) {
    // Keyed by the start time, so finishing the same session twice saves it once
    const id = String(session.startedAt);
    const finishedAt = Date.now();
    const workout: CompletedWorkout = {
      ...session,
      id,
      userId: uid,
      finishedAt,
      date: new Date(finishedAt).toISOString(),
    };
    batch.set(doc(db, `users/${uid}/workoutHistory`, id), workout);
  }

  await batch.commit();
  return saved;
};
