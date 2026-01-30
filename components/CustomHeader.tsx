import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

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

    return (
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
            <View style={styles.headerTop}>
                <View style={styles.leftContainer}>
                    {showBackButton && (
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
                        </TouchableOpacity>
                    )}

                    <View>
                        {/* Always show Logo unless a specific Title is forced, but even then Logo is better for brand */
                            /* If title is provided, we might show it below or instead. 
                               Let's prioritize Logo for "App Title" and use 'title' props for screen name if needed, 
                               but sticking to the design: Logo Top Left. */
                        }
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Image
                                source={require('../assets/logo.png')}
                                style={{ width: 140, height: 40 }}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.headerSubtitle}>
                            {subtitle || 'Yapı & Teknik Çözüm Merkezi'}
                        </Text>
                    </View>
                </View>

                {showSettings && (
                    <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/ayarlar')}>
                        <Ionicons name="settings-outline" size={24} color={colors.headerText} />
                    </TouchableOpacity>
                )}
            </View>

            {/* User Card - Only show if not a back-button screen (usually main tabs) 
          OR we can make it optional props. 
          For consistency with 'index.tsx', we show User Card below logo.
      */}
            {!showBackButton && (
                <View style={[styles.userInfo, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.95)' }]}>
                    <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.userAvatarText}>
                            {user?.ad ? user.ad.charAt(0).toUpperCase() : ''}{user?.soyad ? user.soyad.charAt(0).toUpperCase() : ''}
                        </Text>
                    </View>
                    <View style={styles.userTextContainer}>
                        <Text style={[styles.userName, { color: isDark ? '#fff' : '#000' }]}>{user?.ad} {user?.soyad}</Text>
                        <Text style={[styles.userEmail, { color: isDark ? 'rgba(255,255,255,0.6)' : '#666' }]}>
                            {user?.rol ? user.rol.toUpperCase() : 'KULLANICI'}
                        </Text>
                    </View>
                </View>
            )}

            {/* If it IS a back button screen (detail page), maybe show a big Title below? 
          For 'Ayarlar', we want a simple header. 
          Let's handle that in the specific screen styling or add 'title' here.
      */}
            {showBackButton && title && (
                <Text style={[styles.screenTitle, { color: colors.headerText }]}>{title}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: 60,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 10
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15
    },
    backButton: {
        padding: 5
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
        marginLeft: 4,
        fontWeight: '500'
    },
    settingsButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        padding: 16,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff'
    },
    userAvatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff'
    },
    userTextContainer: {
        marginLeft: 16
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    userEmail: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5
    },
    screenTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 10,
        marginLeft: 10
    }
});
