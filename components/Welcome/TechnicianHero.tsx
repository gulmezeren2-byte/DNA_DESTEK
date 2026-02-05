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

export default function TechnicianHero() {
    const { user } = useAuth();
    const { isDark } = useTheme();
    const router = useRouter();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={isDark ? ['#1e293b', '#334155'] : ['#263238', '#455A64']}
                style={styles.heroBackground}
            >
                <View style={styles.header}>
                    <Logo size="md" variant="glass" />
                    <View style={styles.roleBadge}>
                        <Ionicons name="construct" size={14} color="#fff" />
                        <Text style={styles.roleText}>TEKNİK EKİP</Text>
                    </View>
                </View>

                <View style={styles.content}>
                    <Text style={styles.greeting}>Kolay Gelsin,</Text>
                    <Text style={styles.name}>{user?.ad}</Text>

                    <GlassCard style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="trophy" size={32} color="#fbbf24" />
                            <Text style={styles.cardTitle}>Emeğine Sağlık!</Text>
                        </View>
                        <Text style={styles.cardText}>
                            Senin sayende müşterilerimiz evlerinde huzurla yaşıyor. Bugün için atanmış görevlerini kontrol etmeyi unutma.
                        </Text>
                    </GlassCard>

                    <Pressable
                        style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}
                        onPress={() => router.push('/(tabs)/taleplerim')}
                    >
                        <LinearGradient
                            colors={['#059669', '#10b981']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            <Ionicons name="list" size={24} color="#fff" />
                            <Text style={styles.ctaText}>Görevlerime Git</Text>
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
    infoCard: { width: '100%', padding: 24, marginBottom: 30 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    cardTitle: { fontSize: 20, fontWeight: '800', color: '#fbbf24' },
    cardText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
    ctaButton: { width: '100%', ...getShadowStyle(8, '#000', 0.2, 15, { width: 0, height: 8 }) },
    ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 20, gap: 12 },
    ctaText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
