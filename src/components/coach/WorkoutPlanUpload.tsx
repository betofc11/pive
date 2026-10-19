import React from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Upload, Camera, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { Theme } from '../../theme';
import { WorkoutFile } from '../../hooks/useWorkoutFiles';

interface WorkoutPlanUploadProps {
  files: WorkoutFile[];
  loading: boolean;
  // The "how it works" steps, for users who don't have a plan yet
  showInstructions: boolean;
  onPickDocument: () => void;
  onPickImages: () => void;
  onTakePhoto: () => void;
  onRemoveFile: (index: number) => void;
  onSubmit: () => void;
}

/** Picks the photos or PDF of a workout plan and sends them to be analyzed. */
export function WorkoutPlanUpload({
  files,
  loading,
  showInstructions,
  onPickDocument,
  onPickImages,
  onTakePhoto,
  onRemoveFile,
  onSubmit,
}: WorkoutPlanUploadProps) {
  return (
    <View style={styles.onboardingCard}>
      <View style={styles.uploadOptions}>
        <Pressable style={styles.uploadOption} onPress={onPickDocument}>
          <Upload size={32} color={Theme.colors.primary} />
          <Text style={styles.optionTitle}>Subir Rutina en PDF</Text>
          <Text style={styles.optionSubtitle}>Documento de texto o archivo PDF</Text>
        </Pressable>

        <View style={styles.row}>
          <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={onPickImages}>
            <ImageIcon size={24} color={Theme.colors.primary} />
            <Text style={styles.optionTitleSmall}>Galería (Fotos)</Text>
          </Pressable>

          <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={onTakePhoto}>
            <Camera size={24} color={Theme.colors.primary} />
            <Text style={styles.optionTitleSmall}>Cámara</Text>
          </Pressable>
        </View>
      </View>

      {/* Accumulated files display */}
      {files.length > 0 && (
        <View style={styles.selectedFilesBox}>
          <Text style={styles.selectedFilesHeader}>Archivos a enviar ({files.length}):</Text>
          {files.map((file, idx) => (
            <View key={idx} style={styles.fileChip}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Pressable onPress={() => onRemoveFile(idx)} style={styles.deleteFileBtn}>
                <Trash2 size={16} color={Theme.colors.error} />
              </Pressable>
            </View>
          ))}

          <Pressable
            style={styles.processBtn}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Theme.colors.onPrimary} />
            ) : (
              <Text style={styles.processBtnText}>Extraer Rutina con Pive AI</Text>
            )}
          </Pressable>
        </View>
      )}
      
      {showInstructions && (
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>¿Cómo funciona?</Text>
          <View style={styles.instructionStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Sube una o varias fotos de tu rutina, capturas de pantalla o un documento PDF.</Text>
          </View>
          <View style={styles.instructionStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>Pive estructurará de forma inteligente los días, ejercicios, series y repeticiones.</Text>
          </View>
          <View style={styles.instructionStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>Podrás iniciar entrenamientos y registrar tus series hechas con explicaciones y videos.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  onboardingCard: {
    gap: 20,
  },
  uploadOptions: {
    gap: 10,
  },
  uploadOption: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfOption: {
    flex: 1,
    paddingVertical: 18,
  },
  optionTitle: {
    fontFamily: Theme.fonts.label,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  optionTitleSmall: {
    fontFamily: Theme.fonts.label,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  optionSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  selectedFilesBox: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    gap: 12,
  },
  selectedFilesHeader: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  fileName: {
    flex: 1,
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginRight: 8,
  },
  deleteFileBtn: {
    padding: 4,
  },
  processBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 4,
  },
  processBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.onPrimary,
  },
  instructionsSection: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
    gap: 16,
  },
  instructionsTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  instructionStep: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  stepText: {
    flex: 1,
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
});
