import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { DailyLog, Meal } from '../types';

type Macros = Meal['macros'];

const TTL_DAYS = 90;

const getLogRef = (uid: string, date: string) => doc(db, `users/${uid}/dailyLogs`, date);

// Suma (sign = 1) o resta (sign = -1) los macros de una comida al total del día, sin bajar de 0.
const applyMacros = (total: Partial<Macros> | undefined, meal: Partial<Macros> | undefined, sign: 1 | -1): Macros => ({
  protein: Math.max(0, (total?.protein || 0) + sign * (meal?.protein || 0)),
  carbs: Math.max(0, (total?.carbs || 0) + sign * (meal?.carbs || 0)),
  fats: Math.max(0, (total?.fats || 0) + sign * (meal?.fats || 0)),
  calories: Math.max(0, (total?.calories || 0) + sign * (meal?.calories || 0)),
});

// Las dos operaciones corren en una transacción: si otra escritura cambia el log entre la
// lectura y la escritura, Firestore reintenta con el dato nuevo, así dos cambios casi
// simultáneos (dos comidas guardadas a la vez, o guardar y borrar) no se pisan.

export const addMealToDailyLog = (uid: string, date: string, meal: Meal) =>
  runTransaction(db, async (tx) => {
    const logRef = getLogRef(uid, date);
    const snap = await tx.get(logRef);

    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + TTL_DAYS);

    if (snap.exists()) {
      const log = snap.data() as DailyLog;
      tx.update(logRef, {
        macros: applyMacros(log.macros, meal.macros, 1),
        meals: [...(log.meals || []), meal],
        expireAt,
      });
    } else {
      tx.set(logRef, {
        id: date,
        userId: uid,
        date: new Date().toISOString(),
        macros: applyMacros(undefined, meal.macros, 1),
        meals: [meal],
        expireAt,
      });
    }
  });

export const removeMealFromDailyLog = (uid: string, date: string, mealId: string) =>
  runTransaction(db, async (tx) => {
    const logRef = getLogRef(uid, date);
    const snap = await tx.get(logRef);
    if (!snap.exists()) return;

    const log = snap.data() as DailyLog;
    const meal = (log.meals || []).find((m) => m.id === mealId);
    if (!meal) return;

    tx.update(logRef, {
      macros: applyMacros(log.macros, meal.macros, -1),
      meals: log.meals.filter((m) => m.id !== mealId),
    });
  });
