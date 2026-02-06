import { BlurView } from 'expo-blur';
import React, { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface GlassCardProps {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: number;
}

export default function GlassCard({ children, style, intensity = 60 }: GlassCardProps) {
    const { isDark, colors } = useTheme();

    if (Platform.OS === 'ios') {
        return (
            <BlurView
                intensity={intensity}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.card, { borderColor: colors.glassBorder }, style]}
            >
                {children}
            </BlurView>
        );
    }

    // Android/Web Fallback
    const shadowStyle = Platform.select({
        ios: {
            shadowColor: colors.shadowColor,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
        },
        android: {
            elevation: colors.elevation,
        },
        web: {
            // @ts-ignore
            boxShadow: `0px 4px ${colors.shadowRadius}px rgba(0, 0, 0, ${colors.shadowOpacity})`,
        }
    });

    return (
        <View style={[
            styles.card,
            {
                backgroundColor: colors.glassBg,
                borderColor: colors.glassBorder,
            },
            shadowStyle,
            style
        ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        overflow: 'hidden',
    }
});
