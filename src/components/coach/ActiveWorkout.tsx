import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { ChevronDown, ChevronUp, Play, Clock, Check, ExternalLink, Trophy, Plus, Square } from 'lucide-react-native';
import { Theme } from '../../theme';
import { ActiveExercise, ActiveWorkoutSession, StrengthRecord } from '../../types';
import { openYouTubeSearch } from '../../lib/youtube';
import { RecordDialog } from '../RecordDialog';
import { Skeleton } from '../Skeleton';

// mm:ss since the session started, updated every second
function useElapsedTime(startedAt: number | undefined) {
  const [elapsedTime, setElapsedTime] = useState('--:--');

  useEffect(() => {
    if (!startedAt) {
      setElapsedTime('--:--');
      return;
    }

    const updateTimer = () => {
      const diffMs = Date.now() - startedAt;
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      setElapsedTime(formatted);
    };

    updateTimer(); // Run immediately on mount/update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return elapsedTime;
}

/** Placeholder with the active workout layout, shown while the profile loads. */
export function ActiveWorkoutSkeleton() {
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

interface ExerciseCardProps {
  exercise: ActiveExercise;
  isExpanded: boolean;
  personalRecord?: StrengthRecord;
  onToggleDone: () => void;
  onToggleExpand: () => void;
  onAddRecord: () => void;
}

function ExerciseCard({ exercise, isExpanded, personalRecord, onToggleDone, onToggleExpand, onAddRecord }: ExerciseCardProps) {
  const isDone = exercise.done;

  return (
    <View style={[styles.exerciseCard, isDone ? styles.exerciseCardDone : null]}>
      <View style={styles.exerciseHeader}>
        <Pressable
          style={styles.checkboxContainer}
          onPress={onToggleDone}
        >
          <View style={[styles.checkbox, isDone ? styles.checkboxChecked : null]}>
            {isDone && <Check size={14} color={Theme.colors.onPrimary} />}
          </View>
        </Pressable>

        <Pressable
          style={styles.exerciseHeaderMiddle}
          onPress={onToggleExpand}
        >
          <Text style={[styles.exerciseName, isDone ? styles.exerciseTextDone : null]}>
            {exercise.name}
          </Text>
          <Text style={styles.exerciseSpecs}>
            {exercise.sets} series x {exercise.reps} reps
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleExpand}
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

          <View style={styles.prSection}>
            <View style={styles.prInfo}>
              <Trophy size={14} color={personalRecord ? "#e9c46a" : Theme.colors.onSurfaceVariant} />
              <Text style={styles.prLabel}>
                {personalRecord ? (
                  <>
                    Récord: <Text style={styles.prValue}>{personalRecord.weight} kg</Text>
                    {personalRecord.reps !== undefined && (
                      <Text style={styles.prSubValue}> x {personalRecord.reps} {personalRecord.reps === 1 ? 'rep' : 'reps'}</Text>
                    )}
                    {personalRecord.isUnilateral && (
                      <Text style={styles.prUnilateralText}> (Unilateral)</Text>
                    )}
                  </>
                ) : (
                  "Sin récord registrado"
                )}
              </Text>
            </View>
            <Pressable
              style={styles.addPrBtn}
              onPress={onAddRecord}
            >
              <Plus size={12} color={Theme.colors.primary} />
              <Text style={styles.addPrBtnText}>PR</Text>
            </Pressable>
          </View>

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
}

interface ActiveWorkoutProps {
  session: ActiveWorkoutSession;
  // Heaviest record per exercise, keyed by the exercise name in lowercase
  personalRecords: Record<string, StrengthRecord>;
  userId?: string;
  onToggleExercise: (index: number) => void;
  onFinish: () => void;
}

/** The workout in progress: timer, exercises to check off and their personal records. */
export function ActiveWorkout({ session, personalRecords, userId, onToggleExercise, onFinish }: ActiveWorkoutProps) {
  const elapsedTime = useElapsedTime(session.startedAt);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [dialogInitialData, setDialogInitialData] = useState<any | null>(null);

  const toggleExerciseExpand = (exerciseName: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseName]: !prev[exerciseName]
    }));
  };

  const openRecordDialog = (exercise: ActiveExercise, personalRecord?: StrengthRecord) => {
    setDialogInitialData(
      personalRecord || {
        id: '',
        userId: userId || '',
        exercise: exercise.name,
        weight: 0,
        reps: 1,
        isUnilateral: false,
        date: new Date().toISOString(),
        muscleGroups: exercise.muscleGroups || []
      }
    );
    setIsRecordDialogOpen(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.activeHeader}>
        <View style={styles.activeTitleContainer}>
          <Text style={styles.activeTitle}>Entrenamiento Activo</Text>
          <Text style={styles.activeSubtitle}>{session.dayName}</Text>
        </View>
        <View style={styles.activeHeaderRight}>
          <View style={styles.timerBadge}>
            <Clock size={16} color={Theme.colors.primary} />
            <Text style={styles.timerText}>{elapsedTime}</Text>
          </View>
          <Pressable
            style={styles.finishHeaderBtn}
            onPress={onFinish}
          >
            <Square size={12} color="#ffffff" fill="#ffffff" />
            <Text style={styles.finishHeaderBtnText}>Terminar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.activeContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.exercisesList}>
          {session.exercises.map((exercise, idx) => {
            const personalRecord = personalRecords[exercise.name.toLowerCase().trim()];
            return (
              <ExerciseCard
                key={idx}
                exercise={exercise}
                isExpanded={!!expandedExercises[exercise.name]}
                personalRecord={personalRecord}
                onToggleDone={() => onToggleExercise(idx)}
                onToggleExpand={() => toggleExerciseExpand(exercise.name)}
                onAddRecord={() => openRecordDialog(exercise, personalRecord)}
              />
            );
          })}
        </View>

      </ScrollView>

      <RecordDialog
        isOpen={isRecordDialogOpen}
        onClose={() => setIsRecordDialogOpen(false)}
        initialData={dialogInitialData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
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
  activeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finishHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  finishHeaderBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
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
  prSubValue: {
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.onSurfaceVariant,
  },
  prUnilateralText: {
    fontFamily: Theme.fonts.label,
    color: Theme.colors.secondary,
    fontSize: 11,
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
