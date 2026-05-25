import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Bookmark, ChevronDown, ChevronUp, Plus, Trash2, Utensils, Edit2, CheckCircle2 } from 'lucide-react-native';
import { collection, query, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { formatNum } from '../lib/utils';
import { Theme } from '../theme';

interface SavedMeal {
  id: string;
  name: string;
  ingredients: any[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  imageUrl?: string;
}

interface SavedMealsSectionProps {
  onRegister: (meal: any) => Promise<void>;
  onEdit: (meal: SavedMeal) => void;
}

export const SavedMealsSection: React.FC<SavedMealsSectionProps> = ({ onRegister, onEdit }) => {
  const { user } = useAuth();
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, `users/${user.uid}/savedMeals`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meals = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SavedMeal[];
      setSavedMeals(meals);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = (mealId: string) => {
    if (!user) return;

    Alert.alert(
      'Eliminar Comida',
      '¿Estás seguro de que quieres eliminar esta comida guardada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, `users/${user.uid}/savedMeals`, mealId));
            } catch (err) {
              console.error("Error deleting saved meal:", err);
            }
          }
        }
      ]
    );
  };

  const handleRegister = async (meal: SavedMeal) => {
    setLoadingId(meal.id);
    try {
      const option = {
        title: meal.name,
        ingredients: meal.ingredients,
        macros: meal.macros
      };
      await onRegister(option);
      setSuccessId(meal.id);
      setTimeout(() => setSuccessId(null), 2000);
    } catch (err) {
      console.error("Error registering saved meal:", err);
    } finally {
      setLoadingId(null);
    }
  };

  if (savedMeals.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <View style={styles.iconWrapper}>
            <Bookmark size={18} color={Theme.colors.primary} />
          </View>
          <Text style={styles.title}>Comidas Guardadas</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{savedMeals.length}</Text>
          </View>
        </View>

        <Pressable 
          onPress={() => setIsExpanded(!isExpanded)}
          style={styles.expandButton}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? 'Ver menos' : 'Ver más'}
          </Text>
          {isExpanded ? <ChevronUp size={16} color={Theme.colors.primary} /> : <ChevronDown size={16} color={Theme.colors.primary} />}
        </Pressable>
      </View>

      {isExpanded && (
        <View style={styles.list}>
          {savedMeals.map((meal) => {
            const isMealExpanded = expandedMealId === meal.id;
            const isLogging = loadingId === meal.id;
            const isSuccess = successId === meal.id;

            return (
              <View key={meal.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Pressable 
                    onPress={() => setExpandedMealId(isMealExpanded ? null : meal.id)}
                    style={styles.cardHeaderLeft}
                  >
                    <View style={styles.mealIcon}>
                      <Utensils size={16} color={Theme.colors.primary} />
                    </View>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                      <Text style={styles.mealSub}>
                        {formatNum(meal.macros.calories)} kcal  |  P: {formatNum(meal.macros.protein)}g
                      </Text>
                    </View>
                    {isMealExpanded ? <ChevronUp size={16} color={Theme.colors.onSurfaceVariant} /> : <ChevronDown size={16} color={Theme.colors.onSurfaceVariant} />}
                  </Pressable>
                  
                  <View style={styles.actions}>
                    <Pressable 
                      onPress={() => handleRegister(meal)}
                      disabled={isLogging || isSuccess}
                      style={[
                        styles.registerBtn,
                        isSuccess ? styles.registerBtnSuccess : null
                      ]}
                    >
                      {isLogging ? (
                        <ActivityIndicator size="small" color={Theme.colors.primary} />
                      ) : isSuccess ? (
                        <CheckCircle2 size={14} color="#22c55e" />
                      ) : (
                        <Plus size={14} color={Theme.colors.primary} />
                      )}
                      <Text 
                        style={[
                          styles.registerBtnText,
                          isSuccess ? styles.registerBtnTextSuccess : null
                        ]}
                      >
                        {isLogging ? '...' : isSuccess ? 'Añadido' : 'Añadir'}
                      </Text>
                    </Pressable>
                    
                    <Pressable 
                      onPress={() => onEdit(meal)}
                      style={styles.actionIconBtn}
                    >
                      <Edit2 size={15} color={Theme.colors.onSurfaceVariant} />
                    </Pressable>

                    <Pressable 
                      onPress={() => handleDelete(meal.id)}
                      style={styles.actionIconBtn}
                    >
                      <Trash2 size={15} color={Theme.colors.error} />
                    </Pressable>
                  </View>
                </View>

                {isMealExpanded && (
                  <View style={styles.details}>
                    <View style={styles.macrosGrid}>
                      <View style={styles.macroPill}>
                        <Text style={styles.macroPillLabel}>Carbs</Text>
                        <Text style={styles.macroPillVal}>{formatNum(meal.macros.carbs)}g</Text>
                      </View>
                      <View style={styles.macroPill}>
                        <Text style={styles.macroPillLabel}>Grasas</Text>
                        <Text style={styles.macroPillVal}>{formatNum(meal.macros.fats)}g</Text>
                      </View>
                      <View style={styles.macroPill}>
                        <Text style={styles.macroPillLabel}>Prot</Text>
                        <Text style={styles.macroPillVal}>{formatNum(meal.macros.protein)}g</Text>
                      </View>
                    </View>
                    
                    <View style={styles.ingredientsSection}>
                      <Text style={styles.sectionLabel}>Ingredientes</Text>
                      <View style={styles.ingredientsBox}>
                        {meal.ingredients.map((ing, ingIdx) => (
                          <View key={ingIdx} style={styles.ingredientItem}>
                            <Text style={styles.ingName}>{ing.name}</Text>
                            <Text style={styles.ingQty}>
                              {ing.quantity} {ing.unit}
                            </Text>
                          </View>
                        ))}
                      </View>
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
};

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  badge: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  badgeText: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  expandButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.primary,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    gap: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: {
    flex: 1,
    minWidth: 0,
  },
  mealName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  mealSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary + '1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  registerBtnSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  registerBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  registerBtnTextSuccess: {
    color: '#22c55e',
  },
  actionIconBtn: {
    padding: 8,
    borderRadius: 99,
  },
  details: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  macroPillLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 9,
    textTransform: 'uppercase',
    color: Theme.colors.onSurfaceVariant,
  },
  macroPillVal: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: Theme.colors.onSurface,
    marginTop: 2,
  },
  ingredientsSection: {
    gap: 6,
  },
  sectionLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    textTransform: 'uppercase',
    color: Theme.colors.onSurfaceVariant,
  },
  ingredientsBox: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  ingName: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurface,
  },
  ingQty: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '1a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
