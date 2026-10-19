import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { ChevronDown, ChevronUp, Play, CheckCircle2 } from 'lucide-react-native';
import { Theme } from '../../theme';
import { WorkoutDay, WorkoutPlan } from '../../types';

interface WorkoutPlanDaysProps {
  plan: WorkoutPlan;
  onStartWorkout: (day: WorkoutDay) => void;
}

/** Summary of the saved plan and its days, each one expandable to start that workout. */
export function WorkoutPlanDays({ plan, onStartWorkout }: WorkoutPlanDaysProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  return (
    <View style={styles.planContent}>
      {/* Plan Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTitleRow}>
            <CheckCircle2 size={18} color={Theme.colors.primary} />
            <Text style={styles.summaryTitle}>{plan.name}</Text>
          </View>
          <Text style={styles.summaryDate}>
            {new Date(plan.extractedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
        <Text style={styles.summaryAdvice}>
          Rutina digitalizada y lista para entrenar. Selecciona un día para comenzar a registrar tu fuerza.
        </Text>
      </View>

      {/* Days Accordion */}
      {plan.days && plan.days.length > 0 && (
        <View style={styles.daysSection}>
          <Text style={styles.sectionHeading}>Días de Entrenamiento</Text>
          {plan.days.map((day: WorkoutDay, idx: number) => {
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
                      onPress={() => onStartWorkout(day)}
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
  );
}

const styles = StyleSheet.create({
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
});
