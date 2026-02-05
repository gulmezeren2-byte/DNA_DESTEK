import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getShadowStyle } from '../../utils/shadow';
import Logo from '../Logo';
import GlassCard from '../ui/GlassCard';

export default function AdminHero() {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={isDark ? ['#0f172a', '#1e293b'] : ['#1a237e', '#3949ab']}
                style={styles.heroBackground}
            >
                <View style={styles.header}>
                    <Logo size="md" variant="glass" />
                    <View style={styles.roleBadge}>
                        <Ionicons name="shield-checkmark" size={14} color="#fff" />
                        <Text style={styles.roleText}>
                            {user?.rol === 'yonetim_kurulu' ? 'YÖNETİM KURULU' : 'YÖNETİM'}
                        </Text>
                    </View>
                </View>

                <View style={styles.content}>
                    <Text style={styles.greeting}>Merhaba,</Text>
                    <Text style={styles.name}>{user?.ad}</Text>

                    <GlassCard style={styles.statusCard}>
                        <View style={styles.statusHeader}>
                            <View style={styles.statusIcon}>
                                <Ionicons name="pulse" size={24} color="#69F0AE" />
                            </View>
                            <View>
                                <Text style={styles.statusTitle}>Sistem Durumu</Text>
                                <View style={styles.indicator}>
                                    <View style={styles.dot} />
                                    <Text style={styles.indicatorText}>ONLINE</Text>
                                </View>
                            </View>
                        </View>
                        <Text style={styles.statusText}>Tüm sistemler aktif ve sorunsuz çalışıyor.</Text>
                    </GlassCard>

                    <Pressable
                        style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}
                        onPress={() => router.push('/(tabs)/yonetim')}
                    >
                        <LinearGradient
                            colors={['#4f46e5', '#6366f1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            <Ionicons name="analytics" size={24} color="#fff" />
                            <Text style={styles.ctaText}>Yönetim Paneline Git</Text>
                        </LinearGradient>
                    </Pressable>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    heroBackground: { flex: 1, paddingTop: 60, paddingHorizontal: 25 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    roleText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    content: { alignItems: 'flex-start', width: '100%' },
    greeting: { fontSize: 24, color: 'rgba(255,255,255,0.7)', fontWeight: '400' },
    name: { fontSize: 42, color: '#fff', fontWeight: '900', marginBottom: 30, letterSpacing: -1 },
    statusCard: { width: '100%', marginBottom: 30, padding: 24 },
    statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
    statusIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(105, 240, 174, 0.15)', justifyContent: 'center', alignItems: 'center' },
    statusTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    statusText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
    indicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#69F0AE' },
    indicatorText: { color: '#69F0AE', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    ctaButton: { width: '100%', ...getShadowStyle(8, '#000', 0.2, 15, { width: 0, height: 8 }) },
    ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 20, gap: 12 },
    ctaText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

