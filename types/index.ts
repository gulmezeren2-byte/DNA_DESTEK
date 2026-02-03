import { Timestamp } from "firebase/firestore";

export type UserRole = 'yonetim' | 'teknisyen' | 'musteri';
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
    // pushToken is now stored in push_tokens collection, removed here.
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
