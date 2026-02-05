import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import GlassCard from './GlassCard';

interface StatsWidgetProps {
    title: string;
    value: string | number;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    trend?: {
        value: string;
        isUp: boolean;
    };
    description?: string;
}

export default function StatsWidget({ title, value, icon, color, trend, description }: StatsWidgetProps) {
    const { colors, isDark } = useTheme();

    return (
        <GlassCard style={styles.container}>
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                    <Ionicons name={icon} size={20} color={color} />
                </View>
                {trend && (
                    <View style={[styles.trendContainer, { backgroundColor: trend.isUp ? '#10b98120' : '#ef444420' }]}>
                        <Ionicons
                            name={trend.isUp ? 'trending-up' : 'trending-down'}
                            size={12}
                            color={trend.isUp ? '#10b981' : '#ef4444'}
                        />
                        <Text style={[styles.trendText, { color: trend.isUp ? '#10b981' : '#ef4444' }]}>
                            {trend.value}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.content}>
                <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
                <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
                {description && (
                    <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
                )}
            </View>

            {/* Sub decoration line */}
            <View style={[styles.bottomLine, { backgroundColor: color }]} />
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minWidth: 150,
        margin: 6,
        padding: 16,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    trendText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    content: {
        gap: 2,
    },
    value: {
        fontSize: 22,
        fontWeight: '800',
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
    },
    description: {
        fontSize: 10,
        marginTop: 4,
    },
    bottomLine: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        opacity: 0.6,
    }
});
