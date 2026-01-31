import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDocs,
    updateDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export const getProjeler = async () => {
    try {
        const snap = await getDocs(collection(db, "projeler"));
        const projeler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { success: true, projeler };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const getAllEkipler = async () => {
    try {
        const snap = await getDocs(collection(db, "ekipler"));
        const ekipler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { success: true, ekipler };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const getActiveEkipler = getAllEkipler;

export const assignTalepToEkip = async (talepId: string, ekipId: string, ekipAdi: string) => {
    try {
        const talepRef = doc(db, "talepler", talepId);
        await updateDoc(talepRef, {
            atananEkipId: ekipId,
            atananEkipAdi: ekipAdi,
            durum: 'atandi',
            atamaTarihi: new Date()
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const saveEkip = async (ekipData: any) => {
    try {
        if (ekipData.id) {
            await updateDoc(doc(db, "ekipler", ekipData.id), ekipData);
        } else {
            await addDoc(collection(db, "ekipler"), ekipData);
        }
        return { success: true };
    } catch (error: any) {
        console.error("Ekip kaydetme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const createEkip = async (ekipData: any) => {
    try {
        const docRef = await addDoc(collection(db, "ekipler"), {
            ...ekipData,
            uyeler: ekipData.uyeler || [],
            aktif: true,
            olusturmaTarihi: new Date()
        });
        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error("Ekip oluşturma hatası:", error);
        return { success: false, message: error.message };
    }
};

export const updateEkip = async (ekipId: string, data: any) => {
    try {
        await updateDoc(doc(db, "ekipler", ekipId), data);
        return { success: true };
    } catch (error: any) {
        console.error("Ekip güncelleme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const deleteEkip = async (ekipId: string) => {
    try {
        await deleteDoc(doc(db, "ekipler", ekipId));
        return { success: true };
    } catch (error: any) {
        console.error("Ekip silme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const addUserToEkip = async (ekipId: string, userId: string) => {
    try {
        await updateDoc(doc(db, "ekipler", ekipId), {
            uyeler: arrayUnion(userId)
        });
        return { success: true };
    } catch (error: any) {
        console.error("Kullanıcı ekleme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const removeUserFromEkip = async (ekipId: string, userId: string) => {
    try {
        await updateDoc(doc(db, "ekipler", ekipId), {
            uyeler: arrayRemove(userId)
        });
        return { success: true };
    } catch (error: any) {
        console.error("Kullanıcı çıkarma hatası:", error);
        return { success: false, message: error.message };
    }
};

export const createDefaultEkipler = async () => {
    try {
        const defaultEkipler = [
            { ad: 'Elektrik Ekibi', renk: '#3b82f6', uyeler: [], aktif: true },
            { ad: 'Sıhhi Tesisat Ekibi', renk: '#10b981', uyeler: [], aktif: true },
            { ad: 'Yapı & Tadilat Ekibi', renk: '#f59e0b', uyeler: [], aktif: true },
        ];

        for (const ekip of defaultEkipler) {
            await addDoc(collection(db, "ekipler"), {
                ...ekip,
                olusturmaTarihi: new Date()
            });
        }
        return { success: true };
    } catch (error: any) {
        console.error("Varsayılan ekipler oluşturma hatası:", error);
        return { success: false, message: error.message };
    }
};
