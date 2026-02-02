import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { useWindowDimensions } from 'react-native';
import CustomDrawerContent from '../../components/CustomDrawerContent';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function Layout() {
  const { isYonetim, isTeknisyen, isMusteri } = useAuth();
  const { isDark, colors } = useTheme();
  const dimensions = useWindowDimensions();

  // Responsive Drawer Logic
  const isLargeScreen = dimensions.width >= 768;

  const screenOptions = {
    headerShown: false,
    drawerStyle: {
      width: 280,
      backgroundColor: 'transparent',
      borderRightWidth: 0,
    },
    drawerType: isLargeScreen ? 'permanent' as const : 'front' as const,
    drawerActiveBackgroundColor: 'rgba(255, 255, 255, 0.2)',
    drawerActiveTintColor: '#fff',
    drawerInactiveTintColor: 'rgba(255, 255, 255, 0.7)',
    drawerLabelStyle: {
      marginLeft: -10,
      fontWeight: '600' as const,
      fontSize: 15
    },
    drawerItemStyle: {
      borderRadius: 12,
      marginVertical: 4,
      paddingHorizontal: 10
    }
  };

  const renderDrawerContent = (props: DrawerContentComponentProps) => <CustomDrawerContent {...props} />;

  // Teknisyen Layout
  if (isTeknisyen) {
    return (
      <Drawer
        screenOptions={screenOptions}
        drawerContent={renderDrawerContent}
        initialRouteName="index"
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Ana Sayfa',
            title: 'Ana Sayfa',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="home-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="teknisyen"
          options={{
            drawerLabel: 'Görev Paneli',
            title: 'Görev Paneli',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="construct-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="taleplerim"
          options={{
            drawerLabel: 'Görevlerim',
            title: 'Görevlerim',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="list-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="ayarlar"
          options={{
            drawerLabel: 'Ayarlar',
            title: 'Ayarlar',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="settings-outline" size={22} color={color} />,
          }}
        />

        {/* Gizli Sayfalar */}
        <Drawer.Screen name="yeni-talep" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="explore" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="yonetim" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="ekipler" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="raporlar" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="kullanicilar" options={{ drawerItemStyle: { display: 'none' } }} />
      </Drawer>
    );
  }

  // Yönetici Layout
  if (isYonetim) {
    return (
      <Drawer
        screenOptions={screenOptions}
        drawerContent={renderDrawerContent}
      >
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: 'Ana Sayfa',
            title: 'Ana Sayfa',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="home-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="yonetim"
          options={{
            drawerLabel: 'Yönetim Paneli',
            title: 'Yönetim',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="grid-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="ekipler"
          options={{
            drawerLabel: 'Ekipler',
            title: 'Ekipler',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="people-circle-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="kullanicilar"
          options={{
            drawerLabel: 'Kullanıcılar',
            title: 'Kullanıcılar',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="people-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="raporlar"
          options={{
            drawerLabel: 'Raporlar',
            title: 'Raporlar',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="stats-chart-outline" size={22} color={color} />,
          }}
        />
        <Drawer.Screen
          name="ayarlar"
          options={{
            drawerLabel: 'Ayarlar',
            title: 'Ayarlar',
            drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="settings-outline" size={22} color={color} />,
          }}
        />

        {/* Gizli Sayfalar */}
        <Drawer.Screen name="yeni-talep" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="taleplerim" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="teknisyen" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="explore" options={{ drawerItemStyle: { display: 'none' } }} />
      </Drawer>
    );
  }

  // Müşteri Layout (Varsayılan)
  return (
    <Drawer
      screenOptions={screenOptions}
      drawerContent={renderDrawerContent}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: 'Ana Sayfa',
          title: 'Ana Sayfa',
          drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
      />
      <Drawer.Screen
        name="yeni-talep"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Yeni Talep',
          headerTitle: '',
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="taleplerim"
        options={{
          drawerLabel: 'Taleplerim',
          title: 'Taleplerim',
          drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="list-outline" size={22} color={color} />,
        }}
      />
      <Drawer.Screen
        name="ayarlar"
        options={{
          drawerLabel: 'Ayarlar',
          title: 'Ayarlar',
          drawerIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="settings-outline" size={22} color={color} />,
        }}
      />

      {/* Gizli Sayfalar */}
      <Drawer.Screen name="explore" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="teknisyen" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="yonetim" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="ekipler" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="raporlar" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="kullanicilar" options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
