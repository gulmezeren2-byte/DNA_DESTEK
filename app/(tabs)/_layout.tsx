import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function TabLayout() {
  const { isYonetim, isTeknisyen, isMusteri } = useAuth();
  const { isDark, colors } = useTheme();

  const tabBarStyle = {
    paddingBottom: 5,
    paddingTop: 5,
    height: 60,
    backgroundColor: isDark ? '#1e1e1e' : '#fff',
    borderTopColor: isDark ? '#333' : '#e8e8e8',
  };

  const screenOptions = {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: isDark ? '#888' : '#999',
    headerShown: false,
    tabBarStyle,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  };

  // Teknisyen Layout
  if (isTeknisyen) {
    return (
      <Tabs screenOptions={screenOptions} initialRouteName="teknisyen">
        <Tabs.Screen
          name="teknisyen"
          options={{
            title: 'Talepler',
            tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="taleplerim" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="yonetim" options={{ href: null }} />
      </Tabs>
    );
  }

  // Yönetici Layout
  if (isYonetim) {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="yonetim"
          options={{
            title: 'Talepler',
            tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Projeler',
            tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="taleplerim" options={{ href: null }} />
        <Tabs.Screen name="teknisyen" options={{ href: null }} />
      </Tabs>
    );
  }

  // Müşteri Layout (varsayılan)
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Yeni Talep',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="taleplerim"
        options={{
          title: 'Taleplerim',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="teknisyen" options={{ href: null }} />
      <Tabs.Screen name="yonetim" options={{ href: null }} />
    </Tabs>
  );
}
