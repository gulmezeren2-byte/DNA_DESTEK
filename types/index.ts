import { Timestamp } from "firebase/firestore";

export type UserRole = 'yonetim' | 'teknisyen' | 'musteri' | 'yonetim_kurulu';
export type TalepDurum = 'yeni' | 'atandi' | 'islemde' | 'beklemede' | 'cozuldu' | 'iptal' | 'kapatildi';
export type TalepOncelik = 'dusuk' | 'normal' | 'yuksek' | 'acil';

export interface DNAUser {
    id: string;
    uid?: string; // For backward compatibility/auth uid
    email: string;
    ad: string;
    soyad: string;
    telefon?: string;
    rol: UserRole;
    kategori?: string;
    aktif: boolean;
    olusturmaTarihi: Date | Timestamp;
    olusturan?: string;
    avatar?: string;
    hasProfile?: boolean; // USER-001: Firestore profil dokümanı var mı?
}

export interface Talep {
    id: string;
    baslik: string;
    aciklama: string;
    kategori: string;
    oncelik: TalepOncelik | string;
    durum: TalepDurum;

    // Location
    projeAdi: string;
    blokAdi?: string;
    daireNo?: string;
    adres?: string;
    konum?: {
        latitude: number;
        longitude: number;
    };

    // User info
    olusturanId: string;
    olusturanAd?: string;
    olusturanTelefon?: string;
    musteriId?: string; // New: Explicit customer ID for indexing

    // Contact (if distinct from creator)
    musteriAdi?: string;    // Legacy/Alternative
    musteriTelefon?: string; // Legacy/Alternative

    // Images
    fotograflar: string[]; // Base64

    // Comments
    yorumlar?: {
        id?: string;
        mesaj: string;
        tarih: Date | Timestamp;
        yazanAdi?: string;
        yazanRol?: string;
        yazanId?: string;
        // Legacy support
        text?: string;
        yazan?: string;
    }[];

    // Tech Assignment
    atananTeknisyenId?: string;
    atananTeknisyenAdi?: string;
    atananEkipId?: string;
    atananEkipAdi?: string;
    atamaTarihi?: Date | Timestamp;

    // Timestamps
    olusturmaTarihi: Date | Timestamp | { seconds: number, nanoseconds: number };
    cozumTarihi?: Date | Timestamp | { seconds: number, nanoseconds: number }; // NEW
    cozumFotograflari?: string[]; // NEW
    tamamlanmaTarihi?: Date | Timestamp;

    // Feedback
    puan?: number;
    degerlendirme?: string;
    degerlendirmeTarihi?: Date | Timestamp;
}

export interface Ekip {
    id: string;
    ad: string;
    renk: string;
    uyeler: string[]; // User IDs
    aktif: boolean;
    olusturmaTarihi: Date | Timestamp;
    olusturan?: string;
}

export interface Proje {
    id: string;
    ad: string;
    bloklar: { ad: string; daireler: string[] }[];
}

export interface ServiceResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    // For pagination
    lastVisible?: any;
}
