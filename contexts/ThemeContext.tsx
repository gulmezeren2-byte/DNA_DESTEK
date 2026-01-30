import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: 'light' | 'dark';
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
    isDark: boolean;
    colors: typeof lightColors;
}

const lightColors = {
    primary: '#C62828', // DNA Red
    background: '#f5f5f5',
    card: '#ffffff',
    text: '#212121',
    textSecondary: '#616161',
    textMuted: '#9e9e9e',
    border: '#e0e0e0',
    inputBg: '#ffffff',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    headerBg: '#C62828',
    headerText: '#ffffff',
};

const darkColors = {
    primary: '#ef5350', // Lighter red for dark mode
    background: '#121212',
    card: '#1e1e1e',
    text: '#e0e0e0',
    textSecondary: '#b0b0b0',
    textMuted: '#757575',
    border: '#333333',
    inputBg: '#2c2c2c',
    success: '#66bb6a',
    warning: '#ffa726',
    error: '#f44336',
    headerBg: '#1e1e1e', // Dark header for dark mode
    headerText: '#ffffff',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const systemColorScheme = useSystemColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    // Kayıtlı tema tercihini yükle
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('themeMode');
                if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                    setThemeModeState(savedTheme as ThemeMode);
                }
            } catch (error) {
                console.log('Tema yüklenemedi:', error);
            }
            setIsLoaded(true);
        };
        loadTheme();
    }, []);

    // Tema tercihini kaydet
    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        try {
            await AsyncStorage.setItem('themeMode', mode);
        } catch (error) {
            console.log('Tema kaydedilemedi:', error);
        }
    };

    const toggleTheme = () => {
        setThemeMode(isDark ? 'light' : 'dark');
    };

    // Gerçek tema hesapla
    const theme: 'light' | 'dark' =
        themeMode === 'system'
            ? (systemColorScheme || 'light')
            : themeMode;

    const isDark = theme === 'dark';
    const colors = isDark ? darkColors : lightColors;

    if (!isLoaded) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme, isDark, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
