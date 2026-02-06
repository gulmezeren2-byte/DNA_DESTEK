import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

// Prevent auto hide
SplashScreen.preventAutoHideAsync().catch(() => { });

LogBox.ignoreLogs([
  'Animated: `useNativeDriver`',
  'componentWillReceiveProps has been renamed',
  'Invalid DOM property `transform-origin`',
  'Unknown event handler property',
]);

// Profil eksikse gösterilecek bileşen
function MissingProfileView({ onLogout, isDark }: { onLogout: () => void, isDark: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.missingProfileContainer, isDark && styles.missingProfileContainerDark]}>
      <Ionicons name="alert-circle-outline" size={64} color="#ff9800" />
      <View style={{ height: 20 }} />
      <View style={styles.contentBox}>
        <Ionicons name="person-outline" size={32} color={isDark ? '#fff' : '#333'} style={{ alignSelf: 'center' }} />
        <View style={{ height: 10 }} />

        <View style={{ height: 20 }} />
        <View style={{ alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 20, width: '100%' }}>
            <View style={{ marginBottom: 25 }}>
              <View style={{ backgroundColor: '#fff3cd', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#ffeeba' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="warning-outline" size={28} color="#856404" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 18, color: '#856404' }}>Profil Bulunamadı</Text>
                    <Text style={{ fontSize: 14, color: '#856404', marginTop: 4, lineHeight: 20 }}>
                      Hesabınız için bir kullanıcı profili oluşturulmamış. Lütfen sistem yöneticisi ile iletişime geçin.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#1a73e8' }]}
              onPress={onLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Oturumu Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// Auth durumuna göre yönlendirme yapan bileşen
function AuthNavigator() {
  const { user, loading, isAuthenticated, isTeknisyen, isYonetim, isMusteri, isProfileComplete, logout } = useAuth();
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
    const inRoot = (segments as string[]).length === 0;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
      hasNavigated.current = false;
    } else if (isAuthenticated && isProfileComplete && (inAuthGroup || inRoot)) {
      // Rol bazlı yönlendirme yerine herkes Ana Sayfaya
      router.replace('/(tabs)');
      hasNavigated.current = true;
    } else if (isAuthenticated && isProfileComplete && inTabs && !hasNavigated.current) {
      // Sayfa yenilendiğinde "Güvenli Bölge" kontrolü (Opsiyonel)
      // Ancak kullanıcı Index'teyse karışmıyoruz.
      const currentTab = (segments as string[])[1];

      // Eğer kullanıcı yetkisi olmayan bir sayfadaysa yönlendirilebilir
      // Şimdilik sadece index'e zorlama mantığını kaldırıyoruz ki herkes Index'i görebilsin.
      hasNavigated.current = true;
    }
  }, [user, loading, segments, isAuthenticated, isTeknisyen, isYonetim, isMusteri, isProfileComplete]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  // Profil eksikse uygulamayı blokla
  if (isAuthenticated && !isProfileComplete) {
    return <MissingProfileView onLogout={logout} isDark={isDark} />;
  }

  // Global Activity Listener
  const { resetActivity } = useAuth();

  return (
    <View style={{ flex: 1 }} onTouchStart={() => resetActivity()}>
      <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavigationThemeProvider>
    </View>
  );
}

export default function RootLayout() {
  console.log("🏠 RootLayout Rendering...");
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
  missingProfileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  missingProfileContainerDark: {
    backgroundColor: '#121212',
  },
  contentBox: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },
});



