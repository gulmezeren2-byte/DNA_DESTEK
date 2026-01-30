import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ThemeMode, useTheme } from '../contexts/ThemeContext';

export default function AyarlarScreen() {
    const { user, logout } = useAuth();
    const { theme, themeMode, setThemeMode, isDark, colors } = useTheme();
    const router = useRouter();

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                logout();
            }
        } else {
            logout();
        }
    };

    const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
        { mode: 'light', label: 'Açık', icon: 'sunny-outline' },
        { mode: 'dark', label: 'Koyu', icon: 'moon-outline' },
        { mode: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.headerText} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.headerText }]}>Ayarlar</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Kullanıcı Bilgileri */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>👤 Hesap Bilgileri</Text>
                    <View style={styles.userRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                            <Text style={styles.avatarText}>
                                {user?.ad?.charAt(0)}{user?.soyad?.charAt(0)}
                            </Text>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={[styles.userName, { color: colors.text }]}>{user?.ad} {user?.soyad}</Text>
                            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
                            <View style={[styles.roleBadge, { backgroundColor: isDark ? '#2a3a2a' : '#e8f5e9' }]}>
                                <Text style={[styles.roleText, { color: isDark ? '#66bb6a' : '#2e7d32' }]}>
                                    {user?.rol === 'yonetim' ? 'Yönetici' : user?.rol === 'teknisyen' ? 'Teknisyen' : 'Müşteri'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Tema Seçimi */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>🎨 Tema</Text>
                    <View style={styles.themeGrid}>
                        {themeOptions.map((option) => (
                            <TouchableOpacity
                                key={option.mode}
                                style={[
                                    styles.themeOption,
                                    { borderColor: colors.border },
                                    themeMode === option.mode && { borderColor: colors.primary, backgroundColor: isDark ? '#1a2a4a' : '#e3f2fd' },
                                ]}
                                onPress={() => setThemeMode(option.mode)}
                            >
                                <Ionicons
                                    name={option.icon as any}
                                    size={28}
                                    color={themeMode === option.mode ? colors.primary : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.themeLabel,
                                        { color: themeMode === option.mode ? colors.primary : colors.textSecondary },
                                    ]}
                                >
                                    {option.label}
                                </Text>
                                {themeMode === option.mode && (
                                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={styles.checkmark} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Uygulama Bilgisi */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>ℹ️ Uygulama</Text>
                    <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Versiyon</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>1.0.0</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Geliştirici</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>DNA İnşaat</Text>
                    </View>
                </View>

                {/* Çıkış */}
                <TouchableOpacity
                    style={[styles.logoutButton, { backgroundColor: isDark ? '#3a2a2a' : '#ffebee' }]}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={22} color="#c62828" />
                    <Text style={styles.logoutText}>Çıkış Yap</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 16,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    userInfo: {
        marginLeft: 14,
        flex: 1,
    },
    userName: {
        fontSize: 17,
        fontWeight: '600',
    },
    userEmail: {
        fontSize: 13,
        marginTop: 2,
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        marginTop: 6,
    },
    roleText: {
        fontSize: 12,
        fontWeight: '600',
    },
    themeGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    themeOption: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
    },
    themeLabel: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 8,
    },
    checkmark: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoLabel: {
        fontSize: 14,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 10,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#c62828',
    },
});
