import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Epilogue_800ExtraBold, Epilogue_900Black } from '@expo-google-fonts/epilogue';
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { Theme } from '../src/theme';

export const unstable_settings = {
  initialRouteName: 'auth',
};

function RootLayoutContent() {
  const { user, isAuthReady, loading } = useAuth();

  React.useEffect(() => {
    if (isAuthReady && !loading) {
      if (!user) {
        router.replace('/auth');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, isAuthReady, loading]);

  if (!isAuthReady || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Epilogue_800ExtraBold,
    Epilogue_900Black,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <RootLayoutContent />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
