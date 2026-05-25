import { Platform } from 'react-native';
import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';

const permissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.BodyFatPercentage,
      AppleHealthKit.Constants.Permissions.LeanBodyMass,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.BodyFatPercentage,
      AppleHealthKit.Constants.Permissions.LeanBodyMass,
      AppleHealthKit.Constants.Permissions.EnergyConsumed,
      AppleHealthKit.Constants.Permissions.Protein,
      AppleHealthKit.Constants.Permissions.Carbohydrates,
      AppleHealthKit.Constants.Permissions.FatTotal,
    ]
  }
} as HealthKitPermissions;

// Keep track of initialization status
let isInitialized = false;

/**
 * Checks if the HealthKit native module is linked and available
 */
export const isHealthKitAvailable = (): boolean => {
  return (
    Platform.OS === 'ios' &&
    !!AppleHealthKit &&
    typeof AppleHealthKit.initHealthKit === 'function'
  );
};

/**
 * Initializes HealthKit and requests the user's permission
 */
export const initHealthKit = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'ios') {
      resolve(false);
      return;
    }

    if (!isHealthKitAvailable()) {
      reject(
        new Error(
          'El módulo nativo de Apple HealthKit no está disponible. Si estás usando Expo Go, ten en cuenta que HealthKit requiere una compilación de desarrollo (npx expo run:ios) para poder ejecutarse.'
        )
      );
      return;
    }

    if (isInitialized) {
      resolve(true);
      return;
    }

    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      if (error) {
        console.warn('[HealthKit] Initialization failed:', error);
        resolve(false);
      } else {
        console.log('[HealthKit] Initialized successfully');
        isInitialized = true;
        resolve(true);
      }
    });
  });
};

/**
 * Automatically saves a logged meal's macros to HealthKit
 */
export const saveMealToHealthKit = async (
  name: string,
  macros: { protein: number; carbs: number; fats: number; calories: number }
) => {
  if (Platform.OS !== 'ios') return;

  try {
    const initialized = await initHealthKit();
    if (!initialized) return;

    const date = new Date().toISOString();

    const foodOptions: any = {
      foodName: name,
      mealType: 'Meal',
      date: date,
      startDate: date,
      endDate: date,
      energy: macros.calories,
      protein: macros.protein,
      carbohydrates: macros.carbs,
      fatTotal: macros.fats,
    };

    AppleHealthKit.saveFood(foodOptions, (err: string) => {
      if (err) {
        console.warn('[HealthKit] Error saving food correlation:', err);
      } else {
        console.log(`[HealthKit] Successfully registered meal "${name}" macros in Apple Health`);
      }
    });
  } catch (error) {
    console.warn('[HealthKit] Failed to log meal macros:', error);
  }
};

/**
 * Automatically saves weight, body fat, and muscle mass (as Lean Body Mass) to HealthKit
 */
export const saveMetricsToHealthKit = async (
  weight: number,
  bodyFat?: number,
  muscleMass?: number
) => {
  if (Platform.OS !== 'ios') return;

  try {
    const initialized = await initHealthKit();
    if (!initialized) return;

    const date = new Date().toISOString();

    // 1. Save Weight (in kg)
    if (weight > 0) {
      const weightOptions: any = {
        value: weight,
        unit: 'kg',
        date: date,
        startDate: date,
        endDate: date,
      };
      AppleHealthKit.saveWeight(
        weightOptions,
        (err: string) => {
          if (err) {
            console.warn('[HealthKit] Error saving weight:', err);
          } else {
            console.log('[HealthKit] Successfully saved weight to HealthKit:', weight, 'kg');
          }
        }
      );
    }

    // 2. Save Body Fat Percentage
    if (bodyFat && bodyFat > 0) {
      // Native saveBodyFatPercentage divides by 100 itself, so pass the raw percentage value (e.g. 18 for 18%)
      const fatOptions: any = {
        value: bodyFat,
        unit: 'percent',
        date: date,
        startDate: date,
        endDate: date,
      };
      AppleHealthKit.saveBodyFatPercentage(
        fatOptions,
        (err: string) => {
          if (err) {
            console.warn('[HealthKit] Error saving body fat percentage:', err);
          } else {
            console.log('[HealthKit] Successfully saved body fat to HealthKit:', bodyFat, '%');
          }
        }
      );
    }

    // 3. Save Muscle Mass (mapped as Lean Body Mass in kg)
    if (muscleMass && muscleMass > 0) {
      const leanMassOptions: any = {
        value: muscleMass,
        unit: 'kg',
        date: date,
        startDate: date,
        endDate: date,
      };
      AppleHealthKit.saveLeanBodyMass(
        leanMassOptions,
        (err: string) => {
          if (err) {
            console.warn('[HealthKit] Error saving lean body mass:', err);
          } else {
            console.log('[HealthKit] Successfully saved lean body mass to HealthKit:', muscleMass, 'kg');
          }
        }
      );
    }

    console.log('[HealthKit] Synced body metrics update triggered');
  } catch (error) {
    console.warn('[HealthKit] Failed to log body metrics:', error);
  }
};

export interface HealthKitMetric {
  value: number;
  date: string;
}

export interface HealthKitLatestMetrics {
  weight?: HealthKitMetric;
  bodyFat?: HealthKitMetric;
  muscleMass?: HealthKitMetric;
}

/**
 * Reads the latest weight, body fat percentage, and muscle mass (Lean Body Mass) from HealthKit
 */
export const getLatestMetricsFromHealthKit = async (): Promise<HealthKitLatestMetrics> => {
  if (Platform.OS !== 'ios') {
    return {};
  }

  try {
    const initialized = await initHealthKit();
    if (!initialized) {
      throw new Error('HealthKit initialization failed');
    }

    const getWeightPromise = new Promise<HealthKitMetric | null>((resolve) => {
      AppleHealthKit.getLatestWeight({ unit: 'kg' } as any, (err: string, results: any) => {
        if (err || !results) {
          resolve(null);
        } else {
          resolve({
            value: results.value,
            date: results.startDate || results.endDate || new Date().toISOString(),
          });
        }
      });
    });

    const getBodyFatPromise = new Promise<HealthKitMetric | null>((resolve) => {
      AppleHealthKit.getLatestBodyFatPercentage({} as any, (err: string, results: any) => {
        if (err || !results) {
          resolve(null);
        } else {
          resolve({
            value: results.value,
            date: results.startDate || results.endDate || new Date().toISOString(),
          });
        }
      });
    });

    const getMuscleMassPromise = new Promise<HealthKitMetric | null>((resolve) => {
      AppleHealthKit.getLatestLeanBodyMass({ unit: 'kg' } as any, (err: string, results: any) => {
        if (err || !results) {
          resolve(null);
        } else {
          resolve({
            value: results.value,
            date: results.startDate || results.endDate || new Date().toISOString(),
          });
        }
      });
    });

    const [weight, bodyFat, muscleMass] = await Promise.all([
      getWeightPromise,
      getBodyFatPromise,
      getMuscleMassPromise,
    ]);

    return {
      weight: weight || undefined,
      bodyFat: bodyFat || undefined,
      muscleMass: muscleMass || undefined,
    };
  } catch (error) {
    console.warn('[HealthKit] Error getting latest metrics:', error);
    throw error;
  }
};


