import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { Alert } from '../src/lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/hooks/useAuth';
import { auth } from '../src/firebase';
import { signOut } from 'firebase/auth';
import { Theme } from '../src/theme';
import { ArrowLeft, LogOut } from 'lucide-react-native';
import { router } from 'expo-router';
import { PersonalInfoSection } from '../src/components/profile/PersonalInfoSection';
import { AppleHealthSection } from '../src/components/profile/AppleHealthSection';
import { ActivityHistory } from '../src/components/profile/ActivityHistory';
import { useActivityHistory } from '../src/hooks/useActivityHistory';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const activity = useActivityHistory(user?.uid, profile);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: () => signOut(auth)
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header Navigation */}
      <View style={styles.navHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <ArrowLeft size={24} color={Theme.colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Mi Perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarContainer}>
            {profile?.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {profile?.displayName?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{profile?.displayName || 'Usuario'}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>

        <PersonalInfoSection uid={user?.uid} profile={profile} />

        {Platform.OS === 'ios' && (
          <AppleHealthSection uid={user?.uid} currentMetrics={profile?.bodyMetrics} />
        )}

        <ActivityHistory items={activity} />

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={20} color={Theme.colors.error} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        {/* Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  navTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 20,
    color: Theme.colors.onBackground,
  },
  scrollContent: {
    padding: 24,
    gap: 32,
  },
  profileHeaderCard: {
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: Theme.colors.primary + '33',
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Theme.colors.primary + '1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Theme.colors.primary + '33',
  },
  avatarFallbackText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 40,
    color: Theme.colors.primary,
  },
  profileName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 26,
    color: Theme.colors.onBackground,
  },
  profileEmail: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurfaceVariant,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 16,
    borderRadius: 99,
    marginTop: 8,
  },
  logoutButtonText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 16,
    color: Theme.colors.error,
  },
});
