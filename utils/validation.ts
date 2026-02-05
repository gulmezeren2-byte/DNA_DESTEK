/**
 * DNA DESTEK - Validation Utilities
 * Merkezi doğrulama fonksiyonları
 */

/**
 * E-posta formatı doğrulama
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Telefon numarası doğrulama (Türkiye)
 */
export const isValidPhone = (phone: string): boolean => {
    // Boşlukları ve özel karakterleri temizle
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Türkiye telefon formatları: 05XX XXX XX XX veya +90 5XX XXX XX XX
    const phoneRegex = /^(\+90|0)?5[0-9]{9}$/;
    return phoneRegex.test(cleaned);
};

/**
 * Şifre güçlülüğü kontrolü
 * SEC-015 FIX: Enhanced password policy
 */
export const isStrongPassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 6) {
        return { valid: false, message: 'Şifre en az 6 karakter olmalıdır' };
    }
    if (password.length > 128) {
        return { valid: false, message: 'Şifre çok uzun' };
    }
    // SEC-015: Require at least one number or special character
    const hasComplexity = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    if (!hasComplexity) {
        return { valid: false, message: 'Şifre en az bir rakam veya özel karakter içermelidir' };
    }
    return { valid: true, message: '' };
};


/**
 * Boş string kontrolü
 */
export const isNotEmpty = (value: string): boolean => {
    return value.trim().length > 0;
};

/**
 * Minimum karakter kontrolü
 */
export const hasMinLength = (value: string, min: number): boolean => {
    return value.trim().length >= min;
};

/**
 * Maximum karakter kontrolü
 */
export const hasMaxLength = (value: string, max: number): boolean => {
    return value.trim().length <= max;
};

/**
 * Form alanı doğrulama sonucu
 */
export interface ValidationResult {
    valid: boolean;
    errors: Record<string, string>;
}

/**
 * Kullanıcı formu doğrulama
 */
export const validateUserForm = (data: {
    email: string;
    sifre?: string;
    ad: string;
    soyad: string;
    telefon?: string;
    rol: string;
    kategori?: string;
}): ValidationResult => {
    const errors: Record<string, string> = {};

    if (!isNotEmpty(data.email)) {
        errors.email = 'E-posta adresi zorunludur';
    } else if (!isValidEmail(data.email)) {
        errors.email = 'Geçerli bir e-posta adresi girin';
    }

    if (data.sifre !== undefined) {
        const passwordCheck = isStrongPassword(data.sifre);
        if (!passwordCheck.valid) {
            errors.sifre = passwordCheck.message;
        }
    }

    if (!isNotEmpty(data.ad)) {
        errors.ad = 'Ad zorunludur';
    } else if (!hasMinLength(data.ad, 2)) {
        errors.ad = 'Ad en az 2 karakter olmalıdır';
    }

    if (!isNotEmpty(data.soyad)) {
        errors.soyad = 'Soyad zorunludur';
    } else if (!hasMinLength(data.soyad, 2)) {
        errors.soyad = 'Soyad en az 2 karakter olmalıdır';
    }

    if (data.telefon && data.telefon.trim() && !isValidPhone(data.telefon)) {
        errors.telefon = 'Geçerli bir telefon numarası girin';
    }

    if (data.rol === 'teknisyen' && (!data.kategori || !isNotEmpty(data.kategori))) {
        errors.kategori = 'Teknisyen için kategori zorunludur';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
};

/**
 * Talep formu doğrulama
 */
export const validateTalepForm = (data: {
    baslik: string;
    aciklama: string;
    kategori: string;
    projeAdi: string;
}): ValidationResult => {
    const errors: Record<string, string> = {};

    if (!isNotEmpty(data.baslik)) {
        errors.baslik = 'Başlık zorunludur';
    } else if (!hasMinLength(data.baslik, 5)) {
        errors.baslik = 'Başlık en az 5 karakter olmalıdır';
    }

    if (!isNotEmpty(data.aciklama)) {
        errors.aciklama = 'Açıklama zorunludur';
    } else if (!hasMinLength(data.aciklama, 20)) {
        errors.aciklama = 'Açıklama en az 20 karakter olmalıdır';
    }

    if (!isNotEmpty(data.kategori)) {
        errors.kategori = 'Kategori seçimi zorunludur';
    }

    if (!isNotEmpty(data.projeAdi)) {
        errors.projeAdi = 'Proje seçimi zorunludur';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
};
