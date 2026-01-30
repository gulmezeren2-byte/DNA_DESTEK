import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'light' | 'dark' | 'glass';
}

export default function Logo({ size = 'md', variant = 'light' }: LogoProps) {
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

    // Gradient colors based on variant
    const getGradientColors = () => {
        if (variant === 'dark') return ['#1a3a5c', '#0d1b2a'] as const;
        if (variant === 'glass') return ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)'] as const;
        return ['#ffffff', '#f0f0f0'] as const; // light
    };

    return (
        <View style={[styles.container, { width: dim, height: dim }]}>
            {/* Outer Glow/Shadow */}
            <View style={[styles.glow, { width: dim, height: dim, borderRadius: dim / 2 }]} />

            {/* Main Circle with Gradient */}
            <LinearGradient
                colors={getGradientColors()}
                style={[styles.circle, { width: dim, height: dim, borderRadius: dim / 2 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Inner White Border/Ring for definition */}
                <View style={[styles.innerRing, { borderRadius: dim / 2, opacity: variant === 'glass' ? 0.5 : 0.8, zIndex: 2 }]} />

                {/* Real DNA Logo Image (Strictly Circular Masked) */}
                <Image
                    source={require('../assets/logo.png')}
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: dim / 2, // Ensures the image itself is clipped to a circle
                    }}
                    resizeMode="cover" // Cover ensures it fills the circle entirely
                />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    glow: {
        position: 'absolute',
        backgroundColor: 'rgba(26, 58, 92, 0.4)',
        transform: [{ scale: 1.1 }],
        opacity: 0.5,
    },
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        overflow: 'hidden',
    },
    innerRing: {
        position: 'absolute',
        width: '90%',
        height: '90%',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.5)',
    }
});
