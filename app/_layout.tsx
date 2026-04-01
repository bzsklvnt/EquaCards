import 'react-native-gesture-handler';
import '../global.css';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/src/hooks/useColorScheme';
import { ResponsiveShell } from '@/src/components/ResponsiveShell';
import { AuthGate } from '@/src/features/auth/AuthGate';
import { AuthorizationProvider } from '@/src/features/auth/AuthorizationProvider';
import { SessionProvider } from '@/src/features/auth/SessionProvider';
import { DeckProvider } from '@/src/features/flashcards/DeckProvider';
import { queryClient } from '@/src/lib/queryClient';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            <AuthorizationProvider>
              <DeckProvider>
                <AuthGate>
                  <ResponsiveShell>
                    <ThemeProvider
                      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
                    >
                      <Stack>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(app)" options={{ headerShown: false }} />
                      </Stack>
                    </ThemeProvider>
                  </ResponsiveShell>
                </AuthGate>
              </DeckProvider>
            </AuthorizationProvider>
          </QueryClientProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
