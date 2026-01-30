import { doc, updateDoc } from 'firebase/firestore';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { db, getCurrentUser, loginUser, logoutUser, onAuthChange } from '../firebaseConfig';
import { registerForPushNotificationsAsync } from '../services/notificationService';

// Kullanıcı tipi
interface User {
    uid: string;
    email: string;
    ad: string;
    soyad: string;
    telefon: string;
    rol: 'musteri' | 'teknisyen' | 'yonetim';
    kategori?: string;
    aktif: boolean;
    pushToken?: string;
}

// Login sonucu tipi
interface LoginResult {
    success: boolean;
    message?: string;
    user?: User;
}

// Context tipi
interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<LoginResult>;
    logout: () => Promise<{ success: boolean; message?: string }>;
    refreshUser: () => Promise<User | null>;
    isAuthenticated: boolean;
    isMusteri: boolean;
    isTeknisyen: boolean;
    isYonetim: boolean;
    setUser: (user: User | null) => void;
}

// Context oluştur
const AuthContext = createContext<AuthContextType | null>(null);

// Provider props tipi
interface AuthProviderProps {
    children: ReactNode;
}

// Provider bileşeni
export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
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
        const unsubscribe = onAuthChange(async (userData: User | null) => {
            if (!isMounted) return;

            clearTimeout(timeout);

            setUser(userData as User | null);

            // Kullanıcı giriş yaptıysa push token al ve kaydet
            if (userData?.uid) {
                try {
                    const token = await registerForPushNotificationsAsync();
                    if (token) {
                        const userRef = doc(db, 'users', userData.uid);
                        await updateDoc(userRef, {
                            pushToken: token
                        });
                        console.log('Push Token kaydedildi:', token);
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

        const result = await loginUser(email, password);

        if (result.success && result.user) {
            setUser(result.user as User);
        } else {
            setError(result.message || 'Giriş başarısız');
        }

        setLoading(false);
        return result as LoginResult;
    };

    // Çıkış fonksiyonu
    const logout = async () => {
        setLoading(true);
        const result = await logoutUser();

        if (result.success) {
            setUser(null);
        }

        setLoading(false);
        return result;
    };

    // Kullanıcı bilgilerini yenile
    const refreshUser = async (): Promise<User | null> => {
        const userData = await getCurrentUser();
        setUser(userData as User | null);
        return userData as User | null;
    };

    const value: AuthContextType = {
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
    };

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
