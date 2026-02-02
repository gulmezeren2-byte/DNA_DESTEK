import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import Logo from '../Logo';
import { StatsTicker } from '../StatsTicker';

export default function CustomerHero() {
    const { user } = useAuth();
    const { colors, isDark } = useTheme();
    const router = useRouter();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a3a5c', '#203a43', '#2c5364']}
                style={styles.heroBackground}
            >
                <View style={styles.header}>
                    <Logo size="lg" variant="glass" />
                </View>

                <View style={styles.content}>
                    <Text style={styles.greeting}>Hoş Geldiniz,</Text>
                    <Text style={styles.name}>{user?.ad} {user?.soyad}</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <StatsTicker value={1250} style={styles.statNumber} suffix="+" />
                            <Text style={styles.statLabel}>Çözülen Arıza</Text>
                        </View>
                        <View style={styles.diver} />
                        <View style={styles.statItem}>
                            <StatsTicker value={98} style={styles.statNumber} suffix="%" />
                            <Text style={styles.statLabel}>Müşteri Memnuniyeti</Text>
                        </View>
                    </View>

                    <Text style={styles.motivation}>
                        Evinizdeki her türlü teknik sorun için 7/24 yanınızdayız.
                    </Text>

                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => router.push('/(tabs)/yeni-talep')}
                    >
                        <LinearGradient
                            colors={['#FF9800', '#F57C00']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            <Ionicons name="add-circle" size={28} color="#fff" />
                            <Text style={styles.ctaText}>Yeni Talep Oluştur</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    heroBackground: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
    header: { alignItems: 'center', marginBottom: 40 },
    content: { alignItems: 'center' },
    greeting: { fontSize: 24, color: 'rgba(255,255,255,0.8)', fontWeight: '300' },
    name: { fontSize: 32, color: '#fff', fontWeight: 'bold', marginBottom: 40 },
    statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 20 },
    statItem: { alignItems: 'center', paddingHorizontal: 20 },
    statNumber: { fontSize: 36, fontWeight: 'bold', color: '#4FC3F7' },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 5 },
    diver: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
    motivation: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontSize: 16, marginBottom: 40, paddingHorizontal: 20 },
    ctaButton: { width: '100%', maxWidth: 350, shadowColor: '#F57C00', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 25, gap: 10 },
    ctaText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
