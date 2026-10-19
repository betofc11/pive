import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ActiveWorkoutSession, WorkoutDay } from '../types';

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

export const finishWorkoutSession = (uid: string) =>
  updateDoc(getUserRef(uid), { activeWorkoutSession: null });
