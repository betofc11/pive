import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/hooks/useAuth';
import { getPiveAdvice } from '../../src/services/geminiService';
import { addMealToDailyLog, removeMealFromDailyLog, updateMealInDailyLog } from '../../src/services/dailyLogService';
import { saveMealToHealthKit } from '../../src/services/healthKitService';
import { Utensils, Wheat, Droplets, Leaf, Check, Timer, Sparkles, ArrowRight, Plus } from 'lucide-react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../src/firebase';
import { DailyLog, Meal, MealSlot } from '../../src/types';
import { formatNum, getLocalDateString } from '../../src/lib/utils';
import { daySlotStatuses, resolveDayMeals } from '../../src/lib/mealSlots';
import { DaySlotsStrip } from '../../src/components/DaySlotsStrip';
import { Theme } from '../../src/theme';
import { MealList } from '../../src/components/MealList';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useHeaderScroll } from './_layout';

// How often the dashboard checks whether the next meal changed (a slot's window passed): only then, or when the
// meals change, or after 3 h, is the advice generated again
const ADVICE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const ADVICE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

const PAST_DAY_ADVICE = 'El consejo de Pive es para hoy: vuelve a Hoy para ver qué te toca en tu próxima comida.';

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [advice, setAdvice] = useState<string>('');
  const [generatingAdvice, setGeneratingAdvice] = useState(false);
  const [loggingProposal, setLoggingProposal] = useState(false);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const { setScrolled, selectedDate } = useHeaderScroll();

  const dailyLogRef = useRef(dailyLog);
  const profileRef = useRef(profile);
  const userRef = useRef(user);
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    dailyLogRef.current = dailyLog;
    profileRef.current = profile;
    userRef.current = user;
    selectedDateRef.current = selectedDate;
  }, [dailyLog, profile, user, selectedDate]);

  // Reset scroll status when navigating away
  useEffect(() => {
    return () => setScrolled(false);
  }, [setScrolled]);

  // 1. Subscribe to today's DailyLog
  useEffect(() => {
    if (user) {
      const logRef = doc(db, `users/${user.uid}/dailyLogs`, selectedDate);
      
      const unsubscribe = onSnapshot(logRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as DailyLog;
          setDailyLog(data);
          if (data.aiAdvice) {
            setAdvice(data.aiAdvice);
          } else {
            setAdvice(selectedDate === getLocalDateString() ? 'Generando consejo de Pive...' : PAST_DAY_ADVICE);
          }
        } else {
          setDailyLog(null);
          setAdvice('');
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/dailyLogs/${selectedDate}`);
      });

      return () => unsubscribe();
    }
  }, [user, selectedDate]);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (generatingAdvice) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation(() => {
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [generatingAdvice, pulseAnim]);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });

  const fetchAdvice = useCallback(async (force = false) => {
    const user = userRef.current;
    const dailyLog = dailyLogRef.current;
    const profile = profileRef.current;

    if (!user || !dailyLog || !profile?.macroGoals) return;
    // The advice talks about the next meal: only today has one
    const activeDate = selectedDateRef.current;
    if (activeDate !== getLocalDateString()) return;

    const macrosChanged = !dailyLog.adviceMacros ||
      dailyLog.macros.calories !== dailyLog.adviceMacros.calories ||
      dailyLog.macros.protein !== dailyLog.adviceMacros.protein ||
      dailyLog.macros.carbs !== dailyLog.adviceMacros.carbs ||
      dailyLog.macros.fats !== dailyLog.adviceMacros.fats;

    const now = new Date();
    // The same calculation as the server's: the slot the advice should talk about now
    const next = daySlotStatuses(dailyLog, profile, true, now).next;
    const nextChanged = dailyLog.adviceSlot === undefined || (dailyLog.adviceSlot ?? null) !== next;
    const timeElapsed = dailyLog.aiAdviceUpdatedAt ? now.getTime() - dailyLog.aiAdviceUpdatedAt > ADVICE_MAX_AGE_MS : true;

    if (force || macrosChanged || !dailyLog.aiAdvice || nextChanged || timeElapsed) {
      setGeneratingAdvice(true);
      try {
        const result = await getPiveAdvice(now);
        if (result) {
          const logRef = doc(db, `users/${user.uid}/dailyLogs`, activeDate);
          await updateDoc(logRef, {
            aiAdvice: result.advice,
            aiAdviceUpdatedAt: Date.now(),
            adviceMacros: dailyLog.macros,
            adviceSlot: result.slot,
            adviceProposal: result.proposal,
          });
          setAdvice(result.advice);
        } else {
          setAdvice('¡Vas súper bien con tus macros de hoy! Sigue sumando consistencia.');
        }
      } catch (error) {
        console.error("Error generating advice:", error);
        setAdvice("¡Vas súper bien con tus macros de hoy! Sigue sumando consistencia.");
      } finally {
        setGeneratingAdvice(false);
      }
    }
  }, []);

  // The next meal also changes with the clock (a slot's window passes): check it every few minutes
  useEffect(() => {
    const id = setInterval(() => fetchAdvice(false), ADVICE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAdvice]);

  const handleLogProposal = async () => {
    const proposal = dailyLog?.adviceProposal;
    if (!user || !proposal || loggingProposal) return;
    setLoggingProposal(true);
    try {
      await addMealToDailyLog(
        user.uid,
        selectedDate,
        {
          id: Date.now().toString(),
          name: proposal.name,
          time: new Date().toISOString(),
          macros: proposal.macros,
          slot: proposal.slot,
          slotSource: 'plan',
        },
        { clearAdviceProposal: true },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saveMealToHealthKit(proposal.name, proposal.macros).catch(err => {
        console.warn('[HealthKit] Error syncing the advice meal:', err);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/dailyLogs/${selectedDate}`);
    } finally {
      setLoggingProposal(false);
    }
  };

  // 2. Fetch Gemini Advice when the macros or meals change (and on the interval above)
  const hasDailyLog = Boolean(dailyLog);
  const hasMacroGoals = Boolean(profile?.macroGoals);
  useEffect(() => {
    if (hasDailyLog && hasMacroGoals) {
      fetchAdvice(false);
    } else if (!hasDailyLog && hasMacroGoals) {
      setAdvice('¡Registra tu comida para recibir consejos personalizados de Pive!');
    }
  }, [
    hasDailyLog,
    hasMacroGoals,
    dailyLog?.macros?.calories,
    dailyLog?.macros?.protein,
    dailyLog?.macros?.carbs,
    dailyLog?.macros?.fats,
    dailyLog?.meals?.length,
    selectedDate,
    profile?.macroGoals?.protein,
    profile?.macroGoals?.carbs,
    profile?.macroGoals?.fats,
    user?.uid,
    fetchAdvice
  ]);

  const macros = useMemo(
    () => dailyLog?.macros || { protein: 0, carbs: 0, fats: 0, calories: 0 },
    [dailyLog?.macros]
  );
  const goals = useMemo(
    () => profile?.macroGoals || { protein: 160, carbs: 210, fats: 65, calories: 2000 },
    [profile?.macroGoals]
  );

  const remaining = {
    protein: Math.max(0, goals.protein - macros.protein),
    carbs: Math.max(0, goals.carbs - macros.carbs),
    fats: Math.max(0, goals.fats - macros.fats),
    calories: Math.max(0, goals.calories - macros.calories)
  };

  // 3. Dynamic Checklist Items
  const dynamicGoals = useMemo(() => {
    const list = [];
    
    if (macros.protein < goals.protein * 0.5) {
      list.push({
        id: 'protein',
        title: 'Prioridad Proteica',
        desc: `Te faltan ${formatNum(goals.protein - macros.protein)}g de proteína. Prioriza fuentes magras.`,
        icon: Check,
        color: Theme.colors.tertiary
      });
    }



    if (profile?.bodyMetrics) {
      const { bodyFat, muscleMass, weight } = profile.bodyMetrics;
      if (bodyFat && bodyFat > 22) {
        list.push({
          id: 'fat-loss',
          title: 'Enfoque Metabólico',
          desc: 'Tu perfil sugiere déficit controlado y cardio ligero para optimizar energía.',
          icon: Leaf,
          color: Theme.colors.primary
        });
      }
      if (muscleMass && muscleMass < weight * 0.4) {
        list.push({
          id: 'muscle',
          title: 'Estímulo Físico',
          desc: 'Asegura entrenamientos de fuerza intensos para fortalecer estructura.',
          icon: Timer,
          color: Theme.colors.secondary
        });
      }
    }

    if (list.length === 0) {
      list.push({
        id: 'default',
        title: 'Mantén el Ritmo',
        desc: 'Vas por buen camino. Sigue cumpliendo con tus macros y entrenamiento.',
        icon: Sparkles,
        color: Theme.colors.primary
      });
    }

    return list.slice(0, 3);
  }, [macros, goals, profile?.bodyMetrics]);

  const firstName = profile?.displayName?.split(' ')[0] || 'Piver';
  const needsOnboarding = !profile?.bodyMetrics?.weight || !profile?.macroGoals;

  const ratio = goals.calories > 0 ? macros.calories / goals.calories : 0;
  const greetingCategory = ratio >= 0.95 ? 'done' : ratio >= 0.1 ? 'progress' : 'start';

  const greetingPrefix = useMemo(() => {
    const phrases = {
      start: ["¡Qué buena nota,", "¡A darle con todo,", "¡Hoy es un gran día,", "¡Con toda la actitud,"],
      progress: ["¡Vas súper bien,", "¡Excelente ritmo,", "¡Sigamos sumando,", "¡Buena energía,"],
      done: ["¡Energía a tope,", "¡Día coronado,", "¡Bien alimentado,", "¡Cerrando con fuerza,"]
    };
    const list = phrases[greetingCategory];
    return list[Math.floor(Math.random() * list.length)];
  }, [greetingCategory]);

  const todayDisplay = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  }, [selectedDate]);

  // Every meal with its slot (inferred for older ones), and the day's slots with their budgets
  const isToday = selectedDate === getLocalDateString();
  const mealSlots = Object.fromEntries(resolveDayMeals(dailyLog?.meals, profile).map((m) => [m.id, m.slot]));
  const slotStatuses = profile?.macroGoals ? daySlotStatuses(dailyLog, profile, isToday).slots : [];

  const handleChangeSlot = async (meal: Meal, slot: MealSlot) => {
    if (!user) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await updateMealInDailyLog(user.uid, selectedDate, meal.id, { slot, slotSource: 'user' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/dailyLogs/${selectedDate}`);
    }
  };

  const handleDeleteMeal = async (mealToDelete: Meal) => {
    if (!user || !dailyLog) return;

    try {
      await removeMealFromDailyLog(user.uid, selectedDate, mealToDelete.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/dailyLogs/${selectedDate}`);
    }
  };

  return (
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
      {/* Welcome Banner */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={styles.welcomeText}>
            {greetingPrefix} <Text style={styles.highlightText}>{firstName}</Text>!
          </Text>
          <Text style={styles.dateText}>{todayDisplay}</Text>
        </View>
      </View>

      {/* Onboarding Prompt */}
      {needsOnboarding && (
        <Pressable 
          style={styles.onboardingBanner} 
          onPress={() => router.push('/profile')}
        >
          <View style={styles.onboardingInfo}>
            <Text style={styles.onboardingTitle}>¡Completa tu perfil!</Text>
            <Text style={styles.onboardingSub}>Necesitamos tu peso y objetivos para darte consejos precisos.</Text>
          </View>
          <View style={styles.arrowCircle}>
            <ArrowRight size={20} color={Theme.colors.onPrimary} />
          </View>
        </Pressable>
      )}

      {/* Progress Rings Section */}
      <View style={styles.chartSection}>
        <View style={styles.svgWrapper}>
          <Svg style={styles.svgRing} viewBox="0 0 100 100">
            {/* Background ring */}
            <Circle cx="50" cy="50" r="44" fill="none" stroke={Theme.colors.border} strokeWidth="6" />
            
            {/* Protein Ring (Outer - Tertiary/Pink) */}
            <Circle 
              cx="50" cy="50" r="44" fill="none" 
              stroke={Theme.colors.tertiary} strokeWidth="8" 
              strokeDasharray="276.46" 
              strokeDashoffset={276.46 - (276.46 * Math.min(1, macros.protein / goals.protein))}
              strokeLinecap="round"
              rotation="-90"
              origin="50, 50"
            />
            {/* Carbs Ring (Middle - Secondary/Cyan) */}
            <Circle 
              cx="50" cy="50" r="34" fill="none" 
              stroke={Theme.colors.secondary} strokeWidth="6" 
              strokeDasharray="213.63" 
              strokeDashoffset={213.63 - (213.63 * Math.min(1, macros.carbs / goals.carbs))}
              strokeLinecap="round"
              rotation="-90"
              origin="50, 50"
            />
            {/* Fats Ring (Inner - PrimaryContainer/Purple) */}
            <Circle 
              cx="50" cy="50" r="24" fill="none" 
              stroke={Theme.colors.primaryContainer} strokeWidth="4" 
              strokeDasharray="150.8" 
              strokeDashoffset={150.8 - (150.8 * Math.min(1, macros.fats / goals.fats))}
              strokeLinecap="round"
              rotation="-90"
              origin="50, 50"
            />
          </Svg>
          <View style={styles.caloriesCenter}>
            <Text style={styles.caloriesLabel}>Restante</Text>
            <Text style={styles.caloriesNum}>
              {formatNum(remaining.calories)}
            </Text>
            <Text style={styles.caloriesUnit}>kcal</Text>
          </View>
        </View>
      </View>

      {/* AI Coach Card */}
      <View style={styles.adviceCard}>
        <View style={styles.adviceRow}>
          <TouchableOpacity 
            style={styles.adviceIconCircle}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              fetchAdvice(true);
            }}
            disabled={generatingAdvice || !isToday}
            activeOpacity={0.7}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Pedirle otro consejo a Pive"
          >
            <Animated.View style={{ transform: [{ scale }], opacity }}>
              <Sparkles size={20} color={Theme.colors.primary} />
            </Animated.View>
          </TouchableOpacity>
          {generatingAdvice && !advice ? (
            <View style={styles.adviceSkeleton}>
              <Text style={styles.adviceLabelText}>Pive está pensando...</Text>
            </View>
          ) : (
            <Text style={[styles.adviceText, generatingAdvice ? { opacity: 0.6 } : null]}>
              {advice ? `"${advice}"` : 'Analizando tu plan y energía diaria...'}
            </Text>
          )}
        </View>

        {isToday && dailyLog?.adviceProposal && !generatingAdvice && (
          <Pressable
            style={[styles.proposalButton, loggingProposal ? { opacity: 0.6 } : null]}
            onPress={handleLogProposal}
            disabled={loggingProposal}
            accessibilityRole="button"
            accessibilityLabel={`Registrar así: ${dailyLog.adviceProposal.name}, ${formatNum(dailyLog.adviceProposal.macros.calories)} kilocalorías`}
          >
            <Plus size={16} color={Theme.colors.onPrimary} />
            <View style={styles.proposalTextBox}>
              <Text style={styles.proposalButtonText}>Registrar así</Text>
              <Text style={styles.proposalDetail} numberOfLines={1}>
                {dailyLog.adviceProposal.name} · {formatNum(dailyLog.adviceProposal.macros.calories)} kcal
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Grid of Macros */}
      <View style={styles.grid}>
        <View style={[styles.gridCard, { borderColor: Theme.colors.tertiary + '33', backgroundColor: Theme.colors.tertiary + '08' }]}>
          <Utensils size={22} color={Theme.colors.tertiary} />
          <View style={styles.gridInfo}>
            <Text style={styles.gridLabel}>Proteína</Text>
            <Text style={styles.gridNum}>{formatNum(macros.protein)}g</Text>
            <Text style={styles.gridSub}>Faltan: {formatNum(remaining.protein)}g</Text>
          </View>
        </View>

        <View style={[styles.gridCard, { borderColor: Theme.colors.secondary + '33', backgroundColor: Theme.colors.secondary + '08' }]}>
          <Wheat size={22} color={Theme.colors.secondary} />
          <View style={styles.gridInfo}>
            <Text style={styles.gridLabel}>Carbos</Text>
            <Text style={styles.gridNum}>{formatNum(macros.carbs)}g</Text>
            <Text style={styles.gridSub}>Faltan: {formatNum(remaining.carbs)}g</Text>
          </View>
        </View>

        <View style={[styles.gridCard, { borderColor: Theme.colors.primary + '33', backgroundColor: Theme.colors.primary + '08' }]}>
          <Droplets size={22} color={Theme.colors.primary} />
          <View style={styles.gridInfo}>
            <Text style={styles.gridLabel}>Grasas</Text>
            <Text style={styles.gridNum}>{formatNum(macros.fats)}g</Text>
            <Text style={styles.gridSub}>Faltan: {formatNum(remaining.fats)}g</Text>
          </View>
        </View>
      </View>

      {/* Today's Meals */}
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Comidas de Hoy</Text>
        <DaySlotsStrip slots={slotStatuses} />
        <MealList
          meals={dailyLog?.meals || []}
          slots={mealSlots}
          onDeleteMeal={handleDeleteMeal}
          onChangeSlot={handleChangeSlot}
        />
      </View>

      {/* Daily Goals Checklist */}
      <View style={[styles.section, { marginBottom: 40 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Objetivos del Día</Text>
          <Text style={styles.headerSubtitle}>Personalizados</Text>
        </View>
        <View style={styles.checklist}>
          {dynamicGoals.map((goal) => {
            const GoalIcon = goal.icon;
            return (
              <View key={goal.id} style={styles.checkItem}>
                <View style={[styles.checkCircle, { borderColor: goal.color }]}>
                  <GoalIcon size={16} color={goal.color} />
                </View>
                <View style={styles.checkText}>
                  <Text style={styles.checkTitle}>{goal.title}</Text>
                  <Text style={styles.checkDesc}>{goal.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  welcomeText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 28,
    color: Theme.colors.onSurface,
    letterSpacing: -0.5,
  },
  highlightText: {
    color: Theme.colors.primary,
  },
  dateText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  onboardingBanner: {
    backgroundColor: Theme.colors.primary + '1a', // 10% primary
    borderColor: Theme.colors.primary + '33', // 20% primary
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  onboardingInfo: {
    flex: 1,
  },
  onboardingTitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 15,
    color: Theme.colors.primary,
  },
  onboardingSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 18,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  svgWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  caloriesCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  caloriesLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Theme.colors.onSurfaceVariant,
  },
  caloriesNum: {
    fontFamily: Theme.fonts.headlineBlack,
    fontSize: 38,
    color: Theme.colors.onSurface,
    marginTop: 2,
  },
  caloriesUnit: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.primary,
    marginTop: -2,
  },
  adviceCard: {
    backgroundColor: Theme.colors.surfaceContainerHigh,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '1a',
  },
  adviceRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  adviceIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adviceText: {
    flex: 1,
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  proposalButton: {
    marginTop: 14,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Theme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  proposalTextBox: {
    flex: 1,
  },
  proposalButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onPrimary,
  },
  proposalDetail: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onPrimary,
    opacity: 0.8,
  },
  adviceSkeleton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adviceLabelText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  gridInfo: {
    gap: 2,
  },
  gridLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Theme.colors.onSurfaceVariant,
  },
  gridNum: {
    fontFamily: Theme.fonts.headline,
    fontSize: 22,
    color: Theme.colors.onSurface,
  },
  gridUnit: {
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
    marginLeft: 2,
  },
  gridSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 8.5,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionHeading: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  headerSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  checklist: {
    gap: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Theme.colors.surfaceContainer,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  checkDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 14,
  },
});
