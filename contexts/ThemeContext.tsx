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
    primary: '#1a73e8',
    background: '#f8f9fa',
    card: '#ffffff',
    text: '#222222',
    textSecondary: '#666666',
    textMuted: '#999999',
    border: '#e8e8e8',
    inputBg: '#f8f9fa',
    success: '#2e7d32',
    warning: '#f57c00',
    error: '#c62828',
    headerBg: '#1a73e8',
    headerText: '#ffffff',
};

const darkColors = {
    primary: '#4da3ff',
    background: '#121212',
    card: '#1e1e1e',
    text: '#e8e8e8',
    textSecondary: '#aaaaaa',
    textMuted: '#777777',
    border: '#333333',
    inputBg: '#2a2a2a',
    success: '#66bb6a',
    warning: '#ffa726',
    error: '#ef5350',
    headerBg: '#1e1e1e',
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
