
import { Platform, ViewStyle } from 'react-native';

/**
 * Platformlar arası tutarlı gölge stili oluşturur.
 * Web için boxShadow, Android için elevation, iOS için shadow* özelliklerini kullanır.
 */
export const getShadowStyle = (
    elevation: number = 5,
    shadowColor: string = '#000000',
    opacity: number = 0.2,
    radius: number = 5,
    offset: { width: number; height: number } = { width: 0, height: 4 }
): ViewStyle => {
    return Platform.select({
        ios: {
            shadowColor,
            shadowOffset: offset,
            shadowOpacity: opacity,
            shadowRadius: radius,
        },
        android: {
            elevation,
        },
        web: {
            // @ts-ignore - React Native Web supports boxShadow
            boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${modifyColorOpacity(shadowColor, opacity)}`,
        },
        default: {},
    });
};

/**
 * Hex veya rgb rengine opaklık ekler.
 * Basit bir yardımcı fonksiyon.
 */
const modifyColorOpacity = (color: string, opacity: number): string => {
    if (color.startsWith('#')) {
        // Hex to RGBA
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } else if (color.startsWith('rgb')) {
        return color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
    }
    return color; // Desteklenmeyen format ise olduğu gibi döndür
};
