import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StrengthRecord, BodyMetricsHistory } from '../types';
import { Trophy, TrendingUp, Zap, Dumbbell, Activity, Scale, Plus, Edit2, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { cn, formatNum } from '../lib/utils';
import { RecordDialog } from '../components/RecordDialog';

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'];

export const Stats: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<StrengthRecord[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<BodyMetricsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StrengthRecord | null>(null);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
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
        }
      };
      fetchData();
    }
  }, [user, isRecordDialogOpen]); // Refetch when dialog closes

  const handleDeleteRecord = async (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    if (!user || !window.confirm('¿Estás seguro de que quieres eliminar este récord?')) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/strengthRecords`, recordId));
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/strengthRecords/${recordId}`);
    }
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

  const metricsChartData = metricsHistory.map(m => {
    const weight = m.weight || 0;
    const bodyFat = m.bodyFat || 0;
    const muscleMass = m.muscleMass || 0;
    
    // If muscleMass is less than 100, we assume it's a percentage and calculate KG
    // If it's already a large number, we assume it's already in KG
    const muscleKg = muscleMass < 100 ? (weight * (muscleMass / 100)) : muscleMass;

    return {
      date: new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      weight: weight,
      bodyFat: bodyFat,
      muscleMass: muscleKg
    };
  });

  const CustomLabel = (props: any) => {
    const { x, y, value, index, dataLength, unit } = props;
    // Only show labels for first, middle, and last points to avoid clutter on mobile
    const shouldShow = index === 0 || index === dataLength - 1 || index === Math.floor(dataLength / 2);
    if (!shouldShow) return null;
    
    return (
      <text 
        x={x} 
        y={y - 10} 
        fill="#acabaa" 
        fontSize={10} 
        fontWeight="bold"
        textAnchor="middle"
      >
        {formatNum(value)}{unit}
      </text>
    );
  };

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between mb-2">
          <h1 className="font-headline font-black text-5xl tracking-tighter leading-none">
            Tus <span className="text-primary">Estadísticas</span>
          </h1>
          <div className="bg-surface-container rounded-full px-4 py-2 flex items-center gap-2">
            <Zap size={14} className="text-secondary fill-secondary" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Pive Elite</span>
          </div>
        </div>
        <p className="text-on-surface-variant text-lg max-w-md">Tu evolución capturada en datos. Supera tus límites.</p>
      </section>

      {/* Body Metrics Progression */}
      <section className="space-y-6">
        <h2 className="font-headline text-2xl flex items-center gap-2">
          <Scale className="text-primary" size={24} />
          Evolución Corporal
        </h2>

        <div className="bg-surface-container-high rounded-xl p-8 border border-primary/5">
          <h3 className="font-headline text-xl mb-8">Comparativa de Composición</h3>
          {metricsHistory.length > 1 ? (
            <div className="h-72 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsChartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="date" stroke="#acabaa" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#acabaa" fontSize={10} tickLine={false} axisLine={false} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    formatter={(value: string) => <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{value}</span>}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    name="Peso (kg)" 
                    stroke="#a68cff" 
                    strokeWidth={3} 
                    dot={{ fill: '#a68cff', r: 4 }} 
                    activeDot={{ r: 6 }}
                    label={<CustomLabel dataLength={metricsChartData.length} unit="kg" />}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="muscleMass" 
                    name="Músculo (kg)" 
                    stroke="#00daf3" 
                    strokeWidth={3} 
                    dot={{ fill: '#00daf3', r: 4 }} 
                    activeDot={{ r: 6 }}
                    label={<CustomLabel dataLength={metricsChartData.length} unit="kg" />}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bodyFat" 
                    name="Grasa (%)" 
                    stroke="#ffb1c1" 
                    strokeWidth={3} 
                    dot={{ fill: '#ffb1c1', r: 4 }} 
                    activeDot={{ r: 6 }}
                    label={<CustomLabel dataLength={metricsChartData.length} unit="%" />}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-on-surface-variant/40 border border-dashed border-outline-variant/20 rounded-lg">
              <Activity size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest">Registra tu composición para ver la gráfica</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-2xl flex items-center gap-2">
            <Dumbbell className="text-primary" size={24} />
            Fuerza y Récords
          </h2>
          <button 
            onClick={() => {
              setEditingRecord(null);
              setIsRecordDialogOpen(true);
            }}
            className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors"
          >
            <Plus size={16} /> Añadir Récord
          </button>
        </div>

        <div className="space-y-6">
          {ALL_GROUPS.map(group => {
            const groupRecords = recordsByMuscleGroup[group];
            const exercises = Object.keys(groupRecords);
            
            if (exercises.length === 0) return null;

            return (
              <div key={group} className="bg-surface-container-low rounded-2xl p-6 border border-primary/5">
                <h3 className="font-headline text-xl mb-4 text-primary">{group}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {exercises.map((ex, idx) => {
                    const record = groupRecords[ex];
                    return (
                      <div key={ex} className="bg-surface-container rounded-xl p-4 border border-outline-variant/10 flex items-center gap-3 group hover:border-primary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold block truncate" title={ex}>{ex}</span>
                          <div className="flex items-baseline gap-1">
                            <span className="font-headline font-black text-2xl">{formatNum(record.weight)}</span>
                            <span className={cn("font-bold text-xs", idx % 2 === 0 ? "text-primary" : "text-secondary")}>KG</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingRecord(record);
                              setIsRecordDialogOpen(true);
                            }}
                            className="p-2 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                            aria-label="Editar récord"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteRecord(e, record.id)}
                            className="p-2 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            aria-label="Eliminar récord"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {records.length === 0 && (
            <div className="bg-surface-container rounded-2xl p-12 border border-dashed border-outline-variant/20 text-center flex flex-col items-center justify-center">
              <Dumbbell size={48} className="mb-4 text-on-surface-variant/20" />
              <p className="text-on-surface-variant font-bold mb-2">Aún no hay récords</p>
              <p className="text-sm text-on-surface-variant/60 max-w-xs mx-auto">Registra tus levantamientos máximos para ver tu progreso por grupo muscular.</p>
            </div>
          )}
        </div>
      </section>

      <RecordDialog 
        isOpen={isRecordDialogOpen} 
        onClose={() => {
          setIsRecordDialogOpen(false);
          setEditingRecord(null);
        }} 
        initialData={editingRecord}
      />
    </div>
  );
};
