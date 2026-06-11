import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { Modal } from './Modal';
import { Dumbbell, Plus, Search, ChevronDown, Lock } from 'lucide-react-native';
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
  const [exercise, setExercise] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('1');
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentExercises, setRecentExercises] = useState<string[]>(['Sentadilla', 'Banca', 'Peso Muerto']);

  useEffect(() => {
    if (user && isOpen) {
      setShowSuggestions(false);
      if (initialData) {
        setExercise(initialData.exercise);
        setWeight(initialData.weight > 0 ? initialData.weight.toString() : '');
        setReps(initialData.reps ? initialData.reps.toString() : '1');
        setIsUnilateral(initialData.isUnilateral || false);
        setSelectedGroups(initialData.muscleGroups || []);
      } else {
        setExercise('');
        setWeight('');
        setReps('1');
        setIsUnilateral(false);
        setSelectedGroups([]);
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

  const filteredSuggestions = exercise.trim() === ''
    ? recentExercises
    : recentExercises.filter(ex => 
        ex.toLowerCase().includes(exercise.toLowerCase()) &&
        ex.toLowerCase() !== exercise.toLowerCase().trim()
      );

  const toggleGroup = (group: string) => {
    setShowSuggestions(false);
    setSelectedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const handleSave = async () => {
    if (!user || !weight || !exercise || selectedGroups.length === 0) return;
    
    setLoading(true);
    try {
      const recordPayload = {
        exercise: exercise.trim(),
        weight: parseFloat(weight),
        reps: reps ? parseInt(reps, 10) : 1,
        isUnilateral: isUnilateral,
        muscleGroups: selectedGroups,
      };

      if (initialData && initialData.id) {
        await updateDoc(doc(db, `users/${user.uid}/strengthRecords`, initialData.id), recordPayload);
      } else {
        await addDoc(collection(db, `users/${user.uid}/strengthRecords`), {
          ...recordPayload,
          userId: user.uid,
          date: new Date().toISOString()
        });
      }
      
      onClose();
      setWeight('');
      setReps('1');
      setIsUnilateral(false);
      setShowSuggestions(false);
      setSelectedGroups([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/strengthRecords`);
    } finally {
      setLoading(false);
    }
  };

  const isSaveDisabled = !weight || !reps || !exercise || selectedGroups.length === 0 || loading;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData && initialData.id ? "Editar Récord" : "Nuevo Récord"}
      scrollEnabled={!showSuggestions}
      footer={
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
      }
    >
      <Pressable 
        style={styles.container} 
        onPress={() => setShowSuggestions(false)}
        accessible={false}
      >
        <View style={styles.iconContainer}>
          <Dumbbell size={36} color={Theme.colors.onSurface} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Ejercicio</Text>
          {initialData ? (
            <View style={styles.disabledExerciseField}>
              <Text style={styles.disabledExerciseText}>{exercise}</Text>
              <Lock size={16} color={Theme.colors.onSurfaceVariant} style={styles.lockIcon} />
            </View>
          ) : (
            <View style={styles.dropdownContainer}>
              <TextInput
                value={exercise}
                onChangeText={(text) => {
                  setExercise(text);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Escribe o busca un ejercicio..."
                placeholderTextColor={Theme.colors.onSurfaceVariant}
                style={styles.exerciseInput}
              />

              {showSuggestions && filteredSuggestions.length > 0 && (
                <View style={styles.dropdownListContainer}>
                  <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredSuggestions.map((ex) => (
                      <Pressable
                        key={ex}
                        onPress={() => {
                          setExercise(ex);
                          setShowSuggestions(false);
                        }}
                        style={styles.dropdownItem}
                      >
                        <Text style={styles.dropdownItemText}>{ex}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
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

        <View style={styles.inputsRow}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Peso (kg)</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              style={styles.weightInput}
              placeholder="0"
              placeholderTextColor={Theme.colors.onSurfaceVariant}
              onFocus={() => setShowSuggestions(false)}
            />
          </View>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Repeticiones</Text>
            <TextInput
              value={reps}
              onChangeText={setReps}
              keyboardType="numeric"
              style={styles.weightInput}
              placeholder="1"
              placeholderTextColor={Theme.colors.onSurfaceVariant}
              onFocus={() => setShowSuggestions(false)}
            />
          </View>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleLabel}>Ejecución Unilateral</Text>
            <Text style={styles.toggleDescription}>Activar si el peso fue levantado usando un solo lado (ej: mancuernas)</Text>
          </View>
          <Switch
            value={isUnilateral}
            onValueChange={(val) => {
              setShowSuggestions(false);
              setIsUnilateral(val);
            }}
            trackColor={{ false: Theme.colors.surfaceContainerHighest, true: Theme.colors.primary }}
            thumbColor={isUnilateral ? '#ffffff' : Theme.colors.onSurfaceVariant}
            ios_backgroundColor={Theme.colors.surfaceContainerHighest}
          />
        </View>
      </Pressable>
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
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  exerciseInput: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedExerciseText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  placeholderText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  dropdownListContainer: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginTop: 8,
    maxHeight: 200,
    overflow: 'hidden',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
    paddingVertical: 10,
  },
  dropdownScrollView: {
    maxHeight: 150,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border + '1a',
  },
  dropdownItemText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  dropdownItemNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.primary + '0a',
  },
  dropdownItemNewText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.primary,
  },
  disabledExerciseField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.6,
  },
  disabledExerciseText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  lockIcon: {
    marginLeft: 8,
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
  },
  saveButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  disabledButton: {
    opacity: 0.5,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginTop: 4,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
    gap: 2,
  },
  toggleLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  toggleDescription: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 15,
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
  chipActivePrimary: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  chipText: {
    fontFamily: Theme.fonts.label,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  chipTextActivePrimary: {
    color: Theme.colors.onPrimary,
  },
});
