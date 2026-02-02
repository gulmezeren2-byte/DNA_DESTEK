import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../Logo';

export default function TechnicianHero() {
    const { user } = useAuth();
    const router = useRouter();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#263238', '#37474F', '#455A64']}
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

                    <View style={styles.card}>
                        <Ionicons name="trophy-outline" size={40} color="#FFD700" style={{ marginBottom: 10 }} />
                        <Text style={styles.cardTitle}>Emeğine Sağlık!</Text>
                        <Text style={styles.cardText}>
                            Senin sayende müşterilerimiz evlerinde huzurla yaşıyor.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.ctaButton}
                        onPress={() => router.push('/(tabs)/taleplerim')}
                    >
                        <LinearGradient
                            colors={['#009688', '#00796B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            <Ionicons name="list" size={24} color="#fff" />
                            <Text style={styles.ctaText}>Görevlerime Git</Text>
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
    card: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 30, borderRadius: 20, width: '100%', marginBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    cardTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFD700', marginBottom: 10 },
    cardText: { fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 24 },
    ctaButton: { width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 16, gap: 10 },
    ctaText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
