import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { Alert } from '../../lib/alert';
import { handleFirestoreError, OperationType } from '../../firebase';
import { Theme } from '../../theme';
import { formatNum } from '../../lib/utils';
import { BodyMetrics } from '../../types';
import { saveBodyMetrics } from '../../services/profileService';
import { getLatestMetricsFromHealthKit, HealthKitLatestMetrics, HealthKitMetric, saveMetricsToHealthKit } from '../../services/healthKitService';
import { Modal } from '../Modal';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface ImportRowProps {
  label: string;
  metric: HealthKitMetric;
  // Appended to the numbers: ' kg' or '%'
  unit: string;
  currentValue?: number;
  selected: boolean;
  onToggle: () => void;
}

function ImportRow({ label, metric, unit, currentValue, selected, onToggle }: ImportRowProps) {
  return (
    <Pressable 
      style={[styles.importRow, selected && styles.importRowSelected]}
      onPress={onToggle}
    >
      <View style={styles.importRowLeft}>
        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
          {selected && <Check size={12} color="#ffffff" strokeWidth={3} />}
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={styles.importRowLabel}>{label}</Text>
          <Text style={styles.importRowDate}>{formatDate(metric.date)}</Text>
        </View>
      </View>
      <View style={styles.importRowRight}>
        <Text style={styles.importedValueText}>
          {formatNum(metric.value)}{unit}
        </Text>
        <Text style={styles.currentValueText}>
          Actual: {currentValue ? `${formatNum(currentValue)}${unit}` : 'N/A'}
        </Text>
      </View>
    </Pressable>
  );
}

interface HealthImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid?: string;
  currentMetrics?: BodyMetrics;
}

/** Reads the latest Apple Health measurements and saves the selected ones to the profile. */
export function HealthImportModal({ isOpen, onClose, uid, currentMetrics }: HealthImportModalProps) {
  const [healthData, setHealthData] = useState<HealthKitLatestMetrics | null>(null);
  const [fetchingHealthData, setFetchingHealthData] = useState(false);
  const [importWeight, setImportWeight] = useState(true);
  const [importBodyFat, setImportBodyFat] = useState(true);
  const [importMuscleMass, setImportMuscleMass] = useState(true);
  const [savingImport, setSavingImport] = useState(false);

  const fetchHealthData = async () => {
    setFetchingHealthData(true);
    setHealthData(null);
    try {
      const data = await getLatestMetricsFromHealthKit();
      setHealthData(data);
      setImportWeight(!!data.weight);
      setImportBodyFat(!!data.bodyFat);
      setImportMuscleMass(!!data.muscleMass);
    } catch (err) {
      console.warn('[HealthKit] Error fetching data for modal:', err);
      Alert.alert(
        'Error de Lectura',
        'No pudimos consultar tus datos de Apple Health. Por favor, asegúrate de activar los permisos de lectura en la app Ajustes.'
      );
      onClose();
    } finally {
      setFetchingHealthData(false);
    }
  };

  // Fetch HealthKit data when the modal is opened. Only on open: fetchHealthData (and the onClose
  // it calls) change on every render, and depending on them would refetch while the modal is open.
  useEffect(() => {
    if (isOpen) {
      fetchHealthData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSaveImport = async () => {
    if (!uid || !healthData) return;
    setSavingImport(true);
    try {
      const updatedWeight = importWeight && healthData.weight 
        ? healthData.weight.value 
        : (currentMetrics?.weight || 0);

      const updatedBodyFat = importBodyFat && healthData.bodyFat 
        ? healthData.bodyFat.value 
        : (currentMetrics?.bodyFat || 0);

      const updatedMuscleMass = importMuscleMass && healthData.muscleMass 
        ? healthData.muscleMass.value 
        : (currentMetrics?.muscleMass || 0);

      const metrics = {
        weight: updatedWeight,
        bodyFat: updatedBodyFat,
        muscleMass: updatedMuscleMass,
        updatedAt: Date.now()
      };

      await saveBodyMetrics(uid, metrics);

      // Sync back to HealthKit just to confirm
      saveMetricsToHealthKit(metrics.weight, metrics.bodyFat, metrics.muscleMass).catch(err => {
        console.warn('[HealthKit] Error syncing metrics after import:', err);
      });

      Alert.alert(
        'Importación Exitosa',
        'Se han importado y guardado tus métricas seleccionadas en tu perfil.'
      );
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setSavingImport(false);
    }
  };

  const hasData = healthData && (healthData.weight || healthData.bodyFat || healthData.muscleMass);
  const nothingSelected = !importWeight && !importBodyFat && !importMuscleMass;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Importar de Apple Health"
    >
      <View style={styles.modalContainer}>
        <Text style={styles.subtext}>
          Trae tus mediciones más recientes registradas por básculas inteligentes u otras apps vinculadas a Apple Health.
        </Text>

        {fetchingHealthData ? (
          <View style={styles.modalLoading}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.modalLoadingText}>Consultando a Apple Health...</Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {healthData && hasData ? (
              <View style={styles.importList}>
                {healthData.weight && (
                  <ImportRow
                    label="Peso Corporal"
                    metric={healthData.weight}
                    unit=" kg"
                    currentValue={currentMetrics?.weight}
                    selected={importWeight}
                    onToggle={() => setImportWeight(!importWeight)}
                  />
                )}

                {healthData.bodyFat && (
                  <ImportRow
                    label="% Grasa Corporal"
                    metric={healthData.bodyFat}
                    unit="%"
                    currentValue={currentMetrics?.bodyFat}
                    selected={importBodyFat}
                    onToggle={() => setImportBodyFat(!importBodyFat)}
                  />
                )}

                {healthData.muscleMass && (
                  <ImportRow
                    label="Masa Muscular"
                    metric={healthData.muscleMass}
                    unit=" kg"
                    currentValue={currentMetrics?.muscleMass}
                    selected={importMuscleMass}
                    onToggle={() => setImportMuscleMass(!importMuscleMass)}
                  />
                )}
              </View>
            ) : (
              <Text style={styles.noDataText}>
                No se encontraron registros recientes en Apple Health.
              </Text>
            )}

            <View style={styles.modalFooter}>
              <Pressable 
                style={styles.modalCancelButton}
                onPress={onClose}
                disabled={savingImport}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </Pressable>

              {hasData && (
                <Pressable 
                  style={[
                    styles.modalSaveButton, 
                    nothingSelected || savingImport ? styles.disabledButton : null
                  ]}
                  onPress={handleSaveImport}
                  disabled={nothingSelected || savingImport}
                >
                  {savingImport ? (
                    <ActivityIndicator color={Theme.colors.onPrimary} size="small" />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>Importar y Guardar</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    gap: 16,
    paddingBottom: 8,
  },
  subtext: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  importList: {
    gap: 12,
    marginVertical: 8,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    borderRadius: 16,
  },
  importRowSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '10',
  },
  importRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  importRowLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  importRowDate: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  importRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  importedValueText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  currentValueText: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  noDataText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
