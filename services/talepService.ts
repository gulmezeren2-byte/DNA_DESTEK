import {
    addDoc,
    collection,
    doc,
    DocumentSnapshot,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    QueryConstraint,
    QuerySnapshot,
    startAfter,
    updateDoc,
    where
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ServiceResponse, Talep, TalepDurum } from "../types";

export const createTalep = async (talepData: Omit<Talep, 'id' | 'olusturmaTarihi' | 'durum'>): Promise<ServiceResponse<{ id: string }>> => {
    try {
        const docRef = await addDoc(collection(db, "talepler"), {
            ...talepData,
            olusturmaTarihi: new Date(),
            durum: 'yeni',
            oncelik: talepData.oncelik || 'normal'
        });
        return { success: true, data: { id: docRef.id } };
    } catch (error: any) {
        console.error("Talep oluşturma hatası:", error);
        return { success: false, message: error.message };
    }
};

export const getTalepler = async (
    userId: string,
    rol: string,
    filters: any = {}, // { durum?: string, durumlar?: string[], oncelik?: string, atanmamis?: boolean, tab?: 'aktif' | 'gecmis' }
    lastDoc: any = null,
    pageSize: number = 20
): Promise<ServiceResponse<Talep[]>> => {
    try {
        let talepler: Talep[] = [];
        let lastVisible: DocumentSnapshot | null = null;
        const talesRef = collection(db, "talepler");

        // Helper to construct base constraints
        const buildConstraints = () => {
            const c: QueryConstraint[] = [];

            if (filters.durum) {
                c.push(where('durum', '==', filters.durum));
            }
            if (filters.durumlar && filters.durumlar.length > 0) {
                c.push(where('durum', 'in', filters.durumlar));
            }
            if (filters.oncelik) {
                c.push(where('oncelik', '==', filters.oncelik));
            }
            return c;
        };

        if (rol === 'musteri') {
            const constraints: QueryConstraint[] = [
                where('olusturanId', '==', userId),
                ...buildConstraints(),
                orderBy('olusturmaTarihi', 'desc')
            ];

            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));

            const q = query(talesRef, ...constraints);
            const snapshot = await getDocs(q);
            talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Talep));
            lastVisible = snapshot.docs[snapshot.docs.length - 1];

        } else if (rol === 'teknisyen') {
            // Teknisyen Logic
            // Geçmiş (Completed) -> Sadece kendi çözdüğü/atandığı ve durumu tamamlanmış olanlar.
            // Aktif -> Kendi atandığı aktifler VE Havuzdaki yeniler.

            if (filters.tab === 'gecmis') {
                // Sadece atananTeknisyenId == user ve durum closed
                const constraints: QueryConstraint[] = [
                    where('atananTeknisyenId', '==', userId),
                    ...buildConstraints(), // durumlar: ['cozuldu', 'iptal', 'kapatildi']
                    orderBy('olusturmaTarihi', 'desc')
                ];
                if (lastDoc) constraints.push(startAfter(lastDoc));
                constraints.push(limit(pageSize));

                const q = query(talesRef, ...constraints);
                const snapshot = await getDocs(q);
                talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Talep));
                lastVisible = snapshot.docs[snapshot.docs.length - 1];

            } else {
                // Aktif Tab (veya filter yoksa default)
                // İki sorgu: Assigned Active & New Pool
                // Pagination active tab'de zor olduğu için, ve genelde sayı az olduğu için
                // pagination'ı "NEW" (yeni) talepler için yapabiliriz veya limit yüksek tutarız.

                // 1. Assigned Active
                // Not: 'in' query ile durumlar filtresi varsa kullan
                const activeStatuses = filters.durumlar || ['atandi', 'islemde', 'beklemede'];
                const qAssigned = query(
                    talesRef,
                    where('atananTeknisyenId', '==', userId),
                    where('durum', 'in', activeStatuses), // durumlar filtresi
                    orderBy('olusturmaTarihi', 'desc')
                );

                // 2. New (Havuz)
                // Sadece 'yeni' durumu
                const qNew = query(talesRef, where('durum', '==', 'yeni'), orderBy('olusturmaTarihi', 'desc'));

                const [snapAssigned, snapNew] = await Promise.all([getDocs(qAssigned), getDocs(qNew)]);

                const mergedMap = new Map<string, Talep>();
                // Önce atananları ekle
                snapAssigned.docs.forEach(d => mergedMap.set(d.id, { id: d.id, ...d.data() } as Talep));

                // Eğer filtre 'yeni' içeriyorsa (ki active tab içerir) yenileri ekle
                if (!filters.durumlar || filters.durumlar.includes('yeni')) {
                    snapNew.docs.forEach(d => mergedMap.set(d.id, { id: d.id, ...d.data() } as Talep));
                }

                talepler = Array.from(mergedMap.values()).sort((a, b) => {
                    const da = (a.olusturmaTarihi as any)?.seconds || 0;
                    const db = (b.olusturmaTarihi as any)?.seconds || 0;
                    return db - da;
                });

                // Teknisyen aktif tab için sonsuz kaydırma geçici olarak devre dışı (veya çok basit implementation)
                // Çünkü merge edilmiş listede cursor yönetimi zor.
                // 100 item teknisyen için yeterli olacaktır.
                lastVisible = null;
            }

        } else {
            // Yönetim - WHERE clauses BEFORE orderBy
            const constraints: QueryConstraint[] = [];

            if (filters.durum) constraints.push(where('durum', '==', filters.durum));
            if (filters.durumlar) constraints.push(where('durum', 'in', filters.durumlar));
            if (filters.oncelik) constraints.push(where('oncelik', '==', filters.oncelik));
            if (filters.atanmamis) constraints.push(where('durum', '==', 'yeni'));

            // orderBy comes AFTER where clauses
            constraints.push(orderBy("olusturmaTarihi", "desc"));

            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));

            const q = query(talesRef, ...constraints);
            const snapshot = await getDocs(q);
            talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Talep));
            lastVisible = snapshot.docs[snapshot.docs.length - 1];
        }

        return { success: true, data: talepler, lastVisible };
    } catch (error: any) {
        console.error("Talepleri getirme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const subscribeToTalepler = (
    userId: string,
    rol: string,
    filters: any = {},
    callback: (data: ServiceResponse<Talep[]>) => void
) => {
    try {
        const talesRef = collection(db, "talepler");
        const unsubscribes: (() => void)[] = [];

        // Helper
        const buildConstraints = () => {
            const c: QueryConstraint[] = [];
            if (filters.durum) c.push(where('durum', '==', filters.durum));
            if (filters.durumlar && filters.durumlar.length > 0) c.push(where('durum', 'in', filters.durumlar));
            if (filters.oncelik) c.push(where('oncelik', '==', filters.oncelik));
            return c;
        };

        if (rol === 'musteri') {
            const constraints: QueryConstraint[] = [
                where('olusturanId', '==', userId),
                ...buildConstraints(),
                orderBy('olusturmaTarihi', 'desc'),
                limit(50)
            ];

            const q = query(talesRef, ...constraints);
            const unsub = onSnapshot(q, (snapshot) => {
                const talepler = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Talep));
                callback({ success: true, data: talepler, lastVisible: snapshot.docs[snapshot.docs.length - 1] });
            }, (error) => {
                console.error("Realtime error:", error);
                callback({ success: false, message: error.message });
            });
            unsubscribes.push(unsub);

        } else if (rol === 'teknisyen') {
            if (filters.tab === 'gecmis') {
                // Sadece Completed
                const constraints: QueryConstraint[] = [
                    where('atananTeknisyenId', '==', userId),
                    ...buildConstraints(),
                    orderBy('olusturmaTarihi', 'desc'),
                    limit(50)
                ];
                const q = query(talesRef, ...constraints);
                const unsub = onSnapshot(q, (snapshot) => {
                    const talepler = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Talep));
                    callback({ success: true, data: talepler, lastVisible: snapshot.docs[snapshot.docs.length - 1] });
                }, (error) => callback({ success: false, message: error.message }));
                unsubscribes.push(unsub);
            } else {
                // Aktif Tab: Mixed listening
                // 1. Assigned Active
                const activeStatuses = filters.durumlar || ['atandi', 'islemde', 'beklemede'];
                const qAssigned = query(
                    talesRef,
                    where('atananTeknisyenId', '==', userId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                );

                // 2. New (Havuz) - if applicable
                // Only if filter doesn't exclude 'yeni'
                let qNew: any = null;
                if (!filters.durumlar || filters.durumlar.includes('yeni')) {
                    qNew = query(talesRef, where('durum', '==', 'yeni'), orderBy('olusturmaTarihi', 'desc'), limit(50));
                }

                // We need to merge results from potential 2 listeners.
                // This is stateful.
                let assignedDocs: Talep[] = [];
                let newDocs: Talep[] = [];

                const mergeAndSend = () => {
                    const mergedMap = new Map<string, Talep>();
                    assignedDocs.forEach(d => mergedMap.set(d.id, d));
                    newDocs.forEach(d => mergedMap.set(d.id, d));

                    const sorted = Array.from(mergedMap.values()).sort((a, b) => {
                        const da = (a.olusturmaTarihi as any)?.seconds || 0;
                        const db = (b.olusturmaTarihi as any)?.seconds || 0;
                        return db - da;
                    });
                    callback({ success: true, data: sorted, lastVisible: null });
                };

                const unsub1 = onSnapshot(qAssigned, (snap: QuerySnapshot) => {
                    assignedDocs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Talep));
                    mergeAndSend();
                }, (err: Error) => callback({ success: false, message: err.message }));
                unsubscribes.push(unsub1);

                if (qNew) {
                    const unsub2 = onSnapshot(qNew, (snap: QuerySnapshot) => {
                        newDocs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Talep));
                        mergeAndSend();
                    }, (err: Error) => console.log("New docs error", err)); // Fail silently for secondary
                    unsubscribes.push(unsub2);
                }
            }
        } else {
            // Yönetim
            const constraints: QueryConstraint[] = [];

            // WHERE clauses must come BEFORE orderBy
            if (filters.durum) constraints.push(where('durum', '==', filters.durum));
            if (filters.durumlar) constraints.push(where('durum', 'in', filters.durumlar));
            if (filters.oncelik) constraints.push(where('oncelik', '==', filters.oncelik));
            if (filters.atanmamis) constraints.push(where('durum', '==', 'yeni'));

            // orderBy comes AFTER where clauses
            constraints.push(orderBy('olusturmaTarihi', 'desc'));
            constraints.push(limit(50));

            console.log('🔍 Yönetim Filter Query:', { filters, constraintCount: constraints.length });

            const q = query(talesRef, ...constraints);
            const unsub = onSnapshot(q, (snapshot) => {
                console.log('📊 Yönetim data received:', snapshot.docs.length, 'items');
                const talepler = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Talep));
                callback({ success: true, data: talepler, lastVisible: snapshot.docs[snapshot.docs.length - 1] });
            }, (error) => {
                console.error('❌ Yönetim snapshot error:', error);
                callback({ success: false, message: error.message });
            });
            unsubscribes.push(unsub);
        }

        return () => {
            unsubscribes.forEach(u => u());
        };

    } catch (error: any) {
        console.error("Subscribe error:", error);
        callback({ success: false, message: error.message });
        return () => { };
    }
};

export const updateTalepDurum = async (talepId: string, yeniDurum: TalepDurum): Promise<ServiceResponse<void>> => {
    try {
        const talepRef = doc(db, "talepler", talepId);
        await updateDoc(talepRef, { durum: yeniDurum });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const puanlaTalep = async (talepId: string, puan: number, yorum: string): Promise<ServiceResponse<void>> => {
    try {
        const talepRef = doc(db, "talepler", talepId);
        await updateDoc(talepRef, {
            puan: puan,
            degerlendirme: yorum,
            degerlendirmeTarihi: new Date()
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};
