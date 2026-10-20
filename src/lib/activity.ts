import { BodyMetricsHistory, StrengthRecord, UserProfile } from '../types';
import { formatNum } from './utils';

export type ActivityType = 'metrics' | 'record' | 'nutritionPlan' | 'workoutPlan';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  timestamp: number;
}

export const MAX_ACTIVITY_ITEMS = 5;

/** Most recent first: body metrics updates, strength records and plan uploads. */
export function buildActivityItems(
  metricsHistory: BodyMetricsHistory[],
  records: StrengthRecord[],
  profile: Pick<UserProfile, 'nutritionalPlan' | 'workoutPlan'> | null,
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...metricsHistory.map((entry): ActivityItem => ({
      id: `metrics-${entry.id}`,
      type: 'metrics',
      title: `Composición Actualizada · ${formatNum(entry.weight)} kg`,
      timestamp: Date.parse(entry.date),
    })),
    ...records.map((record): ActivityItem => ({
      id: `record-${record.id}`,
      type: 'record',
      title: `Nuevo Récord · ${record.exercise} ${formatNum(record.weight)} kg`,
      timestamp: Date.parse(record.date),
    })),
  ];

  if (profile?.nutritionalPlan?.extractedAt) {
    items.push({ id: 'nutrition-plan', type: 'nutritionPlan', title: 'Plan Nutricional Subido', timestamp: profile.nutritionalPlan.extractedAt });
  }
  if (profile?.workoutPlan?.extractedAt) {
    items.push({ id: 'workout-plan', type: 'workoutPlan', title: 'Rutina de Entrenamiento Subida', timestamp: profile.workoutPlan.extractedAt });
  }

  return items
    .filter((item) => !Number.isNaN(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ACTIVITY_ITEMS);
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Hoy, 10:30 AM", "Ayer, 6:45 PM" or "12 oct, 9:05 AM", in the device's time zone. */
export function formatActivityTime(timestamp: number, now: Date = new Date()): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const time = `${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;

  // Calendar days, rounded so a daylight saving change doesn't shift the count
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (daysAgo === 0) return `Hoy, ${time}`;
  if (daysAgo === 1) return `Ayer, ${time}`;
  return `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, ${time}`;
}
