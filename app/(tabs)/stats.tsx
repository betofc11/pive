import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useAuth } from '../../src/hooks/useAuth';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../src/firebase';
import { StrengthRecord, BodyMetricsHistory } from '../../src/types';
import { Zap, Dumbbell, Activity, Scale, Plus, Edit2, Trash2 } from 'lucide-react-native';
import { formatNum } from '../../src/lib/utils';
import { Theme } from '../../src/theme';
import { RecordDialog } from '../../src/components/RecordDialog';
import Svg, { Path, Circle, Text as SvgText, Line as SvgLine, G } from 'react-native-svg';
import { useHeaderScroll } from './_layout';

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'];

export default function StatsScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<StrengthRecord[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<BodyMetricsHistory[]>([]);
  const { setScrolled } = useHeaderScroll();

  // Reset scroll status when navigating away
  useEffect(() => {
    return () => setScrolled(false);
  }, [setScrolled]);
  const [_loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StrengthRecord | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch Strength Records
      const strengthQ = query(
        collection(db, `users/${user.uid}/strengthRecords`),
        orderBy('date', 'desc')
      );
      const strengthSnap = await getDocs(strengthQ);
      setRecords(strengthSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as StrengthRecord)));

      // Fetch Body Metrics History
      const metricsQ = query(
        collection(db, `users/${user.uid}/bodyMetricsHistory`),
        orderBy('date', 'asc')
      );
      const metricsSnap = await getDocs(metricsQ);
      setMetricsHistory(metricsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as BodyMetricsHistory)));

    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/stats`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData, isRecordDialogOpen]); // Refetch when dialog closes

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleDeleteRecord = (recordId: string) => {
    if (!user) return;
    Alert.alert(
      'Eliminar Récord',
      '¿Estás seguro de que quieres eliminar este récord?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, `users/${user.uid}/strengthRecords`, recordId));
              setRecords(prev => prev.filter(r => r.id !== recordId));
            } catch (err) {
              handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/strengthRecords/${recordId}`);
            }
          }
        }
      ]
    );
  };

  const recordsByMuscleGroup: Record<string, Record<string, StrengthRecord>> = {};
  const ALL_GROUPS = [...MUSCLE_GROUPS, 'Sin clasificar'];
  
  ALL_GROUPS.forEach(group => {
    recordsByMuscleGroup[group] = {};
  });

  records.forEach(record => {
    const groups = record.muscleGroups && record.muscleGroups.length > 0 ? record.muscleGroups : ['Sin clasificar'];
    groups.forEach(group => {
      if (ALL_GROUPS.includes(group)) {
        if (!recordsByMuscleGroup[group][record.exercise] || record.weight > recordsByMuscleGroup[group][record.exercise].weight) {
          recordsByMuscleGroup[group][record.exercise] = record;
        }
      }
    });
  });

  // Chart Data Processing
  const metricsChartData = metricsHistory.map(m => {
    const weight = m.weight || 0;
    const bodyFat = m.bodyFat || 0;
    const muscleMass = m.muscleMass || 0;
    
    const muscleKg = muscleMass;

    // Simple date formatting
    let dateLabel = '';
    try {
      const dateObj = new Date(m.date);
      dateLabel = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } catch {
      dateLabel = '--';
    }

    return {
      date: dateLabel,
      weight: weight,
      bodyFat: bodyFat,
      muscleMass: muscleKg
    };
  });

  // Custom Chart Config
  const svgWidth = 340;
  const svgHeight = 220;
  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  let minY = 0;
  let maxY = 100;
  let getX = (index: number) => paddingLeft;
  let getY = (val: number) => paddingTop + chartHeight / 2;
  let yGridValues: number[] = [];

  if (metricsChartData.length > 1) {
    const weights = metricsChartData.map(d => d.weight);
    const muscles = metricsChartData.map(d => d.muscleMass);
    const fats = metricsChartData.map(d => d.bodyFat);
    const allValues = [...weights, ...muscles, ...fats];
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const yPadding = (dataMax - dataMin) * 0.15 || 5;
    minY = Math.max(0, dataMin - yPadding);
    maxY = dataMax + yPadding;

    getX = (index: number) => {
      return paddingLeft + (index / (metricsChartData.length - 1)) * chartWidth;
    };

    getY = (val: number) => {
      if (maxY === minY) return paddingTop + chartHeight / 2;
      return paddingTop + chartHeight - ((val - minY) / (maxY - minY)) * chartHeight;
    };

    // Calculate Y Grid points
    yGridValues = [0, 0.33, 0.66, 1].map(ratio => minY + ratio * (maxY - minY));
  }

  const renderChart = () => {
    if (metricsChartData.length <= 1) {
      return (
        <View style={styles.emptyChartContainer}>
          <Activity size={48} color={Theme.colors.onSurfaceVariant} style={{ opacity: 0.3, marginBottom: 12 }} />
          <Text style={styles.emptyChartText}>REGISTRA TU COMPOSICIÓN PARA VER LA GRÁFICA</Text>
        </View>
      );
    }

    const weightPoints = metricsChartData.map((d, i) => ({ x: getX(i), y: getY(d.weight) }));
    const musclePoints = metricsChartData.map((d, i) => ({ x: getX(i), y: getY(d.muscleMass) }));
    const fatPoints = metricsChartData.map((d, i) => ({ x: getX(i), y: getY(d.bodyFat) }));

    const getPathData = (points: { x: number; y: number }[]) => {
      if (points.length === 0) return '';
      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    };

    return (
      <View style={styles.chartWrapper}>
        <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Y-Axis Grid Lines & Labels */}
          {yGridValues.map((val, idx) => {
            const yPos = getY(val);
            return (
              <G key={`grid-${idx}`}>
                <SvgLine
                  x1={paddingLeft}
                  y1={yPos}
                  x2={svgWidth - paddingRight}
                  y2={yPos}
                  stroke={Theme.colors.border}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <SvgText
                  x={paddingLeft - 8}
                  y={yPos + 4}
                  fill={Theme.colors.onSurfaceVariant}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="end"
                >
                  {Math.round(val)}
                </SvgText>
              </G>
            );
          })}

          {/* X-Axis Date Labels */}
          {metricsChartData.map((d, idx) => {
            // Only draw label for first, middle, and last to avoid text collisions
            const isLabelVisible = 
              idx === 0 || 
              idx === metricsChartData.length - 1 || 
              idx === Math.floor(metricsChartData.length / 2);

            if (!isLabelVisible) return null;

            return (
              <SvgText
                key={`date-${idx}`}
                x={getX(idx)}
                y={svgHeight - 10}
                fill={Theme.colors.onSurfaceVariant}
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                {d.date}
              </SvgText>
            );
          })}

          {/* Weight Line (Purple) */}
          <Path
            d={getPathData(weightPoints)}
            fill="none"
            stroke={Theme.colors.primary}
            strokeWidth="3"
          />

          {/* Muscle Line (Cyan) */}
          <Path
            d={getPathData(musclePoints)}
            fill="none"
            stroke={Theme.colors.secondary}
            strokeWidth="3"
          />

          {/* Fat Line (Pink) */}
          <Path
            d={getPathData(fatPoints)}
            fill="none"
            stroke={Theme.colors.tertiary}
            strokeWidth="3"
          />

          {/* Dots and Labels */}
          {metricsChartData.map((d, i) => {
            const isLabelVisible = 
              i === 0 || 
              i === metricsChartData.length - 1 || 
              i === Math.floor(metricsChartData.length / 2);

            return (
              <G key={`dots-${i}`}>
                {/* Weight Dot */}
                <Circle cx={getX(i)} cy={getY(d.weight)} r="4" fill={Theme.colors.primary} />
                {isLabelVisible && (
                  <SvgText
                    x={getX(i)}
                    y={getY(d.weight) - 8}
                    fill={Theme.colors.onSurfaceVariant}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {formatNum(d.weight)}
                  </SvgText>
                )}

                {/* Muscle Dot */}
                <Circle cx={getX(i)} cy={getY(d.muscleMass)} r="4" fill={Theme.colors.secondary} />
                {isLabelVisible && (
                  <SvgText
                    x={getX(i)}
                    y={getY(d.muscleMass) - 8}
                    fill={Theme.colors.onSurfaceVariant}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {formatNum(d.muscleMass)}
                  </SvgText>
                )}

                {/* Fat Dot */}
                <Circle cx={getX(i)} cy={getY(d.bodyFat)} r="4" fill={Theme.colors.tertiary} />
                {isLabelVisible && (
                  <SvgText
                    x={getX(i)}
                    y={getY(d.bodyFat) - 8}
                    fill={Theme.colors.onSurfaceVariant}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {formatNum(d.bodyFat)}%
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          setScrolled(offsetY > 10);
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
            colors={[Theme.colors.primary]}
          />
        }
      >
        {/* Title Header */}
        <View style={styles.header}>
          <View style={styles.titleWrapper}>
            <Text style={[styles.title, { flex: 1, marginRight: 16 }]} numberOfLines={1} adjustsFontSizeToFit>
              Tus <Text style={styles.titleHighlight}>Estadísticas</Text>
            </Text>
            <View style={styles.premiumTag}>
              <Zap size={10} color={Theme.colors.onSecondary} fill={Theme.colors.onSecondary} />
              <Text style={styles.premiumTagText}>Pive Elite</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Tu evolución corporal y récords de fuerza en un solo lugar.</Text>
        </View>

        {/* Evolución Corporal */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Scale size={20} color={Theme.colors.primary} />
            <Text style={styles.sectionTitle}>Evolución Corporal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Comparativa de Composición</Text>
            {renderChart()}

            {/* Custom Legend */}
            {metricsChartData.length > 1 && (
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIndicator, { backgroundColor: Theme.colors.primary }]} />
                  <Text style={styles.legendText}>PESO (KG)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIndicator, { backgroundColor: Theme.colors.secondary }]} />
                  <Text style={styles.legendText}>MÚSCULO (KG)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIndicator, { backgroundColor: Theme.colors.tertiary }]} />
                  <Text style={styles.legendText}>GRASA (%)</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Fuerza y Récords */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Dumbbell size={20} color={Theme.colors.primary} />
            <Text style={styles.sectionTitle}>Fuerza y Récords</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                setEditingRecord(null);
                setIsRecordDialogOpen(true);
              }}
            >
              <Plus size={16} color={Theme.colors.primary} />
              <Text style={styles.addButtonText}>Añadir</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.recordsList}>
            {ALL_GROUPS.map(group => {
              const groupRecords = recordsByMuscleGroup[group];
              const exercises = Object.keys(groupRecords);
              
              if (exercises.length === 0) return null;

              return (
                <View key={group} style={styles.muscleGroupCard}>
                  <Text style={styles.muscleGroupName}>{group}</Text>
                  <View style={styles.exerciseGrid}>
                    {exercises.map((ex) => {
                      const record = groupRecords[ex];
                      return (
                        <View key={ex} style={styles.exerciseCard}>
                          <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseLabel} numberOfLines={1}>
                              {ex}
                            </Text>
                            <View style={styles.exerciseWeightRow}>
                              <Text style={styles.exerciseWeightValue}>{formatNum(record.weight)}</Text>
                              <Text style={styles.exerciseWeightUnit}>KG</Text>
                            </View>
                          </View>

                          <View style={styles.exerciseActions}>
                            <TouchableOpacity 
                              style={styles.actionButton}
                              onPress={() => {
                                setEditingRecord(record);
                                setIsRecordDialogOpen(true);
                              }}
                            >
                              <Edit2 size={12} color={Theme.colors.onSurfaceVariant} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.actionButton}
                              onPress={() => handleDeleteRecord(record.id)}
                            >
                              <Trash2 size={12} color={Theme.colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {records.length === 0 && (
              <View style={styles.emptyRecordsCard}>
                <Dumbbell size={40} color={Theme.colors.onSurfaceVariant} style={{ opacity: 0.2, marginBottom: 12 }} />
                <Text style={styles.emptyRecordsTitle}>Aún no hay récords</Text>
                <Text style={styles.emptyRecordsSubtitle}>Registra tus levantamientos máximos para ver tu progreso por grupo muscular.</Text>
              </View>
            )}
          </View>
        </View>
        
      </ScrollView>

      {/* Record Dialog */}
      <RecordDialog
        isOpen={isRecordDialogOpen}
        onClose={() => {
          setIsRecordDialogOpen(false);
          setEditingRecord(null);
        }}
        initialData={editingRecord}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100, // tab bar buffer spacing
  },
  header: {
    marginBottom: 28,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: Theme.fonts.headline,
    fontSize: 32,
    color: Theme.colors.onBackground,
    letterSpacing: -0.5,
  },
  titleHighlight: {
    color: Theme.colors.primary,
  },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.secondary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 99,
  },
  premiumTagText: {
    fontFamily: Theme.fonts.label,
    fontSize: 9,
    textTransform: 'uppercase',
    color: Theme.colors.onSecondary,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.onBackground,
  },
  addButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary + '1a', // 10% opacity
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
  },
  addButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: 16,
  },
  emptyChartContainer: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Theme.colors.outlineVariant + '44',
    borderRadius: 12,
  },
  emptyChartText: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -8,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Theme.fonts.label,
    fontSize: 9,
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  recordsList: {
    gap: 16,
  },
  muscleGroupCard: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 20,
    padding: 16,
  },
  muscleGroupName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.primary,
    marginBottom: 12,
  },
  exerciseGrid: {
    gap: 10,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    textTransform: 'uppercase',
    color: Theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  exerciseWeightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  exerciseWeightValue: {
    fontFamily: Theme.fonts.headline,
    fontSize: 22,
    color: Theme.colors.onSurface,
  },
  exerciseWeightUnit: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.primary,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecordsCard: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Theme.colors.outlineVariant + '44',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  emptyRecordsTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  emptyRecordsSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
