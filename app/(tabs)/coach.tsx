import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator, Linking, Animated } from 'react-native';
import { Alert } from '../../src/lib/alert';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Upload, Camera, Image as ImageIcon, ChevronDown, ChevronUp, Play, CheckCircle2, AlertCircle, Trash2, Clock, Check, ExternalLink, Trophy, Plus, Square } from 'lucide-react-native';
import { analyzeWorkoutPlan } from '../../src/services/geminiService';
import { useAuth } from '../../src/hooks/useAuth';
import { doc, updateDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../src/firebase';
import { Theme } from '../../src/theme';
import { useHeaderScroll } from './_layout';
import { RecordDialog } from '../../src/components/RecordDialog';
import { WorkoutDay, ActiveExercise, StrengthRecord } from '../../src/types';
import { readUriAsBase64 } from '../../src/lib/utils';

// Helper to open YouTube App directly or fallback to browser
const openYouTubeSearch = async (query: string) => {
  const encodedQuery = encodeURIComponent(query);
  const appUrl = `youtube://results?search_query=${encodedQuery}`;
  const webUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.error('Error opening YouTube:', error);
    await Linking.openURL(webUrl);
  }
};

const Skeleton = ({ width, height, borderRadius = 8, style }: { width?: any; height: number; borderRadius?: number; style?: any }) => {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width || '100%',
          height,
          borderRadius,
          backgroundColor: Theme.colors.surfaceContainerHighest || '#e0e0e0',
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

export default function CoachScreen() {
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setScrolled, setGlobalLoading, setGlobalLoadingMessage } = useHeaderScroll();

  const [prWeights, setPrWeights] = useState<Record<string, { weight: number; date: string; id: string }>>({});
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [dialogInitialData, setDialogInitialData] = useState<any | null>(null);

  // Subscribe to strength records to extract personal records (PRs) in real time
  useEffect(() => {
    if (!user) {
      setPrWeights({});
      return;
    }

    const q = query(collection(db, `users/${user.uid}/strengthRecords`), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map: Record<string, { weight: number; date: string; id: string }> = {};
      snapshot.docs.forEach((docSnap) => {
        const record = { ...docSnap.data(), id: docSnap.id } as StrengthRecord;
        if (record.exercise) {
          const key = record.exercise.toLowerCase().trim();
          if (!map[key] || record.weight > map[key].weight) {
            map[key] = { weight: record.weight, date: record.date, id: record.id };
          }
        }
      });
      setPrWeights(map);
    });

    return () => unsubscribe();
  }, [user]);

  // Reset scroll status when navigating away
  useEffect(() => {
    return () => setScrolled(false);
  }, [setScrolled]);

  const [selectedFiles, setSelectedFiles] = useState<{ uri: string; name: string; mimeType: string }[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [elapsedTime, setElapsedTime] = useState('--:--');

  const currentPlan = profile?.workoutPlan;
  const activeSession = profile?.activeWorkoutSession;

  // Track live session timer
  useEffect(() => {
    if (!activeSession?.startedAt) {
      setElapsedTime('--:--');
      return;
    }

    const updateTimer = () => {
      const diffMs = Date.now() - activeSession.startedAt;
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      setElapsedTime(formatted);
    };

    updateTimer(); // Run immediately on mount/update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.startedAt]);

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setSelectedFiles(prev => [...prev, {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream'
        }]);
      }
    } catch (err) {
      console.error('Error picking document', err);
      setError('No se pudo seleccionar el archivo.');
    }
  };

  const pickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso Denegado', 'Se necesita acceso a la galería.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newFiles = res.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `imagen_${Date.now()}_${index}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg'
        }));
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error('Error picking images', err);
      setError('No se pudieron seleccionar las imágenes.');
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
        const newFile = {
          uri: res.assets[0].uri,
          name: `foto_${Date.now()}.jpg`,
          mimeType: res.assets[0].mimeType || 'image/jpeg'
        };
        setSelectedFiles(prev => [...prev, newFile]);
      }
    } catch (err) {
      console.error('Error taking photo', err);
      setError('No se pudo tomar la foto.');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUploadAll = async () => {
    if (!user || selectedFiles.length === 0) return;
    setLoading(true);
    setGlobalLoading(true);
    setGlobalLoadingMessage('Analizando rutina con Pive AI...');
    setError(null);

    try {
      const filesBase64 = await Promise.all(
        selectedFiles.map(async (file) => {
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
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          workoutPlan: {
            name: analysis.name || 'Plan de Entrenamiento Extraído',
            days: analysis.days,
            extractedAt: Date.now()
          }
        });
        setSelectedFiles([]);
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
      const userRef = doc(db, 'users', user.uid);
      const sessionExercises: ActiveExercise[] = day.exercises.map(ex => ({
        ...ex,
        done: false
      }));

      await updateDoc(userRef, {
        activeWorkoutSession: {
          dayName: day.name,
          startedAt: Date.now(),
          exercises: sessionExercises
        }
      });
      
      setExpandedDay(null);
      setExpandedExercises({});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Error starting workout:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/activeWorkoutSession`);
    }
  };

  const handleToggleExercise = async (index: number) => {
    if (!user || !activeSession) return;
    try {
      const updatedExercises = [...activeSession.exercises];
      updatedExercises[index] = {
        ...updatedExercises[index],
        done: !updatedExercises[index].done
      };

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        activeWorkoutSession: {
          ...activeSession,
          exercises: updatedExercises
        }
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('Error toggling exercise:', err);
    }
  };

  const handleFinishWorkout = () => {
    if (!user) return;
    Alert.alert(
      'Terminar Entrenamiento',
      '¿Estás seguro de que deseas finalizar la rutina de hoy?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Terminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                activeWorkoutSession: null
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('¡Excelente Trabajo!', 'Tu entrenamiento ha sido guardado. ¡Sigue así!');
            } catch (err) {
              console.error('Error clearing workout session:', err);
            }
          }
        }
      ]
    );
  };

  const toggleExerciseExpand = (exerciseName: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseName]: !prev[exerciseName]
    }));
  };

  // 0. SKELETON LOADING VIEW (While fetching user profile/active session from Firestore)
  if (authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.activeHeader}>
          <View style={{ gap: 8, flex: 1 }}>
            <Skeleton width={180} height={26} borderRadius={6} />
            <Skeleton width={120} height={16} borderRadius={4} />
          </View>
          <Skeleton width={80} height={32} borderRadius={16} />
        </View>

        <ScrollView style={styles.container} contentContainerStyle={styles.activeContent}>
          <View style={styles.exercisesList}>
            {[1, 2, 3].map((key) => (
              <View key={key} style={[styles.exerciseCard, { padding: 16, gap: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Skeleton width={24} height={24} borderRadius={6} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="70%" height={16} borderRadius={4} />
                    <Skeleton width="40%" height={12} borderRadius={4} />
                  </View>
                  <Skeleton width={20} height={20} borderRadius={10} />
                </View>
              </View>
            ))}
          </View>
          <Skeleton height={50} borderRadius={16} style={{ marginTop: 24 }} />
        </ScrollView>
      </View>
    );
  }

  // 1. ACTIVE WORKOUT VIEW
  if (activeSession) {
    return (
      <View style={styles.container}>
        <View style={styles.activeHeader}>
          <View style={styles.activeTitleContainer}>
            <Text style={styles.activeTitle}>Entrenamiento Activo</Text>
            <Text style={styles.activeSubtitle}>{activeSession.dayName}</Text>
          </View>
          <View style={styles.timerBadge}>
            <Clock size={16} color={Theme.colors.primary} />
            <Text style={styles.timerText}>{elapsedTime}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.activeContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.exercisesList}>
            {activeSession.exercises.map((exercise, idx) => {
              const isExpanded = !!expandedExercises[exercise.name];
              const isDone = exercise.done;

              return (
                <View key={idx} style={[styles.exerciseCard, isDone ? styles.exerciseCardDone : null]}>
                  <View style={styles.exerciseHeader}>
                    <Pressable
                      style={styles.checkboxContainer}
                      onPress={() => handleToggleExercise(idx)}
                    >
                      <View style={[styles.checkbox, isDone ? styles.checkboxChecked : null]}>
                        {isDone && <Check size={14} color={Theme.colors.onPrimary} />}
                      </View>
                    </Pressable>

                    <Pressable
                      style={styles.exerciseHeaderMiddle}
                      onPress={() => toggleExerciseExpand(exercise.name)}
                    >
                      <Text style={[styles.exerciseName, isDone ? styles.exerciseTextDone : null]}>
                        {exercise.name}
                      </Text>
                      <Text style={styles.exerciseSpecs}>
                        {exercise.sets} series x {exercise.reps} reps
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => toggleExerciseExpand(exercise.name)}
                      style={styles.expandArrowBtn}
                    >
                      {isExpanded ? (
                        <ChevronUp size={20} color={Theme.colors.onSurfaceVariant} />
                      ) : (
                        <ChevronDown size={20} color={Theme.colors.onSurfaceVariant} />
                      )}
                    </Pressable>
                  </View>

                  {isExpanded && (
                    <View style={styles.exerciseDetails}>
                      <View style={styles.divider} />
                      <Text style={styles.exerciseDescTitle}>Técnica / Forma</Text>
                      <Text style={styles.exerciseDescription}>{exercise.description}</Text>

                      {(() => {
                        const exerciseKey = exercise.name.toLowerCase().trim();
                        const prRecord = prWeights[exerciseKey];
                        return (
                          <View style={styles.prSection}>
                            <View style={styles.prInfo}>
                              <Trophy size={14} color={prRecord ? "#e9c46a" : Theme.colors.onSurfaceVariant} />
                              <Text style={styles.prLabel}>
                                {prRecord ? (
                                  <>
                                    Récord: <Text style={styles.prValue}>{prRecord.weight} kg</Text>
                                  </>
                                ) : (
                                  "Sin récord registrado"
                                )}
                              </Text>
                            </View>
                            <Pressable
                              style={styles.addPrBtn}
                              onPress={() => {
                                setDialogInitialData({
                                  id: '',
                                  userId: user?.uid || '',
                                  exercise: exercise.name,
                                  weight: 0,
                                  date: new Date().toISOString(),
                                  muscleGroups: exercise.muscleGroups || []
                                });
                                setIsRecordDialogOpen(true);
                              }}
                            >
                              <Plus size={12} color={Theme.colors.primary} />
                              <Text style={styles.addPrBtnText}>PR</Text>
                            </Pressable>
                          </View>
                        );
                      })()}
                      
                      <Pressable
                        style={styles.youtubeButton}
                        onPress={() => openYouTubeSearch(exercise.name)}
                      >
                        <Play size={14} color={Theme.colors.onSecondary} fill={Theme.colors.onSecondary} />
                        <Text style={styles.youtubeButtonText}>Ver en YouTube</Text>
                        <ExternalLink size={12} color={Theme.colors.onSecondary} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Terminar Button */}
          <Pressable
            style={styles.finishBtn}
            onPress={handleFinishWorkout}
          >
            <Square size={14} color="#ffffff" fill="#ffffff" />
            <Text style={styles.finishBtnText}>Terminar Entrenamiento</Text>
          </Pressable>
        </ScrollView>

        <RecordDialog
          isOpen={isRecordDialogOpen}
          onClose={() => setIsRecordDialogOpen(false)}
          initialData={dialogInitialData}
        />
      </View>
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
      {(!currentPlan || selectedFiles.length > 0) && !loading && (
        <View style={styles.onboardingCard}>
          <View style={styles.uploadOptions}>
            <Pressable style={styles.uploadOption} onPress={pickDocument}>
              <Upload size={32} color={Theme.colors.primary} />
              <Text style={styles.optionTitle}>Subir Rutina en PDF</Text>
              <Text style={styles.optionSubtitle}>Documento de texto o archivo PDF</Text>
            </Pressable>

            <View style={styles.row}>
              <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={pickImages}>
                <ImageIcon size={24} color={Theme.colors.primary} />
                <Text style={styles.optionTitleSmall}>Galería (Fotos)</Text>
              </Pressable>

              <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={takePhoto}>
                <Camera size={24} color={Theme.colors.primary} />
                <Text style={styles.optionTitleSmall}>Cámara</Text>
              </Pressable>
            </View>
          </View>

          {/* Accumulated files display */}
          {selectedFiles.length > 0 && (
            <View style={styles.selectedFilesBox}>
              <Text style={styles.selectedFilesHeader}>Archivos a enviar ({selectedFiles.length}):</Text>
              {selectedFiles.map((file, idx) => (
                <View key={idx} style={styles.fileChip}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Pressable onPress={() => removeFile(idx)} style={styles.deleteFileBtn}>
                    <Trash2 size={16} color={Theme.colors.error} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                style={styles.processBtn}
                onPress={handleUploadAll}
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
          
          {!currentPlan && selectedFiles.length === 0 && (
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
      )}

      {currentPlan && selectedFiles.length === 0 && (
        <View style={styles.planContent}>
          {/* Plan Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryTitleRow}>
                <CheckCircle2 size={18} color={Theme.colors.primary} />
                <Text style={styles.summaryTitle}>{currentPlan.name}</Text>
              </View>
              <Text style={styles.summaryDate}>
                {new Date(currentPlan.extractedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <Text style={styles.summaryAdvice}>
              Rutina digitalizada y lista para entrenar. Selecciona un día para comenzar a registrar tu fuerza.
            </Text>
          </View>

          {/* Days Accordion */}
          {currentPlan.days && currentPlan.days.length > 0 && (
            <View style={styles.daysSection}>
              <Text style={styles.sectionHeading}>Días de Entrenamiento</Text>
              {currentPlan.days.map((day: WorkoutDay, idx: number) => {
                const isExpanded = expandedDay === day.name;
                return (
                  <View key={idx} style={styles.categoryCard}>
                    <Pressable
                      onPress={() => setExpandedDay(isExpanded ? null : day.name)}
                      style={styles.categoryHeader}
                    >
                      <Text style={styles.categoryTitle}>{day.name}</Text>
                      {isExpanded ? <ChevronUp size={20} color={Theme.colors.primary} /> : <ChevronDown size={20} color={Theme.colors.onSurfaceVariant} />}
                    </Pressable>

                    {isExpanded && (
                      <View style={styles.dayExercisesList}>
                        {day.exercises.map((exercise, optIdx) => (
                          <View key={optIdx} style={styles.simpleExerciseItem}>
                            <View style={styles.exerciseDot} />
                            <View style={styles.simpleExerciseMeta}>
                              <Text style={styles.simpleExerciseName}>{exercise.name}</Text>
                              <Text style={styles.simpleExerciseSpecs}>
                                {exercise.sets} series x {exercise.reps} reps
                              </Text>
                            </View>
                          </View>
                        ))}

                        {/* Iniciar Button */}
                        <Pressable
                          style={styles.startWorkoutBtn}
                          onPress={() => handleStartWorkout(day)}
                        >
                          <Play size={14} color={Theme.colors.onPrimary} fill={Theme.colors.onPrimary} />
                          <Text style={styles.startWorkoutBtnText}>Iniciar Entrenamiento</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
  loadingBox: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 48,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.onSurfaceVariant,
  },
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
  planContent: {
    gap: 20,
  },
  summaryCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '33',
    padding: 20,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  summaryTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.primary,
    flex: 1,
  },
  summaryDate: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  summaryAdvice: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  daysSection: {
    gap: 12,
  },
  sectionHeading: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  categoryCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  categoryTitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  dayExercisesList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  simpleExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  exerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.primary,
  },
  simpleExerciseMeta: {
    flex: 1,
  },
  simpleExerciseName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  simpleExerciseSpecs: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  startWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  startWorkoutBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onPrimary,
  },

  // Active workout styles
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  activeTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  activeTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  activeSubtitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  timerText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  activeContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100, // tab bar clearance
    gap: 20,
  },
  exercisesList: {
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    overflow: 'hidden',
  },
  exerciseCardDone: {
    borderColor: Theme.colors.primary + '33',
    backgroundColor: Theme.colors.surfaceContainerLow,
    opacity: 0.8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxContainer: {
    padding: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.onSurfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary,
  },
  exerciseHeaderMiddle: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  exerciseTextDone: {
    textDecorationLine: 'line-through',
    color: Theme.colors.onSurfaceVariant,
  },
  exerciseSpecs: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  expandArrowBtn: {
    padding: 4,
  },
  exerciseDetails: {
    marginTop: 12,
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginBottom: 4,
  },
  exerciseDescTitle: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    textTransform: 'uppercase',
    color: Theme.colors.primary,
    letterSpacing: 0.5,
  },
  exerciseDescription: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  youtubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  youtubeButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.onSurface,
  },
  finishBtn: {
    backgroundColor: '#dc2626', // consistent premium red for terminating
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 24, // margin bottom to clear bottom tab bar
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  finishBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: '#ffffff',
  },
  prSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginTop: 4,
  },
  prInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  prLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  prValue: {
    fontFamily: Theme.fonts.bodyBold,
    color: '#ffffff',
  },
  addPrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary + '1a',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '33',
  },
  addPrBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
});
