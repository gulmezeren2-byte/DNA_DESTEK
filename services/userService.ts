import {
    collection,
    doc,
    getDocs,
    query,
    updateDoc,
    where,
    writeBatch
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { DNAUser, ServiceResponse, UserRole } from "../types";

export const getUsers = async (): Promise<ServiceResponse<DNAUser[]>> => {
    try {
        const q = query(collection(db, "users"));
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DNAUser));
        return { success: true, data: users };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const getUsersByIds = async (userIds: string[]): Promise<ServiceResponse<DNAUser[]>> => {
    try {
        if (!userIds || userIds.length === 0) return { success: true, data: [] };

        // Chunking for Firestore 'in' limit of 10
        const chunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
            chunks.push(userIds.slice(i, i + 10));
        }

        let allUsers: DNAUser[] = [];
        for (const chunk of chunks) {
            const q = query(collection(db, "users"), where("__name__", "in", chunk));
            const snapshot = await getDocs(q);
            allUsers.push(...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DNAUser)));
        }

        return { success: true, data: allUsers };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const updateUserRole = async (userId: string, newRole: UserRole): Promise<ServiceResponse<void>> => {
    try {
        await updateDoc(doc(db, "users", userId), { rol: newRole });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};



export const deleteUser = async (userId: string): Promise<ServiceResponse<void>> => {
    try {
        const batch = writeBatch(db);

        // 1. Kullanıcının oluşturduğu talepleri bul ve sil
        const qOlusturan = query(collection(db, "talepler"), where("olusturanId", "==", userId));
        const snapshotOlusturan = await getDocs(qOlusturan);
        snapshotOlusturan.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 2. Kullanıcının müşteri olduğu talepleri bul ve sil (farklı kayıtlar varsa)
        const qMusteri = query(collection(db, "talepler"), where("musteriId", "==", userId));
        const snapshotMusteri = await getDocs(qMusteri);
        snapshotMusteri.docs.forEach((doc) => {
            // Zaten eklendiyse tekrar eklemeye gerek yok ama batch.delete idempotenttir (genellikle), 
            // ancak firestore batch "same document check" yapabilir. 
            // Basitlik için, ID kontrolü yapabiliriz veya duplicate riskini göze alabiliriz.
            // Firestore Client SDK batch'i duplicate ref'leri handle etmeyebilir, bu yüzden manuel check:
            const isAlreadyDeleted = snapshotOlusturan.docs.some(d => d.id === doc.id);
            if (!isAlreadyDeleted) {
                batch.delete(doc.ref);
            }
        });

        // 3. Kullanıcı profili sil
        const userRef = doc(db, "users", userId);
        batch.delete(userRef);

        // 4. Batch işlemini uygula
        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const toggleUserStatus = async (userId: string, currentStatus: boolean): Promise<ServiceResponse<void>> => {
    try {
        await updateDoc(doc(db, "users", userId), { aktif: !currentStatus });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};
