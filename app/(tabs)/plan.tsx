import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Alert } from '../../src/lib/alert';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Upload, Camera, Image as ImageIcon, ChevronDown, ChevronUp, Plus, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { analyzeNutritionPlan, calculateMacrosFromIngredients } from '../../src/services/geminiService';
import { useAuth } from '../../src/hooks/useAuth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../src/firebase';
import { formatNum, getLocalDateString, readUriAsBase64 } from '../../src/lib/utils';
import { DailyLog, Meal } from '../../src/types';
import { SavedMealsSection } from '../../src/components/SavedMealsSection';
import { FoodDialog } from '../../src/components/FoodDialog';
import { Theme } from '../../src/theme';
import { useHeaderScroll } from './_layout';
import { saveMealToHealthKit } from '../../src/services/healthKitService';

export default function PlanScreen() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setScrolled, setGlobalLoading, setGlobalLoadingMessage } = useHeaderScroll();

  // Reset scroll status when navigating away
  useEffect(() => {
    return () => setScrolled(false);
  }, [setScrolled]);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});
  const [loggingMeal, setLoggingMeal] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<any | null>(null);
  const [isFoodDialogOpen, setIsFoodDialogOpen] = useState(false);

  const currentPlan = profile?.nutritionalPlan;

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        handleUpload(res.assets[0].uri, res.assets[0].mimeType || 'application/octet-stream');
      }
    } catch (err) {
      console.error('Error picking document', err);
      setError('No se pudo seleccionar el archivo.');
    }
  };

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
        handleUpload(res.assets[0].uri, res.assets[0].mimeType || 'image/jpeg');
      }
    } catch (err) {
      console.error('Error picking image', err);
      setError('No se pudo seleccionar la imagen.');
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
        handleUpload(res.assets[0].uri, res.assets[0].mimeType || 'image/jpeg');
      }
    } catch (err) {
      console.error('Error taking photo', err);
      setError('No se pudo tomar la foto.');
    }
  };

  const handleUpload = async (uri: string, mimeType: string) => {
    if (!user) return;
    setLoading(true);
    setGlobalLoading(true);
    setGlobalLoadingMessage('Analizando plan nutricional con Pive AI...');
    setError(null);

    try {
      const base64Data = await readUriAsBase64(uri);

      const analysis = await analyzeNutritionPlan({
        base64Data,
        mimeType,
      });

      if (analysis.protein && analysis.carbs && analysis.fats) {
        await setDoc(doc(db, 'users', user.uid), {
          macroGoals: {
            protein: analysis.protein,
            carbs: analysis.carbs,
            fats: analysis.fats,
            calories: analysis.calories
          },
          nutritionalPlan: {
            name: analysis.name || 'Plan Extraído',
            calories: analysis.calories,
            protein: analysis.protein,
            carbs: analysis.carbs,
            fats: analysis.fats,
            advice: analysis.advice || '',
            meals: analysis.meals || [],
            extractedAt: Date.now()
          }
        }, { merge: true });

        Alert.alert('¡Plan Extraído!', 'Tu plan nutricional ha sido analizado y guardado con éxito.');
      } else {
        throw new Error('El análisis no devolvió datos estructurados de macros.');
      }
    } catch (err: any) {
      console.error('Error analyzing document:', err);
      setError('Error al analizar el archivo. Intenta con otra imagen o PDF.');
      Alert.alert('Análisis fallido', 'No pudimos estructurar el plan. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleRegisterMeal = async (categoryType: string, option: any) => {
    if (!user) return;
    const mealKey = `${categoryType}-${option.title}`;
    setLoggingMeal(mealKey);
    try {
      let macros = option.macros;
      if (!macros) {
        macros = await calculateMacrosFromIngredients(option.ingredients);
      }
      
      const newMeal: Meal = {
        id: Date.now().toString(),
        name: option.title,
        time: new Date().toISOString(),
        macros: {
          protein: macros?.protein || 0,
          carbs: macros?.carbs || 0,
          fats: macros?.fats || 0,
          calories: macros?.calories || 0
        }
      };

      const today = getLocalDateString();
      const logRef = doc(db, `users/${user.uid}/dailyLogs`, today);
      const logSnap = await getDoc(logRef);
      
      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + 90); // 90 days TTL

      if (logSnap.exists()) {
        const currentLog = logSnap.data() as DailyLog;
        await updateDoc(logRef, {
          meals: [...currentLog.meals, newMeal],
          macros: {
            calories: currentLog.macros.calories + newMeal.macros.calories,
            protein: currentLog.macros.protein + newMeal.macros.protein,
            carbs: currentLog.macros.carbs + newMeal.macros.carbs,
            fats: currentLog.macros.fats + newMeal.macros.fats,
          },
          expireAt
        });
      } else {
        await setDoc(logRef, {
          id: today,
          userId: user.uid,
          date: new Date().toISOString(),
          macros: newMeal.macros,
          meals: [newMeal],
          expireAt
        });
      }
      
      // Sync to HealthKit
      saveMealToHealthKit(newMeal.name, newMeal.macros).catch(err => {
        console.warn('[HealthKit] Error syncing meal from plan.tsx:', err);
      });

      setLoggingMeal(`${mealKey}-success`);
      setTimeout(() => setLoggingMeal(null), 2000);
    } catch (err: any) {
      console.error("Error registering meal:", err);
      setError("Hubo un error al registrar la comida. Por favor, intenta de nuevo.");
      setLoggingMeal(null);
      if (err?.message?.includes('Missing or insufficient permissions') || err?.message?.includes('permission-denied')) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/dailyLogs`);
      }
    }
  };

  const toggleOption = (optionKey: string) => {
    setExpandedOptions(prev => ({
      ...prev,
      [optionKey]: !prev[optionKey]
    }));
  };

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
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={styles.title}>Tu <Text style={styles.highlightText}>Plan</Text></Text>
          <Text style={styles.subtitle}>Nutrición estructurada con Pive AI.</Text>
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



      {!currentPlan && !loading && (
        <View style={styles.onboardingCard}>
          <View style={styles.uploadOptions}>
            <Pressable style={styles.uploadOption} onPress={pickDocument}>
              <Upload size={32} color={Theme.colors.primary} />
              <Text style={styles.optionTitle}>Subir Plan Nutricional</Text>
              <Text style={styles.optionSubtitle}>PDF o Documento de texto</Text>
            </Pressable>

            <View style={styles.row}>
              <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={pickImage}>
                <ImageIcon size={24} color={Theme.colors.primary} />
                <Text style={styles.optionTitleSmall}>Galería</Text>
              </Pressable>

              <Pressable style={[styles.uploadOption, styles.halfOption]} onPress={takePhoto}>
                <Camera size={24} color={Theme.colors.primary} />
                <Text style={styles.optionTitleSmall}>Cámara</Text>
              </Pressable>
            </View>
          </View>
          
          <View style={styles.instructionsSection}>
            <Text style={styles.instructionsTitle}>¿Cómo funciona?</Text>
            <View style={styles.instructionStep}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>Sube la foto o el PDF del plan que te dio tu nutriólogo.</Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>Pive extraerá automáticamente los macronutrientes y las comidas.</Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepText}>Tus metas diarias se configurarán y podrás registrar comidas con un solo toque.</Text>
            </View>
          </View>
        </View>
      )}

      {currentPlan && (
        <View style={styles.planContent}>
          {/* Plan Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryTitleRow}>
                <CheckCircle2 size={18} color={Theme.colors.primary} />
                <Text style={styles.summaryTitle}>Plan Extraído</Text>
              </View>
              <Text style={styles.summaryDate}>
                {new Date(currentPlan.extractedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </Text>
            </View>

            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStatItem}>
                <Text style={styles.statLabel}>Calorías</Text>
                <Text style={styles.statValue}>{formatNum(currentPlan.calories)} kcal</Text>
              </View>
              
              <View style={styles.summaryMacrosGrid}>
                <View style={[styles.macroItem, { borderBottomColor: Theme.colors.tertiary }]}>
                  <Text style={styles.macroLabel}>Prot</Text>
                  <Text style={styles.macroValue}>{formatNum(currentPlan.protein)}g</Text>
                </View>
                <View style={[styles.macroItem, { borderBottomColor: Theme.colors.secondary }]}>
                  <Text style={styles.macroLabel}>Carb</Text>
                  <Text style={styles.macroValue}>{formatNum(currentPlan.carbs)}g</Text>
                </View>
                <View style={[styles.macroItem, { borderBottomColor: Theme.colors.primary }]}>
                  <Text style={styles.macroLabel}>Grasa</Text>
                  <Text style={styles.macroValue}>{formatNum(currentPlan.fats)}g</Text>
                </View>
              </View>
            </View>

            {currentPlan.advice ? (
              <View style={styles.summaryAdvice}>
                <Text style={styles.adviceText}>{`"${currentPlan.advice}"`}</Text>
              </View>
            ) : null}
          </View>

          {/* Meals Categories Accordion */}
          {currentPlan.meals && currentPlan.meals.length > 0 && (
            <View style={styles.mealCategoriesSection}>
              <Text style={styles.sectionHeading}>Opciones de Comida</Text>
              {currentPlan.meals.map((category: any, idx: number) => {
                const isCatExpanded = expandedMeal === category.type;
                return (
                  <View key={idx} style={styles.categoryCard}>
                    <Pressable
                      onPress={() => setExpandedMeal(isCatExpanded ? null : category.type)}
                      style={styles.categoryHeader}
                    >
                      <Text style={styles.categoryTitle}>{category.type}</Text>
                      {isCatExpanded ? <ChevronUp size={20} color={Theme.colors.primary} /> : <ChevronDown size={20} color={Theme.colors.onSurfaceVariant} />}
                    </Pressable>

                    {isCatExpanded && (
                      <View style={styles.categoryOptionsList}>
                        {category.options.map((option: any, optIdx: number) => {
                          const optionKey = `${category.type}-${optIdx}`;
                          const isOptExpanded = expandedOptions[optionKey];
                          const isLogging = loggingMeal === `${category.type}-${option.title}`;
                          const isSuccess = loggingMeal === `${category.type}-${option.title}-success`;

                          return (
                            <View key={optIdx} style={styles.optionCard}>
                              <View style={styles.optionHeader}>
                                <Pressable
                                  onPress={() => toggleOption(optionKey)}
                                  style={styles.optionHeaderLeft}
                                >
                                  <View style={styles.optionNum}>
                                    <Text style={styles.optionNumText}>{optIdx + 1}</Text>
                                  </View>
                                  <Text style={styles.optionTitleText} numberOfLines={2}>
                                    {option.title}
                                  </Text>
                                  {isOptExpanded ? <ChevronUp size={16} color={Theme.colors.onSurfaceVariant} /> : <ChevronDown size={16} color={Theme.colors.onSurfaceVariant} />}
                                </Pressable>

                                <Pressable
                                  onPress={() => handleRegisterMeal(category.type, option)}
                                  disabled={isLogging || isSuccess}
                                  style={[
                                    styles.optionAddBtn,
                                    isSuccess ? styles.optionAddBtnSuccess : null
                                  ]}
                                >
                                  {isLogging ? (
                                    <ActivityIndicator size="small" color={Theme.colors.primary} />
                                  ) : isSuccess ? (
                                    <CheckCircle2 size={14} color="#22c55e" />
                                  ) : (
                                    <Plus size={14} color={Theme.colors.primary} />
                                  )}
                                  <Text style={[styles.optionAddBtnText, isSuccess ? styles.optionAddBtnTextSuccess : null]}>
                                    {isLogging ? '...' : isSuccess ? 'Añadido' : 'Log'}
                                  </Text>
                                </Pressable>
                              </View>

                              {isOptExpanded && (
                                <View style={styles.optionDetails}>
                                  <View style={styles.ingredientsBox}>
                                    {option.ingredients.map((ing: any, ingIdx: number) => (
                                      <View key={ingIdx} style={styles.ingredientRow}>
                                        <Text style={styles.ingName}>{ing.name}</Text>
                                        <Text style={styles.ingQty}>{ing.quantity} {ing.unit}</Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Saved Meals Frequent List */}
      <SavedMealsSection 
        onRegister={(option) => handleRegisterMeal('Comida Guardada', option)}
        onEdit={(meal) => {
          setEditingMeal(meal);
          setIsFoodDialogOpen(true);
        }}
      />

      <FoodDialog 
        isOpen={isFoodDialogOpen}
        onClose={() => {
          setIsFoodDialogOpen(false);
          setEditingMeal(null);
        }}
        initialData={editingMeal}
      />
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
    paddingBottom: 100, // tab bar buffer spacing
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
    gap: 24,
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
    borderColor: Theme.colors.primary + '33', // 20% primary
    padding: 20,
    gap: 16,
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
  },
  summaryTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.primary,
  },
  summaryDate: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryStatItem: {
    width: '35%',
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  statLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 9,
    textTransform: 'uppercase',
    color: Theme.colors.onSurfaceVariant,
  },
  statValue: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  summaryMacrosGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  macroItem: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  macroLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 9,
    textTransform: 'uppercase',
    color: Theme.colors.onSurfaceVariant,
  },
  macroValue: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
    marginTop: 2,
  },
  summaryAdvice: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 12,
  },
  adviceText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    fontStyle: 'italic',
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  mealCategoriesSection: {
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
  categoryOptionsList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  optionCard: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    gap: 8,
  },
  optionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionNumText: {
    fontFamily: Theme.fonts.label,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  optionTitleText: {
    flex: 1,
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  optionAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary + '1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  optionAddBtnSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  optionAddBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  optionAddBtnTextSuccess: {
    color: '#22c55e',
  },
  optionDetails: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  ingredientsBox: {
    backgroundColor: Theme.colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ingName: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  ingQty: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '1a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
