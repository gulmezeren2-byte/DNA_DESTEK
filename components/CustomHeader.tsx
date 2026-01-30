import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
                return <Ionicons name="briefcase" size={24} color="#7b1fa2" />; // Yönetim - Mor Klas Çanta
            case 'teknisyen':
                return <MaterialCommunityIcons name="hard-hat" size={24} color="#ef6c00" />; // Teknisyen - Turuncu Baret
            case 'musteri':
            default:
                return <Ionicons name="home" size={24} color="#1565c0" />; // Müşteri - Mavi Ev
        }
    };

    return (
        <LinearGradient
            colors={['#1a3a5c', '#203a43', '#2c5364']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
        >
            <View style={styles.headerTop}>
                <View style={styles.leftContainer}>
                    {showBackButton && (
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}

                    <View style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Logo size="md" variant="glass" />
                        </View>
                        {/* Eğer subtitle varsa göster, yoksa varsayılan slogan */}
                        <Text style={styles.headerSubtitle}>
                            {subtitle || 'Yapı & Teknik Çözüm Merkezi'}
                        </Text>
                    </View>
                </View>

                {showSettings && (
                    <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/ayarlar')}>
                        <Ionicons name="settings-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* User Card - showBackButton false ise (Genellikle ana sayfalarda) */}
            {!showBackButton && (
                <View style={[styles.userInfo, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <View style={[styles.userAvatar, { backgroundColor: '#fff' }]}>
                        {getRoleIcon()}
                    </View>
                    <View style={styles.userTextContainer}>
                        <Text style={styles.userName}>{user?.ad} {user?.soyad}</Text>
                        <Text style={styles.userEmail}>
                            {user?.rol ? user.rol.toUpperCase() : 'KULLANICI'}
                        </Text>
                    </View>
                </View>
            )}

            {/* Başlık (BackButton true ise ve title varsa, logo altına şık bir başlık ekle) */}
            {showBackButton && title && (
                <View style={{ marginTop: 15, paddingLeft: 4 }}>
                    <Text style={styles.screenTitle}>{title}</Text>
                </View>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: 50,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 5
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12,
        marginRight: 4
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
        letterSpacing: 0.5
    },
    settingsButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 12
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    userAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    userAvatarText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    userTextContainer: {
        marginLeft: 12
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff'
    },
    userEmail: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2
    },
    screenTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5
    }
});
