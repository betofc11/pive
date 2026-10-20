import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Alert } from '../../src/lib/alert';
import * as Haptics from 'expo-haptics';
import { Upload, AlertCircle } from 'lucide-react-native';
import { analyzeWorkoutPlan } from '../../src/services/geminiService';
import { finishWorkoutSession, saveWorkoutPlan, startWorkoutSession, toggleExerciseDone } from '../../src/services/workoutService';
import { useAuth } from '../../src/hooks/useAuth';
import { usePersonalRecords } from '../../src/hooks/usePersonalRecords';
import { useWorkoutFiles } from '../../src/hooks/useWorkoutFiles';
import { handleFirestoreError, OperationType } from '../../src/firebase';
import { Theme } from '../../src/theme';
import { useHeaderScroll } from './_layout';
import { WorkoutDay } from '../../src/types';
import { readUriAsBase64 } from '../../src/lib/utils';
import { ActiveWorkout, ActiveWorkoutSkeleton } from '../../src/components/coach/ActiveWorkout';
import { WorkoutPlanUpload } from '../../src/components/coach/WorkoutPlanUpload';
import { WorkoutPlanDays } from '../../src/components/coach/WorkoutPlanDays';

export default function CoachScreen() {
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setScrolled, setGlobalLoading, setGlobalLoadingMessage } = useHeaderScroll();

  // Personal records (PRs) in real time, shown on each exercise of the active workout
  const personalRecords = usePersonalRecords(user?.uid);
  const { files, pickDocument, pickImages, takePhoto, removeFile, clearFiles } = useWorkoutFiles(setError);

  // Reset scroll status when navigating away
  useEffect(() => {
    return () => setScrolled(false);
  }, [setScrolled]);

  const currentPlan = profile?.workoutPlan;
  const activeSession = profile?.activeWorkoutSession;

  const handleUploadAll = async () => {
    if (!user || files.length === 0) return;
    setLoading(true);
    setGlobalLoading(true);
    setGlobalLoadingMessage('Analizando rutina con Pive AI...');
    setError(null);

    try {
      const filesBase64 = await Promise.all(
        files.map(async (file) => {
          const base64Data = await readUriAsBase64(file.uri);
          return {
            base64Data,
            mimeType: file.mimeType
          };
        })
      );

      const analysis = await analyzeWorkoutPlan({
        files: filesBase64
      });

      if (analysis && analysis.days) {
        await saveWorkoutPlan(user.uid, analysis);
        clearFiles();
        Alert.alert('¡Rutina Extraída!', 'Tu rutina de entrenamiento ha sido analizada y guardada con éxito.');
      } else {
        throw new Error('El análisis no devolvió datos estructurados de rutinas.');
      }
    } catch (err: any) {
      console.error('Error analyzing workout document:', err);
      setError('Error al analizar los archivos. Intenta de nuevo.');
      Alert.alert('Análisis fallido', 'No pudimos estructurar la rutina. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleStartWorkout = async (day: WorkoutDay) => {
    if (!user) return;
    try {
      await startWorkoutSession(user.uid, day);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error starting workout:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/activeWorkoutSession`);
    }
  };

  const handleToggleExercise = async (index: number) => {
    if (!user || !activeSession) return;
    try {
      await toggleExerciseDone(user.uid, activeSession, index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Error toggling exercise:', err);
    }
  };

  const handleFinishWorkout = () => {
    if (!user || !activeSession) return;
    // A session with nothing checked off isn't saved to the history (e.g. one started by mistake)
    const anyDone = activeSession.exercises.some((ex) => ex.done);
    Alert.alert(
      'Terminar Entrenamiento',
      anyDone
        ? '¿Estás seguro de que deseas finalizar la rutina de hoy?'
        : 'No marcaste ningún ejercicio, así que no se guardará en tu historial. ¿Terminar de todos modos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Terminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const saved = await finishWorkoutSession(user.uid, activeSession);
              if (saved) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('¡Excelente Trabajo!', 'Tu entrenamiento ha sido guardado. ¡Sigue así!');
              }
            } catch (err) {
              console.error('Error finishing workout session:', err);
              Alert.alert('No se pudo terminar', 'Tu entrenamiento sigue activo. Intenta de nuevo.');
            }
          }
        }
      ]
    );
  };

  // 0. SKELETON LOADING VIEW (While fetching user profile/active session from Firestore)
  if (authLoading) {
    return <ActiveWorkoutSkeleton />;
  }

  // 1. ACTIVE WORKOUT VIEW
  if (activeSession) {
    return (
      <ActiveWorkout
        session={activeSession}
        personalRecords={personalRecords}
        userId={user?.uid}
        onToggleExercise={handleToggleExercise}
        onFinish={handleFinishWorkout}
      />
    );
  }

  // 2. DASHBOARD / ACCORDION / ONBOARDING VIEW
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          setScrolled(offsetY > 10);
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tus <Text style={styles.highlightText}>Rutinas</Text></Text>
            <Text style={styles.subtitle}>Estructura tu entrenamiento con Pive AI.</Text>
          </View>

          {currentPlan && (
            <Pressable style={styles.reUploadBtn} onPress={pickDocument}>
              {loading ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <Upload size={20} color={Theme.colors.primary} />}
            </Pressable>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <AlertCircle size={20} color={Theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Upload files setup (If no plan exists, or showing files selected) */}
        {(!currentPlan || files.length > 0) && !loading && (
          <WorkoutPlanUpload
            files={files}
            loading={loading}
            showInstructions={!currentPlan && files.length === 0}
            onPickDocument={pickDocument}
            onPickImages={pickImages}
            onTakePhoto={takePhoto}
            onRemoveFile={removeFile}
            onSubmit={handleUploadAll}
          />
        )}

        {currentPlan && files.length === 0 && (
          <WorkoutPlanDays plan={currentPlan} onStartWorkout={handleStartWorkout} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100, // tab bar buffer
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Theme.fonts.headline,
    fontSize: 28,
    color: Theme.colors.onSurface,
  },
  highlightText: {
    color: Theme.colors.primary,
  },
  subtitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  reUploadBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.colors.errorContainer,
    borderRadius: 16,
    padding: 16,
  },
  errorText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onError,
    flex: 1,
  },
});
