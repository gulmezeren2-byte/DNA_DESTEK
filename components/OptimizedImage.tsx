import { Image, ImageStyle } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface OptimizedImageProps {
    source: string | { uri: string } | number;
    style?: ImageStyle | ViewStyle | any; // Loose type for compatibility
    contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    transition?: number;
    placeholder?: string | number | null; // blurhash or local image
}

export default function OptimizedImage({
    source,
    style,
    contentFit = 'cover',
    transition = 300,
    placeholder = null
}: OptimizedImageProps) {
    const { isDark, colors } = useTheme();
    const [isLoading, setIsLoading] = useState(true);

    // Normalize source
    const imageSource = typeof source === 'string' ? { uri: source } : source;

    return (
        <View style={[styles.container, style, { overflow: 'hidden', backgroundColor: 'transparent' }]}>
            <Image
                style={[StyleSheet.absoluteFill]} // Image fills the container
                source={imageSource}
                contentFit={contentFit}
                transition={transition}
                placeholder={placeholder as any}
                onLoadEnd={() => setIsLoading(false)}
            // Cache Policy is default (disk)
            />
            {isLoading && !placeholder && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#333' : '#eee', opacity: 0.5 }]} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        // Base container layout
        justifyContent: 'center',
        alignItems: 'center',
    },
});
