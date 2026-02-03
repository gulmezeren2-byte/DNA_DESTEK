import { doc, setDoc } from 'firebase/firestore';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { getCurrentUser, loginUser, logoutUser, onAuthChange } from '../services/authService';
import { registerForPushNotificationsAsync } from '../services/notificationService';
import { DNAUser } from '../types';

// Login sonucu tipi
interface LoginResult {
    success: boolean;
    message?: string;
    user?: DNAUser;
}

// Context tipi
interface AuthContextType {
    user: DNAUser | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<LoginResult>;
    logout: () => Promise<{ success: boolean; message?: string }>;
    refreshUser: () => Promise<DNAUser | null>;
    isAuthenticated: boolean;
    isMusteri: boolean;
    isTeknisyen: boolean;
    isYonetim: boolean;
    setUser: (user: DNAUser | null) => void;
}

// Context oluştur
const AuthContext = createContext<AuthContextType | null>(null);

// Provider props tipi
interface AuthProviderProps {
    children: ReactNode;
}

// Provider bileşeni
export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<DNAUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        // 8 saniye zaman aşımı (Fallback)
        const timeout = setTimeout(() => {
            if (isMounted) {
                console.warn('Auth check timed out');
                setLoading(false);
            }
        }, 8000);

        // Auth durumu değişikliğini dinle
        const unsubscribe = onAuthChange(async (userData: DNAUser | null) => {
            if (!isMounted) return;

            clearTimeout(timeout);

            setUser(userData);

            // Kullanıcı giriş yaptıysa push token al ve kaydet
            if (userData?.uid) {
                try {
                    const token = await registerForPushNotificationsAsync();
                    if (token) {
                        const tokenRef = doc(db, 'push_tokens', userData.uid);
                        await setDoc(tokenRef, {
                            token: token,
                            updatedAt: new Date()
                        }, { merge: true });
                    }
                } catch (error) {
                    console.error('Push Token kayıt hatası:', error);
                }
            }

            setLoading(false);
        });

        return () => {
            isMounted = false;
            clearTimeout(timeout);
            unsubscribe();
        };
    }, []);

    // Giriş fonksiyonu
    const login = async (email: string, password: string): Promise<LoginResult> => {
        setLoading(true);
        setError(null);

        try {
            const result = await loginUser(email, password);

            if (result.success && result.data?.user) {
                setUser(result.data.user);
                return { success: true, user: result.data.user };
            } else {
                const msg = result.message || 'Giriş başarısız';
                setError(msg);
                return { success: false, message: msg };
            }
        } finally {
            setLoading(false);
        }
    };

    // Çıkış fonksiyonu
    const logout = async () => {
        setLoading(true);

        // Logout sırasında push token'ı temizle
        if (user?.uid) {
            try {
                const { deleteDoc, doc } = require('firebase/firestore');
                await deleteDoc(doc(db, 'push_tokens', user.uid));
            } catch (err) {
                console.warn('Logout token cleanup error (silent):', err);
                // Silent toast if needed, but we don't want to block logout
                const toast = require('../services/toastService').default;
                toast.error('Oturum kapatılırken bildirim kaydı temizlenemedi.');
            }
        }

        const result = await logoutUser();

        if (result.success) {
            setUser(null);
        }

        setLoading(false);
        return result;
    };

    // Kullanıcı bilgilerini yenile
    const refreshUser = async (): Promise<DNAUser | null> => {
        const userData = await getCurrentUser();
        setUser(userData);
        return userData;
    };

    const value: AuthContextType = React.useMemo(() => ({
        user,
        loading,
        error,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        isMusteri: user?.rol === 'musteri',
        isTeknisyen: user?.rol === 'teknisyen',
        isYonetim: user?.rol === 'yonetim',
        setUser,
    }), [user, loading, error]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
