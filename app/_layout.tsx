import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from './AuthContext';
import { MessagesProvider } from './MessagesContext';
import { NotificationsProvider } from './NotificationsContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGate() {
  const router = useRouter();
  const segments = useSegments() as unknown as string[];
  const { firebaseUser, loading } = useAuth();

  // Route guard:
  // - User yoksa login/register'a git
  // - User varsa auth ekranlarında kalmasın
  React.useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!firebaseUser) {
      if (!inAuthGroup) {
        router.replace({ pathname: '/login' } as any);
      }
      return;
    }

    if (firebaseUser && inAuthGroup) {
      // Tabs'e düş.
      router.replace({ pathname: '/swipe' } as any);
    }
  }, [firebaseUser, loading, router, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AuthGate />
        <MessagesProvider>
          <NotificationsProvider>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="verify-selfie" options={{ title: 'Hesabını doğrula' }} />
            </Stack>
            <StatusBar style="auto" />
          </NotificationsProvider>
        </MessagesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
