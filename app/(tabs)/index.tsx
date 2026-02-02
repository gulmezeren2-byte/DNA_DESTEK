import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { HeroSkeleton } from '../../components/Skeleton';
import AdminHero from '../../components/Welcome/AdminHero';
import CustomerHero from '../../components/Welcome/CustomerHero';
import TechnicianHero from '../../components/Welcome/TechnicianHero';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function WelcomeScreen() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <HeroSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {!user || user.rol === 'musteri' ? (
        <CustomerHero />
      ) : user.rol === 'teknisyen' ? (
        <TechnicianHero />
      ) : (
        <AdminHero />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  }
});