import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Upload, FileText, Camera, Image as ImageIcon } from 'lucide-react-native';
import { Modal } from './Modal';
import { analyzeBodyComposition } from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { Theme } from '../theme';
import { saveMetricsToHealthKit } from '../services/healthKitService';

interface BodyCompositionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BodyCompositionDialog: React.FC<BodyCompositionDialogProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'edit' | 'saving'>('upload');

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
        });
      }
    } catch (err) {
      console.error('Error picking document', err);
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso Denegado', 'Se necesita acceso a la galería.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || 'imagen.jpg',
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.error('Error picking image', err);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso Denegado', 'Se necesita acceso a la cámara.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || 'foto.jpg',
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.error('Error taking photo', err);
      Alert.alert('Error', 'No se pudo tomar la foto.');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const base64Data = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: 'base64',
      });

      const result = await analyzeBodyComposition({
        base64Data,
        mimeType: selectedFile.mimeType,
      });

      setWeight(result.weight?.toString() || profile?.bodyMetrics?.weight?.toString() || '');
      setBodyFat(result.bodyFat?.toString() || profile?.bodyMetrics?.bodyFat?.toString() || '');
      setMuscleMass(result.muscleMass?.toString() || profile?.bodyMetrics?.muscleMass?.toString() || '');

      setStep('edit');
    } catch (error) {
      console.error('Error analyzing composition:', error);
      Alert.alert(
        'Análisis fallido',
        'No pudimos procesar el archivo. ¿Deseas ingresar los datos manualmente?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ingresar Manual', onPress: () => setStep('edit') }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setStep('saving');
    try {
      const metrics = {
        weight: parseFloat(weight) || 0,
        bodyFat: parseFloat(bodyFat) || 0,
        muscleMass: parseFloat(muscleMass) || 0,
        updatedAt: Date.now(),
      };

      // Update current state in profile
      await updateDoc(doc(db, 'users', user.uid), {
        bodyMetrics: metrics,
      });

      // Save to history collection
      await addDoc(collection(db, `users/${user.uid}/bodyMetricsHistory`), {
        userId: user.uid,
        ...metrics,
        date: new Date().toISOString(),
        createdAt: Date.now(),
      });

      // Sync to HealthKit
      saveMetricsToHealthKit(metrics.weight, metrics.bodyFat, metrics.muscleMass).catch(err => {
        console.warn('[HealthKit] Error syncing metrics from BodyCompositionDialog:', err);
      });

      onClose();
      // Reset state
      setSelectedFile(null);
      setStep('upload');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setStep('edit');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Composición Corporal">
      {step === 'upload' && (
        <View style={styles.container}>
          <Text style={styles.subtext}>
            Sube tu reporte InBody, documento de tu nutriólogo o toma una foto para que la IA extraiga tus métricas.
          </Text>

          {selectedFile ? (
            <View style={styles.selectedFileBox}>
              <View style={styles.fileIconWrapper}>
                <FileText size={32} color={Theme.colors.primary} />
              </View>
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Pressable onPress={() => setSelectedFile(null)}>
                <Text style={styles.changeFileText}>Cambiar archivo</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <Pressable style={styles.uploadOption} onPress={pickDocument}>
                <Upload size={24} color={Theme.colors.primary} />
                <Text style={styles.optionTitle}>Buscar Documento</Text>
                <Text style={styles.optionSubtitle}>PDF o Texto</Text>
              </Pressable>

              <View style={styles.row}>
                <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={pickImage}>
                  <ImageIcon size={20} color={Theme.colors.primary} />
                  <Text style={styles.optionTitleSmall}>Galería</Text>
                </Pressable>

                <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={takePhoto}>
                  <Camera size={20} color={Theme.colors.primary} />
                  <Text style={styles.optionTitleSmall}>Cámara</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.footerButtons}>
            <Pressable style={styles.manualButton} onPress={() => setStep('edit')}>
              <Text style={styles.manualButtonText}>Entrada Manual</Text>
            </Pressable>

            <Pressable
              style={[styles.analyzeButton, (!selectedFile || loading) ? styles.disabledButton : null]}
              disabled={!selectedFile || loading}
              onPress={handleAnalyze}
            >
              {loading ? (
                <ActivityIndicator color={Theme.colors.onPrimary} />
              ) : (
                <Text style={styles.analyzeButtonText}>Analizar con IA</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {step === 'edit' && (
        <View style={styles.container}>
          <Pressable style={styles.backButton} onPress={() => setStep('upload')}>
            <Text style={styles.backButtonText}>← Volver a subir archivo</Text>
          </Pressable>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Peso (kg)</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                style={styles.formInput}
                placeholder="0.0"
                placeholderTextColor={Theme.colors.onSurfaceVariant}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>% Grasa Corporal</Text>
              <TextInput
                value={bodyFat}
                onChangeText={setBodyFat}
                keyboardType="numeric"
                style={styles.formInput}
                placeholder="0.0"
                placeholderTextColor={Theme.colors.onSurfaceVariant}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Masa Muscular (kg)</Text>
              <TextInput
                value={muscleMass}
                onChangeText={setMuscleMass}
                keyboardType="numeric"
                style={styles.formInput}
                placeholder="0.0"
                placeholderTextColor={Theme.colors.onSurfaceVariant}
              />
            </View>
          </View>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Guardar Métricas</Text>
          </Pressable>
        </View>
      )}

      {step === 'saving' && (
        <View style={styles.savingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.savingText}>Guardando historial...</Text>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingVertical: 4,
  },
  subtext: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  selectedFileBox: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  fileIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.primary,
    textAlign: 'center',
  },
  changeFileText: {
    fontFamily: Theme.fonts.label,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
  uploadOptions: {
    gap: 8,
  },
  uploadOption: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfOption: {
    flex: 1,
    paddingVertical: 16,
  },
  optionTitle: {
    fontFamily: Theme.fonts.label,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  optionTitleSmall: {
    fontFamily: Theme.fonts.label,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  optionSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  manualButton: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  analyzeButton: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  backButtonText: {
    fontFamily: Theme.fonts.label,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  formInput: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 18,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onPrimary,
  },
  savingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 16,
  },
  savingText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
});
