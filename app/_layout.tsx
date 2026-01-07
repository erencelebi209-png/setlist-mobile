import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MessagesProvider } from './MessagesContext';
import { AuthProvider } from './AuthContext';
import { NotificationsProvider } from './NotificationsContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <MessagesProvider>
          <NotificationsProvider>
            <Stack>
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
