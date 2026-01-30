/**
 * DNA DESTEK - Skeleton Loading Components
 * Profesyonel yükleme animasyonları
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Temel Skeleton bileşeni - Animasyonlu placeholder
 */
export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style,
}) => {
    const { isDark } = useTheme();
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const backgroundColor = isDark ? '#374151' : '#e5e7eb';

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor,
                    opacity,
                },
                style,
            ]}
        />
    );
};

/**
 * Talep kartı skeleton'u
 */
export const TalepCardSkeleton: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.talepCard, { backgroundColor: colors.card }]}>
            <View style={styles.statusBar} />
            <View style={styles.talepContent}>
                <View style={styles.talepHeader}>
                    <Skeleton width={80} height={24} borderRadius={6} />
                    <Skeleton width={60} height={20} borderRadius={4} />
                </View>
                <Skeleton width="70%" height={18} style={{ marginTop: 8 }} />
                <Skeleton width="90%" height={14} style={{ marginTop: 8 }} />
                <View style={styles.talepFooter}>
                    <Skeleton width={100} height={12} />
                    <Skeleton width={80} height={12} />
                </View>
            </View>
        </View>
    );
};

/**
 * Kullanıcı kartı skeleton'u
 */
export const UserCardSkeleton: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.userCard, { backgroundColor: colors.card }]}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.userInfo}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="80%" height={14} style={{ marginTop: 6 }} />
                <Skeleton width={60} height={20} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
            <Skeleton width={50} height={30} borderRadius={15} />
        </View>
    );
};

/**
 * İstatistik kartı skeleton'u
 */
export const StatCardSkeleton: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <Skeleton width={40} height={32} style={{ marginTop: 8 }} />
            <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
    );
};

/**
 * Liste skeleton'u - Birden fazla kart
 */
export const ListSkeleton: React.FC<{ count?: number; type?: 'talep' | 'user' }> = ({
    count = 5,
    type = 'talep',
}) => {
    const CardComponent = type === 'talep' ? TalepCardSkeleton : UserCardSkeleton;

    return (
        <View style={styles.listContainer}>
            {Array.from({ length: count }).map((_, index) => (
                <CardComponent key={index} />
            ))}
        </View>
    );
};

/**
 * Dashboard header skeleton'u
 */
export const DashboardHeaderSkeleton: React.FC = () => {
    return (
        <View style={styles.dashboardHeader}>
            <View>
                <Skeleton width={200} height={24} />
                <Skeleton width={150} height={14} style={{ marginTop: 6 }} />
            </View>
            <Skeleton width={40} height={40} borderRadius={20} />
        </View>
    );
};

/**
 * Detay modal skeleton'u
 */
export const DetailSkeleton: React.FC = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.detailContainer, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.detailHeader}>
                <Skeleton width={100} height={28} borderRadius={6} />
                <Skeleton width={80} height={24} borderRadius={12} />
            </View>

            {/* Content */}
            <View style={styles.detailSection}>
                <Skeleton width={120} height={16} style={{ marginBottom: 10 }} />
                <Skeleton width="100%" height={14} />
                <Skeleton width="80%" height={14} style={{ marginTop: 6 }} />
                <Skeleton width="60%" height={14} style={{ marginTop: 6 }} />
            </View>

            {/* Info Grid */}
            <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                    <Skeleton width={80} height={12} />
                    <Skeleton width={100} height={16} style={{ marginTop: 4 }} />
                </View>
                <View style={styles.infoItem}>
                    <Skeleton width={80} height={12} />
                    <Skeleton width={100} height={16} style={{ marginTop: 4 }} />
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                <Skeleton width="30%" height={44} borderRadius={10} />
                <Skeleton width="30%" height={44} borderRadius={10} />
                <Skeleton width="30%" height={44} borderRadius={10} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    // Talep Card
    talepCard: {
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    statusBar: {
        width: 4,
        backgroundColor: '#e5e7eb',
    },
    talepContent: {
        flex: 1,
        padding: 14,
    },
    talepHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    talepFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },

    // User Card
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },

    // Stat Card
    statCard: {
        width: '48%',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        alignItems: 'center',
    },

    // List
    listContainer: {
        padding: 16,
    },

    // Dashboard Header
    dashboardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },

    // Detail
    detailContainer: {
        padding: 20,
        borderRadius: 20,
    },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    detailSection: {
        marginBottom: 20,
    },
    infoGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    infoItem: {
        width: '45%',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});

export default Skeleton;
