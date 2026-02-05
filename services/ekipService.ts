import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    updateDoc,
    where
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Ekip, Proje, ServiceResponse } from "../types";

export const getProjeler = async (): Promise<ServiceResponse<Proje[]>> => {
    try {
        const snap = await getDocs(collection(db, "projeler"));
        const projeler = snap.docs.map(d => ({ id: d.id, ...d.data() } as Proje));
        return { success: true, data: projeler }; // Changed to data
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const getAllEkipler = async (): Promise<ServiceResponse<Ekip[]>> => {
    try {
        const snap = await getDocs(collection(db, "ekipler"));
        const ekipler = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ekip));
        return { success: true, data: ekipler }; // Changed to data
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const getActiveEkipler = getAllEkipler;

export const assignTalepToEkip = async (talepId: string, ekipId: string, ekipAdi: string): Promise<ServiceResponse<void>> => {
    try {
        // Fetch team members first to enable efficient "My Tasks" query
        const ekipRef = doc(db, "ekipler", ekipId);
        const ekipSnap = await getDocs(query(collection(db, "ekipler"), where("__name__", "==", ekipId))); // getDoc alternative if not imported

        let memberIds: string[] = [];
        // Since we didn't import getDoc from firestore in the top imports (it is imported as doc, but not getDoc function), 
        // we can use the existing getDocs logic or just import getDoc. 
        // I will stick to existing imports or better yet, since we have 'doc', we just need 'getDoc'.
        // Actually, looking at imports line 8, 'getDocs' is there. 'getDoc' is NOT.
        // I will use getDocs with ID query or safer: import getDoc. But I cannot change imports easily with replace_file_content of a block.
        // Wait, line 8 imports: getDocs.

        // Let's assume passed 'ekipId' is valid.
        const ekipQuery = query(collection(db, "ekipler"), where("__name__", "==", ekipId));
        const ekipSnapshot = await getDocs(ekipQuery);

        if (!ekipSnapshot.empty) {
            const ekipData = ekipSnapshot.docs[0].data() as Ekip;
            memberIds = ekipData.uyeler || [];
        }

        const talepRef = doc(db, "talepler", talepId);
        await updateDoc(talepRef, {
            atananEkipId: ekipId,
            atananEkipAdi: ekipAdi,
            atananEkipUyeIds: memberIds, // NEW: For efficient querying "array-contains"
            durum: 'atandi',
            atamaTarihi: new Date()
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const saveEkip = async (ekipData: Partial<Ekip>): Promise<ServiceResponse<void>> => {
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

export const createEkip = async (ekipData: Omit<Ekip, 'id' | 'olusturmaTarihi' | 'uyeler' | 'aktif'>): Promise<ServiceResponse<{ id: string }>> => {
    try {
        const docRef = await addDoc(collection(db, "ekipler"), {
            ...ekipData,
            uyeler: [],
            aktif: true,
            olusturmaTarihi: new Date()
        });
        return { success: true, data: { id: docRef.id } };
    } catch (error: any) {
        console.error("Ekip oluşturma hatası:", error);
        return { success: false, message: error.message };
    }
};

export const updateEkip = async (ekipId: string, data: Partial<Ekip>): Promise<ServiceResponse<void>> => {
    try {
        await updateDoc(doc(db, "ekipler", ekipId), data);
        return { success: true };
    } catch (error: any) {
        console.error("Ekip güncelleme hatası:", error);
        return { success: false, message: error.message };
    }
};

// Helper to check for active tasks
const checkActiveTasksForTeam = async (ekipId: string): Promise<boolean> => {
    const q = query(
        collection(db, "talepler"),
        where("atananEkipId", "==", ekipId),
        where("durum", "in", ["yeni", "islemde", "atandi", "beklemede"]) // Active statuses
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
};

export const deleteEkip = async (ekipId: string): Promise<ServiceResponse<void>> => {
    try {
        // 1. Check Integrity
        const hasActiveTasks = await checkActiveTasksForTeam(ekipId);
        if (hasActiveTasks) {
            return {
                success: false,
                message: "Bu ekibe atanmış aktif talepler var! Önce talepleri başka ekibe atayın veya kapatın."
            };
        }

        // 2. Safe to delete
        await deleteDoc(doc(db, "ekipler", ekipId));
        return { success: true };
    } catch (error: any) {
        console.error("Ekip silme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const addUserToEkip = async (ekipId: string, userId: string): Promise<ServiceResponse<void>> => {
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

export const removeUserToEkip = async (ekipId: string, userId: string): Promise<ServiceResponse<void>> => {
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

// Also export as removeUserFromEkip to match original export if needed, or update consumers
export const removeUserFromEkip = removeUserToEkip;


export const createDefaultEkipler = async (): Promise<ServiceResponse<void>> => {
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
