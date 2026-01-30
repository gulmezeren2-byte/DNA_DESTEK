/**
 * DNA DESTEK - TypeScript Types
 * Merkezi tip tanımları
 */

import { DURUM, ONCELIK, ROLES } from '../constants';

// Kullanıcı tipi
export interface User {
    uid: string;
    email: string;
    ad: string;
    soyad: string;
    telefon?: string;
    rol: typeof ROLES[keyof typeof ROLES];
    kategori?: string;
    aktif: boolean;
    pushToken?: string;
    olusturmaTarihi?: FirestoreTimestamp;
    sonGirisTarihi?: FirestoreTimestamp;
}

// Firestore Timestamp tipi
export interface FirestoreTimestamp {
    seconds: number;
    nanoseconds: number;
}

// Talep tipi
export interface Talep {
    id: string;
    baslik: string;
    aciklama: string;
    kategori: string;
    durum: typeof DURUM[keyof typeof DURUM];
    oncelik: typeof ONCELIK[keyof typeof ONCELIK];
    projeAdi: string;
    blokAdi?: string;
    daireNo?: string;
    musteriId: string;
    musteriAdi: string;
    atananTeknisyenId?: string;
    atananTeknisyenAdi?: string;
    fotograflar?: string[];
    cozumFotograflari?: string[];
    yorumlar?: Yorum[];
    olusturmaTarihi: FirestoreTimestamp;
    guncellemeTarihi?: FirestoreTimestamp;
    cozumTarihi?: FirestoreTimestamp;
}

// Yorum tipi
export interface Yorum {
    yazanId: string;
    yazanAdi: string;
    mesaj: string;
    tarih: FirestoreTimestamp;
}

// Proje tipi
export interface Proje {
    id: string;
    ad: string;
    bloklar?: Blok[];
    aktif: boolean;
    olusturmaTarihi?: FirestoreTimestamp;
}

// Blok tipi
export interface Blok {
    ad: string;
    daireSayisi: number;
}

// Ekip tipi
export interface Ekip {
    id: string;
    ad: string;
    renk: string;
    uyeler: string[];
    aktif: boolean;
    olusturmaTarihi?: FirestoreTimestamp;
    guncellemeTarihi?: FirestoreTimestamp;
    silinmeTarihi?: FirestoreTimestamp;
}

// API Response tipi
export interface ApiResponse<T = void> {
    success: boolean;
    message?: string;
    data?: T;
}

// Login sonucu tipi
export interface LoginResult {
    success: boolean;
    message?: string;
    user?: User;
}

// Auth Context tipi
export interface AuthContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<LoginResult>;
    logout: () => Promise<ApiResponse>;
    refreshUser: () => Promise<User | null>;
    isAuthenticated: boolean;
    isMusteri: boolean;
    isTeknisyen: boolean;
    isYonetim: boolean;
}

// Theme Context tipi
export interface ThemeContextType {
    isDark: boolean;
    toggleTheme: () => void;
    colors: ThemeColors;
}

// Tema renkleri
export interface ThemeColors {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    primary: string;
    headerBg: string;
    inputBg: string;
    success: string;
    error: string;
    warning: string;
    info: string;
}
