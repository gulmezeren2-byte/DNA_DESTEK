import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './Logo';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
    const { user, logout } = useAuth();
    const { isDark } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    const getRoleLabel = () => {
        if (user?.rol === 'yonetim') return 'Yönetici';
        if (user?.rol === 'yonetim_kurulu') return 'Yönetim Kurulu';
        if (user?.rol === 'teknisyen') return 'Teknisyen';
        if (user?.rol === 'sorumlu') return 'Sorumlu';
        return 'Müşteri';
    };

    // Get initials safely
    const initials = (user?.ad?.[0] || '') + (user?.soyad?.[0] || '');

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient
                colors={isDark ? ['#1a2a3a', '#121212'] : ['#1a3a5c', '#2c5364']}
                style={[styles.container, { paddingTop: insets.top }]}
            >
                {/* Header / Logo Area */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Logo size="md" variant="glass" />
                    </View>
                    <View style={styles.appTitleContainer}>
                        <Text style={styles.appTitle}>DNA DESTEK</Text>
                        <Text style={styles.appSubtitle}>Yapı & Teknik</Text>
                    </View>
                </View>

                {/* User Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {initials.toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName} numberOfLines={1}>{user?.ad} {user?.soyad}</Text>
                        <Text style={styles.userRole}>{getRoleLabel()}</Text>
                    </View>
                </View>

                {/* Navigation Items */}
                <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 10 }}>
                    {/* We overlay a custom style for the Items */}
                    <View style={styles.itemsContainer}>
                        <DrawerItemList {...props} />
                    </View>
                </DrawerContentScrollView>

                {/* Footer / Logout */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + 80 }]}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={22} color="#ff6b6b" />
                        <Text style={styles.logoutText}>Çıkış Yap</Text>
                    </TouchableOpacity>
                </View>

            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10
    },
    logoContainer: {
        marginRight: 15,
    },
    appTitleContainer: {
        justifyContent: 'center'
    },
    appTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    appSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    profileCard: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarText: {
        color: '#1a3a5c',
        fontWeight: 'bold',
        fontSize: 16
    },
    userInfo: {
        flex: 1
    },
    userName: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14
    },
    userRole: {
        color: '#4db6ac',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2
    },
    itemsContainer: {
        paddingHorizontal: 10
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
        paddingTop: 20
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 23, 68, 0.1)',
        padding: 12,
        borderRadius: 12,
    },
    logoutText: {
        color: '#ff6b6b',
        marginLeft: 10,
        fontWeight: '600'
    }
});
