import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

// Prevent auto hide
SplashScreen.preventAutoHideAsync().catch(() => { });

LogBox.ignoreLogs([
  'Animated: `useNativeDriver`',
  'componentWillReceiveProps has been renamed',
]);

import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

// Auth durumuna göre yönlendirme yapan bileşen
function AuthNavigator() {
  const { user, loading, isAuthenticated, isTeknisyen, isYonetim, isMusteri } = useAuth();
  const { isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const hasNavigated = useRef(false);

  // Failsafe: Force hide splash screen after 10 seconds (Safety Net)
  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => { });
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  // Main Auth & Routing Logic
  useEffect(() => {
    if (loading) return;

    // Hide splash screen once auth loading is done
    SplashScreen.hideAsync().catch(() => { });

    const inAuthGroup = segments[0] === 'login';
    const inTabs = segments[0] === '(tabs)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
      hasNavigated.current = false;
    } else if (isAuthenticated && inAuthGroup) {
      // Rol bazlı yönlendirme
      if (isTeknisyen) {
        router.replace('/(tabs)/teknisyen');
      } else if (isYonetim) {
        router.replace('/(tabs)/yonetim');
      } else {
        router.replace('/(tabs)');
      }
      hasNavigated.current = true;
    } else if (isAuthenticated && inTabs && !hasNavigated.current) {
      // İlk yüklemede doğru sayfaya yönlendir
      const currentTab = (segments as string[])[1];
      if (isTeknisyen && currentTab !== 'teknisyen') {
        router.replace('/(tabs)/teknisyen');
        hasNavigated.current = true;
      } else if (isYonetim && currentTab !== 'yonetim' && currentTab !== 'explore') {
        router.replace('/(tabs)/yonetim');
        hasNavigated.current = true;
      } else if (isMusteri && currentTab !== 'index' && currentTab !== 'taleplerim') {
        router.replace('/(tabs)');
        hasNavigated.current = true;
      }
    }
  }, [user, loading, segments, isAuthenticated, isTeknisyen, isYonetim, isMusteri]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingContainerDark: {
    backgroundColor: '#121212',
  },
});



