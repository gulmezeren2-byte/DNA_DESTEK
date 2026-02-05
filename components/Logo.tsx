import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'light' | 'dark' | 'glass';
    animate?: boolean;
}

export default function Logo({ size = 'md', variant = 'light', animate = true }: LogoProps) {
    const scale = useSharedValue(1);

    useEffect(() => {
        if (animate) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 2000 }),
                    withTiming(1, { duration: 2000 })
                ),
                -1,
                true
            );
        }
    }, [animate]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const getDimensions = () => {
        switch (size) {
            case 'sm': return 40;
            case 'md': return 60;
            case 'lg': return 100;
            case 'xl': return 140;
            default: return 60;
        }
    };

    const dim = getDimensions();

    const getGradientColors = () => {
        if (variant === 'dark') return ['#1a3a5c', '#0d1b2a'] as const;
        if (variant === 'glass') return ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.1)'] as const;
        return ['#ffffff', '#f0f0f0'] as const;
    };

    return (
        <Animated.View style={[styles.container, { width: dim, height: dim }, animatedStyle]}>
            <View style={[styles.glow, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: variant === 'glass' ? 'rgba(255,255,255,0.2)' : 'rgba(26, 58, 92, 0.4)' }]} />

            <LinearGradient
                colors={getGradientColors()}
                style={[styles.circle, { width: dim, height: dim, borderRadius: dim / 2 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={[styles.innerRing, { borderRadius: dim / 2, opacity: variant === 'glass' ? 0.3 : 0.6 }]} />

                <Image
                    source={require('../assets/logo.png')}
                    style={{
                        width: '85%',
                        height: '85%',
                        borderRadius: (dim * 0.85) / 2,
                    }}
                    resizeMode="contain"
                />
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 10,
            },
            android: {
                elevation: 6,
            },
            web: {
                // @ts-ignore
                boxShadow: '0px 8px 10px rgba(0, 0, 0, 0.2)',
            }
        }),
    },
    glow: {
        position: 'absolute',
        transform: [{ scale: 1.15 }],
        opacity: 0.4,
    },
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.25)',
        overflow: 'hidden',
    },
    innerRing: {
        position: 'absolute',
        width: '92%',
        height: '92%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    }
});

