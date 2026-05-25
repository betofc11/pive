import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Modal } from './Modal';
import { Dumbbell, Plus } from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { StrengthRecord } from '../types';
import { Theme } from '../theme';

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'];

interface RecordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: StrengthRecord | null;
}

export const RecordDialog: React.FC<RecordDialogProps> = ({ isOpen, onClose, initialData }) => {
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
        setWeight(initialData.weight > 0 ? initialData.weight.toString() : '');
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
          if (initialData && initialData.exercise && !combined.includes(initialData.exercise)) {
            combined.push(initialData.exercise);
          }
          setRecentExercises(combined);
        } catch (err) {
          console.error("Error fetching exercises", err);
        }
      };
      fetchExercises();
    }
  }, [user, isOpen, initialData]);

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

  const isSaveDisabled = !weight || (isCustom && !customExercise.trim()) || selectedGroups.length === 0 || loading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData && initialData.id ? "Editar Récord" : "Nuevo Récord"}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Dumbbell size={36} color={Theme.colors.onSurface} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Ejercicio</Text>
          <View style={styles.chipContainer}>
            {recentExercises.map((ex) => (
              <Pressable
                key={ex}
                onPress={() => {
                  setExercise(ex);
                  setIsCustom(false);
                }}
                style={[
                  styles.chip,
                  !isCustom && exercise === ex ? styles.chipActive : null
                ]}
              >
                <Text 
                  style={[
                    styles.chipText,
                    !isCustom && exercise === ex ? styles.chipTextActive : null
                  ]}
                >
                  {ex}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setIsCustom(true)}
              style={[
                styles.chip,
                styles.chipWithIcon,
                isCustom ? styles.chipActive : null
              ]}
            >
              <Plus size={12} color={isCustom ? Theme.colors.onPrimary : Theme.colors.onSurfaceVariant} />
              <Text 
                style={[
                  styles.chipText,
                  isCustom ? styles.chipTextActive : null
                ]}
              >
                Otro
              </Text>
            </Pressable>
          </View>

          {isCustom && (
            <TextInput
              value={customExercise}
              onChangeText={setCustomExercise}
              style={styles.input}
              placeholder="Nombre del ejercicio..."
              placeholderTextColor={Theme.colors.onSurfaceVariant}
              autoFocus
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Grupos Musculares</Text>
          <View style={styles.chipContainer}>
            {MUSCLE_GROUPS.map((group) => (
              <Pressable
                key={group}
                onPress={() => toggleGroup(group)}
                style={[
                  styles.chip,
                  selectedGroups.includes(group) ? styles.chipActivePrimary : null
                ]}
              >
                <Text 
                  style={[
                    styles.chipText,
                    selectedGroups.includes(group) ? styles.chipTextActivePrimary : null
                  ]}
                >
                  {group}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Peso Levantado (kg)</Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            style={styles.weightInput}
            placeholder="0"
            placeholderTextColor={Theme.colors.onSurfaceVariant}
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={isSaveDisabled}
          style={[styles.saveButton, isSaveDisabled ? styles.disabledButton : null]}
        >
          {loading ? (
            <ActivityIndicator color={Theme.colors.onSurface} />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Récord</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingVertical: 4,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Theme.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  section: {
    gap: 8,
  },
  label: {
    fontFamily: Theme.fonts.label,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  chipWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipActive: {
    backgroundColor: Theme.colors.surfaceContainerHighest,
    borderColor: Theme.colors.primary,
  },
  chipActivePrimary: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  chipText: {
    fontFamily: Theme.fonts.label,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: Theme.colors.onSurface,
  },
  chipTextActivePrimary: {
    color: Theme.colors.onPrimary,
  },
  input: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  weightInput: {
    fontFamily: Theme.fonts.headline,
    fontSize: 32,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 16,
    textAlign: 'center',
  },
  saveButton: {
    width: '100%',
    backgroundColor: Theme.colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
