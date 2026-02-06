import { Timestamp } from "firebase/firestore";

export type UserRole = 'yonetim' | 'teknisyen' | 'musteri' | 'yonetim_kurulu' | 'sorumlu';
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

// Görev Gücü (Field Crew) Üyesi
export interface GorevliPersonel {
    id: string;      // Kullanıcı ID (UID)
    ad: string;      // Görüntülenen Ad
    rol: 'lider' | 'destek'; // Ekip lideri mi yoksa yardımcı eleman mı?
    atamaTarihi: any; // Timestamp
}

export interface Talep {
    id: string;
    musteriId: string;
    musteriAdi: string;
    musteriTelefon?: string;
    projeId: string;
    projeAdi: string;
    blokId?: string;
    blokAdi?: string;
    daireNo?: string;
    kategori: string;
    baslik: string;
    aciklama: string;
    fotograflar: string[];
    durum: TalepDurum; // 'yeni' | 'atandi' | 'islemde' | 'cozuldu' | 'kapatildi' | 'iptal'
    oncelik: 'normal' | 'acil';
    olusturanId: string;
    olusturanAd: string;
    olusturanTelefon?: string; // Lint fix
    olusturmaTarihi: any; // Timestamp
    // Atama Bilgileri
    atananEkipId?: string;
    atananEkipAdi?: string;
    atananEkipUyeIds?: string[]; // Ekipteki tüm üyelerin ID'leri (Genel ekip işi)

    // YENİ: Görev Gücü (Spesifik olarak sahaya gidenler)
    sahaEkibi?: GorevliPersonel[];

    atananTeknisyenId?: string; // Geri uyumluluk için (Ana Sorumlu)
    atananTeknisyenAdi?: string; // Geri uyumluluk için

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


    // Timestamps

    ilkMudahaleTarihi?: Date | Timestamp | { seconds: number, nanoseconds: number }; // NEW: Performance metric
    baslangicFotrafi?: string; // NEW: Mandatory start photo
    cozumTarihi?: Date | Timestamp | { seconds: number, nanoseconds: number }; // NEW
    kapatmaTarihi?: Date | Timestamp | { seconds: number, nanoseconds: number }; // NEW: Performance metric
    cozumFotograflari?: string[]; // NEW
    tamamlanmaTarihi?: Date | Timestamp;

    // Feedback
    puan?: number;
    degerlendirme?: string;
    degerlendirmeTarihi?: Date | Timestamp;

    // Appointment System
    randevuTercihleri?: RandevuSlot[];
    kesinlesenRandevu?: RandevuSlot;

    // Excel Entegrasyonu & Yeni Alanlar
    cozumAciklamasi?: string; // Yapılan İşlem / Müdahale Sonucu
    kullanilanMalzemeler?: string[]; // Kullanılan Malzeme
    maliyet?: number; // Maliyet / Tutar
    yoneticiNotu?: string; // Özel Not (Dahili)
    talepKanali?: 'telefon' | 'whatsapp' | 'uygulama' | 'elden' | 'web'; // Kaynak
    garantiKapsami?: 'garanti' | 'ucretli' | 'belirsiz'; // Gri Alan Kararı
    karariVeren?: string; // Kararı Veren Kişi/Rol
}

export interface RandevuSlot {
    baslangic: Timestamp | { seconds: number, nanoseconds: number };
    bitis: Timestamp | { seconds: number, nanoseconds: number };
    secildi: boolean;
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
