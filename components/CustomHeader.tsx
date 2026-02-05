import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getShadowStyle } from '../utils/shadow';
import Logo from './Logo';

interface CustomHeaderProps {
    title?: string;
    subtitle?: string;
    showSettings?: boolean;
    showBackButton?: boolean;
}

export default function CustomHeader({ title, subtitle, showSettings = true, showBackButton = false }: CustomHeaderProps) {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    const getRoleIcon = () => {
        switch (user?.rol) {
            case 'yonetim':
                return <Ionicons name="briefcase" size={20} color="#7b1fa2" />;
            case 'teknisyen':
                return <MaterialCommunityIcons name="hard-hat" size={20} color="#ef6c00" />;
            case 'musteri':
            default:
                return <Ionicons name="home" size={20} color="#1565c0" />;
        }
    };

    return (
        <LinearGradient
            colors={isDark ? ['#0f172a', '#1e293b'] : ['#1a3a5c', '#2c5364']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
        >
            <View style={styles.headerTop}>
                <View style={styles.leftContainer}>
                    {showBackButton && (
                        <Pressable
                            onPress={() => router.back()}
                            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
                        >
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                        </Pressable>
                    )}

                    <View style={styles.titleContainer}>
                        <View style={styles.logoRow}>
                            <Logo size="sm" variant="glass" />
                            <View>
                                <Text style={styles.headerTitle}>{title || 'DNA DESTEK'}</Text>
                                <Text style={styles.headerSubtitle}>
                                    {subtitle || 'Yapı & Teknik Çözüm'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {showSettings && (
                    <Pressable
                        style={({ pressed }) => [styles.settingsButton, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => router.push('/ayarlar')}
                    >
                        <Ionicons name="settings-sharp" size={20} color="#fff" />
                    </Pressable>
                )}
            </View>

            {!showBackButton && (
                <View style={styles.userInfo}>
                    <View style={styles.userAvatar}>
                        {getRoleIcon()}
                    </View>
                    <View style={styles.userTextContainer}>
                        <Text style={styles.userName}>{user?.ad} {user?.soyad}</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.userRole}>
                                {user?.rol?.toUpperCase() || 'KULLANICI'}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {showBackButton && title && (
                <View style={styles.largeTitleContainer}>
                    <Text style={styles.largeTitle}>{title}</Text>
                </View>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: 55,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        ...getShadowStyle(10, '#000', 0.2, 12, { width: 0, height: 4 }),
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    titleContainer: {
        flex: 1,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 14,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    settingsButton: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 14,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        padding: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        ...getShadowStyle(2, '#000', 0.1, 4, { width: 0, height: 2 }),
    },
    userTextContainer: {
        marginLeft: 14,
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    roleBadge: {
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    userRole: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 0.5,
    },
    largeTitleContainer: {
        marginTop: 20,
        paddingLeft: 4,
    },
    largeTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5,
    }
});

