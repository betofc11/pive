import React, { useState, createContext, useContext, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Modal, Pressable, Animated, ActivityIndicator } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { Theme } from '../../src/theme';
import { Sparkles, ClipboardList, BarChart3, Dumbbell, Plus, Utensils, Scale } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { FoodDialog } from '../../src/components/FoodDialog';
import { BodyCompositionDialog } from '../../src/components/BodyCompositionDialog';
import { RecordDialog } from '../../src/components/RecordDialog';

function CustomTabBar({ state, descriptors, navigation, onFabPress }: BottomTabBarProps & { onFabPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { globalLoading } = useHeaderScroll();
  
  const renderTabItem = (route: any, index: number) => {
    const isFocused = state.index === index;

    const onPress = () => {
      if (globalLoading) return;

      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    let Icon = Sparkles;
    let displayName = 'Pive';
    if (route.name === 'index') {
      Icon = Sparkles;
      displayName = 'Pive';
    } else if (route.name === 'plan') {
      Icon = ClipboardList;
      displayName = 'Plan';
    } else if (route.name === 'stats') {
      Icon = BarChart3;
      displayName = 'Stats';
    } else if (route.name === 'coach') {
      Icon = Dumbbell;
      displayName = 'Coach';
    }

    return (
      <TouchableOpacity
        key={route.name}
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.tabItem}
      >
        <Icon 
          size={22} 
          color={isFocused ? Theme.colors.primary : Theme.colors.onSurfaceVariant} 
        />
        <Text style={[
          styles.tabLabel,
          { color: isFocused ? Theme.colors.primary : Theme.colors.onSurfaceVariant }
        ]}>
          {displayName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(16, insets.bottom) }]}>
      {renderTabItem(state.routes[0], 0)}
      {renderTabItem(state.routes[1], 1)}

      {/* Center FAB Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          onPress={globalLoading ? undefined : onFabPress}
          activeOpacity={globalLoading ? 1 : 0.8}
          style={styles.tabBarFab}
        >
          <View style={styles.tabBarFabIconWrapper}>
            <Plus size={26} color={Theme.colors.onPrimary} />
          </View>
        </TouchableOpacity>
      </View>

      {renderTabItem(state.routes[2], 2)}
      {renderTabItem(state.routes[3], 3)}
    </View>
  );
}

// Create a Context for header scroll state
export const HeaderScrollContext = createContext<{
  scrolled: boolean;
  setScrolled: (scrolled: boolean) => void;
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  globalLoadingMessage: string;
  setGlobalLoadingMessage: (msg: string) => void;
}>({
  scrolled: false,
  setScrolled: () => {},
  globalLoading: false,
  setGlobalLoading: () => {},
  globalLoadingMessage: '',
  setGlobalLoadingMessage: () => {},
});

export const useHeaderScroll = () => useContext(HeaderScrollContext);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<'food' | 'body' | 'record' | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState('');

  // Animated value for close button rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFabOpen) {
      Animated.spring(rotateAnim, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isFabOpen, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const fabOptions = [
    { name: 'Comida', id: 'food', icon: Utensils, color: Theme.colors.tertiary, textColor: Theme.colors.onTertiary },
    { name: 'Composición', id: 'body', icon: Scale, color: Theme.colors.primary, textColor: Theme.colors.onPrimary },
    { name: 'Récord', id: 'record', icon: Dumbbell, color: Theme.colors.surfaceContainerHighest, textColor: Theme.colors.onSurface },
  ] as const;

  return (
    <HeaderScrollContext.Provider value={{ 
      scrolled, 
      setScrolled,
      globalLoading,
      setGlobalLoading,
      globalLoadingMessage,
      setGlobalLoadingMessage
    }}>
      <View style={styles.container}>
        {/* Global Header */}
        <View style={[
          styles.header, 
          { paddingTop: Math.max(12, insets.top) },
          scrolled ? styles.headerScrolled : null
        ]}>
          <View style={styles.logoContainer}>
            {/* SVG representation or simpler text icon */}
            <Sparkles size={24} color={Theme.colors.primary} />
            <Text style={styles.logoText}>Pive</Text>
          </View>
          <TouchableOpacity 
            onPress={globalLoading ? undefined : () => router.push('/profile')} 
            style={styles.profileButton}
            activeOpacity={globalLoading ? 1 : 0.8}
          >
            {profile?.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {profile?.displayName?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Dynamic Bottom Fade Shadow */}
          {scrolled && (
            <View style={styles.headerFade}>
              <Svg height="16" width="100%">
                <Defs>
                  <LinearGradient id="headerFadeGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="rgb(14, 14, 14)" stopOpacity="0.95" />
                    <Stop offset="1" stopColor="rgb(14, 14, 14)" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="16" fill="url(#headerFadeGrad)" />
              </Svg>
            </View>
          )}
        </View>

      {/* Tabs View */}
      <Tabs 
        tabBar={(props) => <CustomTabBar {...props} onFabPress={() => setIsFabOpen(true)} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Pive' }} />
        <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
        <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
        <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      </Tabs>

      {/* FAB Overlay Modal */}
      <Modal
        visible={isFabOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFabOpen(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setIsFabOpen(false)}
        >
          <View style={[styles.menuContainer, { bottom: Math.max(100, insets.bottom + 80) }]}>
            {fabOptions.map((option) => {
              const Icon = option.icon;
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.8}
                  style={styles.menuItem}
                  onPress={() => {
                    setIsFabOpen(false);
                    setActiveDialog(option.id);
                  }}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: option.color }]}>
                    <Icon size={22} color={option.textColor} />
                  </View>
                  <Text style={styles.menuLabel}>{option.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Rotated Close FAB Button inside Modal */}
          <View style={[styles.modalFabContainer, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <TouchableOpacity
              onPress={() => setIsFabOpen(false)}
              activeOpacity={0.8}
              style={styles.modalTabBarFab}
            >
              <View style={styles.modalTabBarFabIconWrapper}>
                <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                  <Plus size={26} color={Theme.colors.onPrimary} />
                </Animated.View>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modals for actions */}
      <FoodDialog 
        isOpen={activeDialog === 'food'} 
        onClose={() => setActiveDialog(null)} 
      />
      <BodyCompositionDialog 
        isOpen={activeDialog === 'body'} 
        onClose={() => setActiveDialog(null)} 
      />
      <RecordDialog 
        isOpen={activeDialog === 'record'} 
        onClose={() => setActiveDialog(null)} 
      />

      {globalLoading && (
        <View style={styles.globalLoadingOverlay}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.globalLoadingText}>{globalLoadingMessage || 'Analizando con Pive AI...'}</Text>
        </View>
      )}
      </View>
    </HeaderScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingBottom: 16,
    backgroundColor: 'rgba(14, 14, 14, 0.85)',
    borderBottomWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  headerScrolled: {
    backgroundColor: 'rgba(14, 14, 14, 0.95)',
    borderColor: Theme.colors.border + '33', // 20% opacity
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  headerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -16,
    height: 16,
    zIndex: 9,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 24,
    color: Theme.colors.primary,
    letterSpacing: -0.5,
  },
  profileButton: {
    borderRadius: 99,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: Theme.colors.primary + '33', // 20% opacity
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.primary + '1a', // 10% opacity
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.primary + '33',
  },
  avatarText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: Theme.colors.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14, 14, 14, 0.98)',
    borderTopWidth: 1,
    borderColor: Theme.colors.border,
    paddingTop: 8,
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabBarFab: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -12 }],
    zIndex: 25,
  },
  fabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarFabIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  tabLabel: {
    fontFamily: Theme.fonts.label,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuContainer: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontFamily: Theme.fonts.bodyBold,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceContainerHigh,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  modalFabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTabBarFab: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -12 }],
    zIndex: 26,
  },
  modalTabBarFabIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  globalLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 14, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  globalLoadingText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
