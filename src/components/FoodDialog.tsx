import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Alert } from '../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Camera, Image as ImageIcon, Plus, Trash2, Bookmark, AlertCircle, Check } from 'lucide-react-native';
import { Modal } from './Modal';
import { analyzeFoodImage, calculateMacrosFromIngredients } from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query } from 'firebase/firestore';
import { formatNum, getLocalDateString, readUriAsBase64 } from '../lib/utils';
import { Theme } from '../theme';
import { saveMealToHealthKit } from '../services/healthKitService';

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

interface FoodDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export const FoodDialog: React.FC<FoodDialogProps> = ({ isOpen, onClose, initialData }) => {
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'edit' | 'saving'>('upload');
  
  const [foodName, setFoodName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [macros, setMacros] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [savedMeals, setSavedMeals] = useState<any[]>([]);
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      if (initialData) {
        setFoodName(initialData.name || '');
        setIngredients(initialData.ingredients || []);
        setMacros(initialData.macros || null);
        setStep('edit');
        setSelectedImage(initialData.imageUrl ? { uri: initialData.imageUrl, mimeType: 'image/jpeg' } : null);
        setSaveAsFavorite(true);
      } else {
        setStep('upload');
        setFoodName('');
        setIngredients([]);
        setMacros(null);
        setSelectedImage(null);
        setSaveAsFavorite(false);
        setError(null);
      }

      const fetchSavedMeals = async () => {
        try {
          const q = query(collection(db, `users/${user.uid}/savedMeals`));
          const snap = await getDocs(q);
          setSavedMeals(snap.docs.map(d => d.data()));
        } catch (err) {
          console.error("Error fetching saved meals", err);
        }
      };
      fetchSavedMeals();
    }
  }, [user, isOpen, initialData]);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso Denegado', 'Se necesita acceso a la galería.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedImage({
          uri: asset.uri,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.error('Error selecting image', err);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
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
        const asset = res.assets[0];
        setSelectedImage({
          uri: asset.uri,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.error('Error taking photo', err);
      Alert.alert('Error', 'No se pudo tomar la foto.');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;
    setLoading(true);
    setError(null);
    try {
      const base64Data = await readUriAsBase64(selectedImage.uri);

      const result = await analyzeFoodImage(base64Data, selectedImage.mimeType);
      
      setFoodName(result.name || 'Comida Desconocida');
      setIngredients(result.ingredients || []);
      setMacros(result.macros || null);
      setStep('edit');
    } catch (err) {
      console.error("Error analyzing food:", err);
      setError("Error al analizar la imagen. Intenta de nuevo.");
      Alert.alert('Error', 'La IA no pudo analizar la imagen. Ingresa la comida de forma manual.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setFoodName('');
    setIngredients([]);
    setMacros(null);
    setError(null);
    setStep('edit');
  };

  const handleSelectSavedMeal = (meal: any) => {
    setFoodName(meal.name);
    setIngredients(meal.ingredients || []);
    setMacros(meal.macros || null);
    setError(null);
    setStep('edit');
  };

  const handleSave = async () => {
    if (!user) return;
    setStep('saving');
    setError(null);
    try {
      let finalMacros = macros;
      if (!finalMacros) {
        finalMacros = await calculateMacrosFromIngredients(ingredients);
      }
      
      if (saveAsFavorite && foodName.trim()) {
        const mealId = initialData?.id || Date.now().toString();
        await setDoc(doc(db, `users/${user.uid}/savedMeals`, mealId), {
          id: mealId,
          userId: user.uid,
          name: foodName.trim(),
          ingredients: ingredients,
          macros: finalMacros
        });
      }

      const today = getLocalDateString();
      const logId = today; 
      const logRef = doc(db, `users/${user.uid}/dailyLogs`, logId);
      
      const logDoc = await getDoc(logRef);
      
      const newMeal = {
        id: Date.now().toString(),
        name: foodName || 'Comida',
        time: new Date().toISOString(),
        macros: finalMacros,
        imageUrl: selectedImage?.uri || ''
      };

      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + 90); // 90 days TTL

      if (logDoc.exists()) {
        const currentData = logDoc.data();
        const currentMacros = currentData.macros || { protein: 0, carbs: 0, fats: 0, calories: 0 };
        
        await updateDoc(logRef, {
          macros: {
            protein: currentMacros.protein + (finalMacros.protein || 0),
            carbs: currentMacros.carbs + (finalMacros.carbs || 0),
            fats: currentMacros.fats + (finalMacros.fats || 0),
            calories: currentMacros.calories + (finalMacros.calories || 0)
          },
          meals: [...(currentData.meals || []), newMeal],
          expireAt
        });
      } else {
        await setDoc(logRef, {
          id: logId,
          userId: user.uid,
          date: new Date().toISOString(),
          macros: finalMacros,
          meals: [newMeal],
          expireAt
        });
      }

      // Sync to HealthKit
      saveMealToHealthKit(foodName || 'Comida', finalMacros).catch(err => {
        console.warn('[HealthKit] Error syncing meal from FoodDialog:', err);
      });

      onClose();
      // Reset state
      setSelectedImage(null);
      setStep('upload');
      setIngredients([]);
      setMacros(null);
      setSaveAsFavorite(false);
      setError(null);
    } catch (err: any) {
      console.error("Error saving meal:", err);
      setError("Hubo un error al registrar la comida. Por favor, intenta de nuevo.");
      setStep('edit');
      if (err?.message?.includes('Missing or insufficient permissions') || err?.message?.includes('permission-denied')) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/dailyLogs`);
      }
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { 
      ...newIngredients[index], 
      [field]: field === 'quantity' ? (parseFloat(value as string) || 0) : value 
    };
    setIngredients(newIngredients);
    setMacros(null); // Force recalculation if ingredients change
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: 0, unit: 'g' }]);
    setMacros(null); // Force recalculation
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
    setMacros(null); // Force recalculation
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Comida">
      {step === 'upload' && (
        <View style={styles.container}>
          {savedMeals.length > 0 && (
            <View style={styles.savedMealsSection}>
              <Text style={styles.sectionTitle}>
                <Bookmark size={14} color={Theme.colors.primary} /> Comidas Guardadas
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.savedMealsList}
              >
                {savedMeals.map((meal) => (
                  <Pressable
                    key={meal.id}
                    onPress={() => handleSelectSavedMeal(meal)}
                    style={styles.savedMealCard}
                  >
                    <Text style={styles.savedMealName} numberOfLines={1}>
                      {meal.name}
                    </Text>
                    <Text style={styles.savedMealCals}>
                      {formatNum(meal.macros?.calories || 0)} kcal
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {selectedImage ? (
            <View style={styles.selectedFileBox}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              <Pressable onPress={() => setSelectedImage(null)}>
                <Text style={styles.changeFileText}>Eliminar imagen</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <Pressable style={styles.uploadOption} onPress={takePhoto}>
                <Camera size={28} color={Theme.colors.primary} />
                <Text style={styles.optionTitle}>Tomar Foto del Plato</Text>
                <Text style={styles.optionSubtitle}>Cámara</Text>
              </Pressable>

              <Pressable style={styles.uploadOption} onPress={pickImage}>
                <ImageIcon size={28} color={Theme.colors.primary} />
                <Text style={styles.optionTitle}>Seleccionar de Galería</Text>
                <Text style={styles.optionSubtitle}>Fotos</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.footerButtons}>
            <Pressable style={styles.manualButton} onPress={handleManualEntry}>
              <Text style={styles.manualButtonText}>Entrada Manual</Text>
            </Pressable>

            <Pressable
              style={[styles.analyzeButton, (!selectedImage || loading) ? styles.disabledButton : null]}
              disabled={!selectedImage || loading}
              onPress={handleAnalyze}
            >
              {loading ? (
                <ActivityIndicator color={Theme.colors.onPrimary} />
              ) : (
                <Text style={styles.analyzeButtonText}>Analizar IA</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {step === 'edit' && (
        <View style={styles.container}>
          <Pressable style={styles.backButton} onPress={() => setStep('upload')}>
            <Text style={styles.backButtonText}>← Volver a subir imagen</Text>
          </Pressable>

          {error && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={Theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Nombre del Plato</Text>
            <TextInput
              value={foodName}
              onChangeText={setFoodName}
              style={styles.formInput}
              placeholder="Ej. Ensalada César"
              placeholderTextColor={Theme.colors.onSurfaceVariant}
            />
          </View>

          <View style={styles.ingredientsHeader}>
            <Text style={styles.sectionTitle}>Ingredientes</Text>
            <Pressable style={styles.addButton} onPress={addIngredient}>
              <Plus size={14} color={Theme.colors.primary} />
              <Text style={styles.addButtonText}>Añadir</Text>
            </Pressable>
          </View>

          <View style={styles.ingredientsList}>
            {ingredients.map((ing, idx) => (
              <View key={idx} style={styles.ingredientRow}>
                <TextInput
                  value={ing.name}
                  onChangeText={(val) => updateIngredient(idx, 'name', val)}
                  placeholder="Ingrediente"
                  placeholderTextColor={Theme.colors.onSurfaceVariant}
                  style={styles.ingNameInput}
                />
                <TextInput
                  value={ing.quantity > 0 ? ing.quantity.toString() : ''}
                  onChangeText={(val) => updateIngredient(idx, 'quantity', val)}
                  placeholder="Cant."
                  placeholderTextColor={Theme.colors.onSurfaceVariant}
                  keyboardType="numeric"
                  style={styles.ingQtyInput}
                />
                <TextInput
                  value={ing.unit}
                  onChangeText={(val) => updateIngredient(idx, 'unit', val)}
                  placeholder="Unid."
                  placeholderTextColor={Theme.colors.onSurfaceVariant}
                  style={styles.ingUnitInput}
                />
                <Pressable onPress={() => removeIngredient(idx)} style={styles.deleteButton}>
                  <Trash2 size={16} color={Theme.colors.error} />
                </Pressable>
              </View>
            ))}

            {ingredients.length === 0 && (
              <Text style={styles.emptyIngredients}>Añade ingredientes para calcular los macros.</Text>
            )}
          </View>

          <Pressable 
            style={styles.checkboxContainer}
            onPress={() => setSaveAsFavorite(!saveAsFavorite)}
          >
            <View style={[styles.checkbox, saveAsFavorite ? styles.checkboxChecked : null]}>
              {saveAsFavorite && <Check size={14} color={Theme.colors.onPrimary} />}
            </View>
            <Text style={styles.checkboxLabel}>Guardar en comidas frecuentes</Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={ingredients.length === 0 || !foodName}
            style={[styles.saveButton, (ingredients.length === 0 || !foodName) ? styles.disabledButton : null]}
          >
            <Text style={styles.saveButtonText}>Calcular Macros y Guardar</Text>
          </Pressable>
        </View>
      )}

      {step === 'saving' && (
        <View style={styles.savingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.savingText}>Calculando macros y guardando...</Text>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingVertical: 4,
  },
  savedMealsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Theme.fonts.label,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedMealsList: {
    gap: 10,
    paddingRight: 16,
  },
  savedMealCard: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    width: 130,
  },
  savedMealName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  savedMealCals: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  selectedFileBox: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  changeFileText: {
    fontFamily: Theme.fonts.label,
    fontSize: 12,
    color: Theme.colors.error,
  },
  uploadOptions: {
    gap: 8,
  },
  uploadOption: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  optionTitle: {
    fontFamily: Theme.fonts.label,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  optionSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  manualButton: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  analyzeButton: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  backButtonText: {
    fontFamily: Theme.fonts.label,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.errorContainer,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onError,
    flex: 1,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  formInput: {
    fontFamily: Theme.fonts.body,
    fontSize: 15,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  ingredientsList: {
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  ingNameInput: {
    flex: 1.5,
    minWidth: 0,
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    paddingVertical: 4,
  },
  ingQtyInput: {
    flex: 0.6,
    minWidth: 0,
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    textAlign: 'center',
    paddingVertical: 4,
  },
  ingUnitInput: {
    flex: 0.6,
    minWidth: 0,
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    textAlign: 'center',
    paddingVertical: 4,
  },
  deleteButton: {
    padding: 6,
  },
  emptyIngredients: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  checkboxLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  saveButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.onPrimary,
  },
  savingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 16,
  },
  savingText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
});
