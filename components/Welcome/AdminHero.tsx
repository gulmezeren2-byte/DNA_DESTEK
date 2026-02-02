import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../Logo';

export default function AdminHero() {
    const { user } = useAuth();
    const router = useRouter();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a237e', '#283593', '#3949ab']}
                style={styles.heroBackground}
            >
                <View style={styles.header}>
                    <Logo size="md" variant="glass" />
                    <View style={styles.roleBadge}>
                        <Ionicons name="shield-checkmark" size={14} color="#fff" />
                        <Text style={styles.roleText}>YÖNETİM</Text>
                    </View>
                </View>

                <View style={styles.content}>
                    <Text style={styles.greeting}>Merhaba,</Text>
                    <Text style={styles.name}>{user?.ad}</Text>

                    <View style={styles.systemStatus}>
                        <View style={styles.statusHeader}>
                            <Ionicons name="pulse" size={24} color="#69F0AE" />
                            <Text style={styles.statusTitle}>Sistem Durumu</Text>
                        </View>
                        <Text style={styles.statusText}>Tüm sistemler aktif ve sorunsuz çalışıyor.</Text>
                        <View style={styles.indicator}>
                            <View style={styles.dot} />
                            <Text style={styles.indicatorText}>ONLINE</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => router.push('/(tabs)/yonetim')}
                    >
                        <LinearGradient
                            colors={['#304FFE', '#3D5AFE']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            <Ionicons name="analytics" size={24} color="#fff" />
                            <Text style={styles.ctaText}>Yönetim Paneline Git</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    heroBackground: { flex: 1, paddingTop: 60, paddingHorizontal: 30 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 50 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    roleText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    content: { alignItems: 'flex-start' },
    greeting: { fontSize: 28, color: 'rgba(255,255,255,0.7)', fontWeight: '300' },
    name: { fontSize: 40, color: '#fff', fontWeight: 'bold', marginBottom: 40 },
    systemStatus: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 25, borderRadius: 20, width: '100%', marginBottom: 40, borderLeftWidth: 4, borderLeftColor: '#69F0AE' },
    statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    statusTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    statusText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
    indicator: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(105, 240, 174, 0.2)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#69F0AE' },
    indicatorText: { color: '#69F0AE', fontSize: 12, fontWeight: 'bold' },
    ctaButton: { width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 16, gap: 10 },
    ctaText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
