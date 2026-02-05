import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getShadowStyle } from '../../utils/shadow';
import Logo from '../Logo';
import { StatsTicker } from '../StatsTicker';
import GlassCard from '../ui/GlassCard';

export default function CustomerHero() {
    const { user } = useAuth();
    const { colors, isDark } = useTheme();
    const router = useRouter();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={isDark ? ['#0f172a', '#1e293b'] : ['#1a3a5c', '#2c5364']}
                style={styles.heroBackground}
            >
                <View style={styles.header}>
                    <Logo size="lg" variant="glass" />
                </View>

                <View style={styles.content}>
                    <Text style={styles.greeting}>Hoş Geldiniz,</Text>
                    <Text style={styles.name}>{user?.ad} {user?.soyad}</Text>

                    <GlassCard style={styles.statsCard}>
                        <View style={styles.statItem}>
                            <StatsTicker value={1250} style={styles.statNumber} suffix="+" />
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Çözülen Arıza</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <StatsTicker value={98} style={styles.statNumber} suffix="%" />
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Memnuniyet</Text>
                        </View>
                    </GlassCard>

                    <Text style={styles.motivation}>
                        Evinizdeki her türlü teknik sorun için 7/24 yanınızdayız. Profesyonel çözümler bir tık uzağınızda.
                    </Text>

                    <Pressable
                        style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}
                        onPress={() => router.push('/(tabs)/yeni-talep')}
                    >
                        <LinearGradient
                            colors={['#f97316', '#ea580c']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            <Ionicons name="add-circle" size={26} color="#fff" />
                            <Text style={styles.ctaText}>Yeni Talep Oluştur</Text>
                        </LinearGradient>
                    </Pressable>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    heroBackground: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
    header: { alignItems: 'center', marginBottom: 30 },
    content: { alignItems: 'center' },
    greeting: { fontSize: 22, color: 'rgba(255,255,255,0.7)', fontWeight: '400' },
    name: { fontSize: 36, color: '#fff', fontWeight: '900', marginBottom: 30, textAlign: 'center' },
    statsCard: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%', paddingVertical: 24, marginBottom: 30 },
    statItem: { alignItems: 'center', flex: 1 },
    statNumber: { fontSize: 32, fontWeight: '900', color: '#38bdf8' },
    statLabel: { fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)' },
    motivation: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 15, marginBottom: 40, lineHeight: 22, paddingHorizontal: 10 },
    ctaButton: { width: '100%', ...getShadowStyle(8, '#ea580c', 0.3, 15, { width: 0, height: 8 }) },
    ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 20, gap: 12 },
    ctaText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
