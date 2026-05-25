export interface HealthKitMetric {
  value: number;
  date: string;
}

export interface HealthKitLatestMetrics {
  weight?: HealthKitMetric;
  bodyFat?: HealthKitMetric;
  muscleMass?: HealthKitMetric;
}

export const isHealthKitAvailable = (): boolean => {
  return false;
};

export const initHealthKit = (): Promise<boolean> => {
  return Promise.resolve(false);
};

export const saveMealToHealthKit = async (
  name: string,
  macros: { protein: number; carbs: number; fats: number; calories: number }
): Promise<void> => {
  // No-op on web
  return;
};

export const saveMetricsToHealthKit = async (
  weight: number,
  bodyFat?: number,
  muscleMass?: number
): Promise<void> => {
  // No-op on web
  return;
};

export const getLatestMetricsFromHealthKit = async (): Promise<HealthKitLatestMetrics> => {
  return {};
};
