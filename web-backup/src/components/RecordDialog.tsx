import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Dumbbell, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { StrengthRecord } from '../types';

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'];

export const RecordDialog: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  initialData?: StrengthRecord | null;
}> = ({ isOpen, onClose, initialData }) => {
  const { user } = useAuth();
  const [exercise, setExercise] = useState('Sentadilla');
  const [isCustom, setIsCustom] = useState(false);
  const [customExercise, setCustomExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentExercises, setRecentExercises] = useState<string[]>(['Sentadilla', 'Banca', 'Peso Muerto']);

  useEffect(() => {
    if (user && isOpen) {
      if (initialData) {
        setExercise(initialData.exercise);
        setWeight(initialData.weight.toString());
        setSelectedGroups(initialData.muscleGroups || []);
        setIsCustom(false);
        setCustomExercise('');
      } else {
        setExercise('Sentadilla');
        setWeight('');
        setSelectedGroups([]);
        setIsCustom(false);
        setCustomExercise('');
      }

      const fetchExercises = async () => {
        try {
          const q = query(collection(db, `users/${user.uid}/strengthRecords`), orderBy('date', 'desc'));
          const snap = await getDocs(q);
          const unique = new Set<string>();
          snap.docs.forEach(doc => unique.add(doc.data().exercise));
          
          const combined = Array.from(new Set(['Sentadilla', 'Banca', 'Peso Muerto', ...Array.from(unique)]));
          setRecentExercises(combined);
        } catch (err) {
          console.error("Error fetching exercises", err);
        }
      };
      fetchExercises();
    }
  }, [user, isOpen]);

  const toggleGroup = (group: string) => {
    setSelectedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const handleSave = async () => {
    const finalExercise = isCustom ? customExercise.trim() : exercise;
    if (!user || !weight || !finalExercise || selectedGroups.length === 0) return;
    
    setLoading(true);
    try {
      if (initialData && initialData.id) {
        await updateDoc(doc(db, `users/${user.uid}/strengthRecords`, initialData.id), {
          exercise: finalExercise,
          weight: parseFloat(weight),
          muscleGroups: selectedGroups,
        });
      } else {
        await addDoc(collection(db, `users/${user.uid}/strengthRecords`), {
          userId: user.uid,
          exercise: finalExercise,
          weight: parseFloat(weight),
          muscleGroups: selectedGroups,
          date: new Date().toISOString()
        });
      }
      
      onClose();
      setWeight('');
      setCustomExercise('');
      setIsCustom(false);
      setSelectedGroups([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/strengthRecords`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Récord" : "Nuevo Récord"}>
      <div className="space-y-6">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface">
            <Dumbbell size={40} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Ejercicio</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {recentExercises.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setExercise(ex);
                    setIsCustom(false);
                  }}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition-colors ${
                    !isCustom && exercise === ex 
                      ? 'bg-surface-container-highest text-on-surface border-2 border-primary' 
                      : 'bg-surface-container-high text-on-surface-variant border-2 border-transparent hover:bg-surface-container-highest'
                  }`}
                >
                  {ex}
                </button>
              ))}
              <button
                onClick={() => setIsCustom(true)}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                  isCustom 
                    ? 'bg-surface-container-highest text-on-surface border-2 border-primary' 
                    : 'bg-surface-container-high text-on-surface-variant border-2 border-transparent hover:bg-surface-container-highest'
                }`}
              >
                <Plus size={14} /> Otro
              </button>
            </div>

            {isCustom && (
              <input
                type="text"
                value={customExercise}
                onChange={(e) => setCustomExercise(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors text-sm"
                placeholder="Nombre del ejercicio..."
                autoFocus
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Grupos Musculares</label>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map(group => (
                <button
                  key={group}
                  onClick={() => toggleGroup(group)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                    selectedGroups.includes(group) 
                      ? 'bg-primary text-on-primary' 
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Peso Levantado (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-4 focus:outline-none focus:border-primary transition-colors text-3xl font-black text-center"
              placeholder="0"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!weight || (isCustom && !customExercise.trim()) || selectedGroups.length === 0 || loading}
          className="w-full bg-surface-container-highest text-on-surface py-4 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Guardar Récord'}
        </button>
      </div>
    </Modal>
  );
};
