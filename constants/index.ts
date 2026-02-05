/**
 * DNA DESTEK - Global Constants
 * Merkezi sabitler ve yapılandırma değerleri
 */

// Rol tanımları
export const ROLES = {
    MUSTERI: 'musteri',
    TEKNISYEN: 'teknisyen',
    YONETIM: 'yonetim',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Durum tanımları
export const DURUM = {
    YENI: 'yeni',
    ATANDI: 'atandi',
    ISLEMDE: 'islemde',
    BEKLEMEDE: 'beklemede',
    COZULDU: 'cozuldu',
    IPTAL: 'iptal',
    KAPATILDI: 'kapatildi',
} as const;

export type TalepDurum = typeof DURUM[keyof typeof DURUM];

// Öncelik tanımları
export const ONCELIK = {
    NORMAL: 'normal',
    ACIL: 'acil',
} as const;

export type TalepOncelik = typeof ONCELIK[keyof typeof ONCELIK];

// Kategori seçenekleri
export const KATEGORILER = [
    'Tesisat',
    'Elektrik',
    'Boya',
    'Mobilya',
    'Pencere',
    'Kapı',
    'Zemin/Parke',
    'Isıtma/Soğutma',
    'Diğer',
] as const;

export type Kategori = typeof KATEGORILER[number];

// Durum renkleri ve konfigürasyonu
export const DURUM_CONFIG = {
    [DURUM.YENI]: {
        bg: '#e3f2fd',
        bgDark: '#1a3a5c',
        text: '#1565c0',
        textDark: '#64b5f6',
        icon: 'hourglass-outline',
        label: 'Yeni',
        labelTR: 'Sırada',
        message: 'Talebiniz değerlendirme sırasına alındı',
    },
    [DURUM.ATANDI]: {
        bg: '#fff3e0',
        bgDark: '#3a2a1a',
        text: '#ef6c00',
        textDark: '#ffb74d',
        icon: 'person-outline',
        label: 'Atandı',
        labelTR: 'Atandı',
        message: 'Bir teknisyen görevlendirildi',
    },
    [DURUM.ISLEMDE]: {
        bg: '#e8f5e9',
        bgDark: '#1a3a1a',
        text: '#2e7d32',
        textDark: '#81c784',
        icon: 'construct-outline',
        label: 'İşlemde',
        labelTR: 'İşlemde',
        message: 'Sorun üzerinde çalışılıyor',
    },
    [DURUM.BEKLEMEDE]: {
        bg: '#fce4ec',
        bgDark: '#3a1a2a',
        text: '#c2185b',
        textDark: '#f48fb1',
        icon: 'pause-circle-outline',
        label: 'Beklemede',
        labelTR: 'Beklemede',
        message: 'Ek bilgi veya malzeme bekleniyor',
    },
    [DURUM.COZULDU]: {
        bg: '#e0f2f1',
        bgDark: '#1a3a3a',
        text: '#00796b',
        textDark: '#4db6ac',
        icon: 'checkmark-circle',
        label: 'Çözüldü',
        labelTR: 'Çözüldü',
        message: 'Sorun başarıyla giderildi',
    },
    [DURUM.IPTAL]: {
        bg: '#ffebee',
        bgDark: '#3a1a1a',
        text: '#c62828',
        textDark: '#ef5350',
        icon: 'close-circle',
        label: 'İptal',
        labelTR: 'İptal Edildi',
        message: 'Bu talep iptal edildi',
    },
    [DURUM.KAPATILDI]: {
        bg: '#eceff1',
        bgDark: '#2a2a2a',
        text: '#546e7a',
        textDark: '#90a4ae',
        icon: 'archive-outline',
        label: 'Kapatıldı',
        labelTR: 'Kapatıldı',
        message: 'Talep kapatıldı',
    },
} as const;

// Rol renkleri ve konfigürasyonu
export const ROL_CONFIG = {
    [ROLES.MUSTERI]: {
        label: 'Müşteri',
        color: '#1565c0',
        icon: 'person',
    },
    [ROLES.TEKNISYEN]: {
        label: 'Teknisyen',
        color: '#ef6c00',
        icon: 'construct',
    },
    [ROLES.YONETIM]: {
        label: 'Yönetim',
        color: '#7b1fa2',
        icon: 'shield-checkmark',
    },
} as const;

// Uygulama sabitleri
export const APP_CONFIG = {
    APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'DNA DESTEK',
    APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
    MAX_PHOTO_COUNT: 5,
    MAX_SOLUTION_PHOTO_COUNT: 3,
    PHOTO_MAX_WIDTH: 800,
    PHOTO_QUALITY: 0.7,
    PHOTO_COMPRESS: 0.6,
    /**
     * SEC-008 WARNING: ADMIN_EMAILS is for CLIENT-SIDE UI HINTS ONLY!
     * 
     * THE SOURCE OF TRUTH IS: firestore.rules -> isAdminEmail() function
     * 
     * This list does NOT grant admin access. It only controls:
     * - UI hints (showing admin-like interface elements)
     * - Client-side role suggestions during signup
     * 
     * To change who has admin access, EDIT BOTH:
     * 1. firestore.rules (isAdminEmail function) - REQUIRED for security
     * 2. This list - Optional for UI consistency
     * 
     * If these get out of sync, Firestore rules will ALWAYS win.
     */
    ADMIN_EMAILS: ['admin@dnadestek.com', 'eren.gulmez@dnadestek.com'] as string[],
} as const;


// Firebase hata mesajları (Türkçe)
export const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
    'auth/user-not-found': 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı',
    'auth/wrong-password': 'Şifre hatalı',
    'auth/invalid-email': 'Geçersiz e-posta adresi',
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor',
    'auth/weak-password': 'Şifre en az 6 karakter olmalıdır',
    'auth/too-many-requests': 'Çok fazla başarısız deneme. Lütfen bekleyin.',
    'auth/network-request-failed': 'İnternet bağlantısı yok',
    'auth/requires-recent-login': 'Bu işlem için yeniden giriş yapmalısınız',
    'permission-denied': 'Bu işlem için yetkiniz yok',
    'unavailable': 'Sunucu şu anda kullanılamıyor. Lütfen tekrar deneyin.',
};

// Firebase hata mesajını Türkçe'ye çevir
export const getFirebaseErrorMessage = (errorCode: string): string => {
    return FIREBASE_ERROR_MESSAGES[errorCode] || 'Bir hata oluştu. Lütfen tekrar deneyin.';
};
