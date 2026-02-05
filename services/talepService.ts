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
            musteriId: talepData.musteriId || talepData.olusturanId, // Veri bütünlüğü için
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
            // Technician sees:
            // 1. Tasks assigned to them personally (atananTeknisyenId)
            // 2. Tasks assigned to their team (atananEkipId or matching category)
            // 3. New tasks in the pool (status == 'yeni')

            const teamId = filters.kategori || userId; // Fallback to userId if kategori not provided

            if (filters.tab === 'gecmis') {
                // Completed tasks for team or individual
                const constraints: QueryConstraint[] = [
                    where('atananEkipId', '==', teamId),
                    ...buildConstraints(),
                    orderBy('olusturmaTarihi', 'desc')
                ];
                if (lastDoc) constraints.push(startAfter(lastDoc));
                constraints.push(limit(pageSize));

                const q = query(talesRef, ...constraints);
                const snapshot = await getDocs(q);
                talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Talep));
                lastVisible = snapshot.docs[snapshot.docs.length - 1];

            } else {
                // Active tasks: Both Team and Individual
                const activeStatuses = filters.durumlar || ['atandi', 'islemde', 'beklemede'];

                // 1. Assigned to Team
                const qTeam = query(
                    talesRef,
                    where('atananEkipId', '==', teamId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                );

                // 2. Assigned to Individual
                const qIndividual = query(
                    talesRef,
                    where('atananTeknisyenId', '==', userId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                );

                // 3. Assigned to Team via Member List (NEW: Robust Query)
                const qMember = query(
                    talesRef,
                    where('atananEkipUyeIds', 'array-contains', userId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                );

                // 3. New (Havuz) - if requested or default
                // SEC-003 FIX: Must include kategori filter to match Firestore rules
                let qNew: any = null;
                if (!filters.durumlar || filters.durumlar.includes('yeni')) {
                    qNew = query(talesRef, where('durum', '==', 'yeni'), where('kategori', '==', teamId), orderBy('olusturmaTarihi', 'desc'), limit(50));
                }

                const promises = [getDocs(qTeam), getDocs(qIndividual), getDocs(qMember)];
                if (qNew) promises.push(getDocs(qNew));

                const results = await Promise.all(promises);
                const snapTeam = results[0];
                const snapIndiv = results[1];
                const snapMember = results[2];
                const snapNew = qNew ? results[3] : null;

                const mergedMap = new Map<string, Talep>();
                snapTeam.docs.forEach(d => {
                    const data = d.data() as Talep;
                    mergedMap.set(d.id, { ...data, id: d.id });
                });
                snapIndiv.docs.forEach(d => {
                    const data = d.data() as Talep;
                    mergedMap.set(d.id, { ...data, id: d.id });
                });
                snapMember.docs.forEach(d => {
                    const data = d.data() as Talep;
                    mergedMap.set(d.id, { ...data, id: d.id });
                });
                if (snapNew) snapNew.docs.forEach(d => {
                    // Filter pool by category if provided
                    const data = d.data() as Talep;
                    if (!filters.kategori || data.kategori === filters.kategori) {
                        mergedMap.set(d.id, { ...data, id: d.id });
                    }
                });

                talepler = Array.from(mergedMap.values()).sort((a, b) => {
                    const da = (a.olusturmaTarihi as any)?.seconds || 0;
                    const db = (b.olusturmaTarihi as any)?.seconds || 0;
                    return db - da;
                });

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
            const teamId = filters.kategori || userId;
            const activeStatuses = filters.durumlar || ['atandi', 'islemde', 'beklemede'];

            if (filters.tab === 'gecmis') {
                const constraints: QueryConstraint[] = [
                    where('atananEkipId', '==', teamId),
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
                // Multiple Listeners for Technician
                // 1. Assigned to Team (Check both ID and Member List for robustness)
                const qTeam = query(
                    talesRef,
                    where('atananEkipId', '==', teamId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                );

                // 2. Assigned to Individual
                const qIndividual = query(
                    talesRef,
                    where('atananTeknisyenId', '==', userId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                );

                // 3. Assigned to Team via Member List (NEW: Robust Query)
                const qMember = query(
                    talesRef,
                    where('atananEkipUyeIds', 'array-contains', userId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                );

                // SEC-003 FIX: Must include kategori filter to match Firestore rules
                let qNew: any = null;
                if (!filters.durumlar || filters.durumlar.includes('yeni')) {
                    qNew = query(talesRef, where('durum', '==', 'yeni'), where('kategori', '==', teamId), orderBy('olusturmaTarihi', 'desc'), limit(50));
                }

                let teamDocs: Talep[] = [];
                let indivDocs: Talep[] = [];
                let memberDocs: Talep[] = [];
                let newDocs: Talep[] = [];

                const mergeAndSend = () => {
                    const mergedMap = new Map<string, Talep>();
                    teamDocs.forEach(d => mergedMap.set(d.id, d));
                    indivDocs.forEach(d => mergedMap.set(d.id, d));
                    memberDocs.forEach(d => mergedMap.set(d.id, d));
                    newDocs.forEach(d => {
                        if (!filters.kategori || d.kategori === filters.kategori) {
                            mergedMap.set(d.id, d);
                        }
                    });

                    const sorted = Array.from(mergedMap.values()).sort((a, b) => {
                        const da = (a.olusturmaTarihi as any)?.seconds || 0;
                        const db = (b.olusturmaTarihi as any)?.seconds || 0;
                        return db - da;
                    });
                    callback({ success: true, data: sorted, lastVisible: null });
                };

                const unsub1 = onSnapshot(qTeam, (snap: QuerySnapshot) => {
                    teamDocs = snap.docs.map((d) => {
                        const data = d.data() as Talep;
                        return { ...data, id: d.id };
                    });
                    mergeAndSend();
                }, (err: Error) => callback({ success: false, message: err.message }));
                unsubscribes.push(unsub1);

                const unsub2 = onSnapshot(qIndividual, (snap: QuerySnapshot) => {
                    indivDocs = snap.docs.map((d) => {
                        const data = d.data() as Talep;
                        return { ...data, id: d.id };
                    });
                    mergeAndSend();
                }, (err: Error) => console.log("Individual docs error", err));
                unsubscribes.push(unsub2);

                const unsubMember = onSnapshot(qMember, (snap: QuerySnapshot) => {
                    memberDocs = snap.docs.map((d) => {
                        const data = d.data() as Talep;
                        return { ...data, id: d.id };
                    });
                    mergeAndSend();
                }, (err: Error) => console.log("Member docs error", err));
                unsubscribes.push(unsubMember);

                if (qNew) {
                    const unsub3 = onSnapshot(qNew, (snap: QuerySnapshot) => {
                        newDocs = snap.docs.map((d) => {
                            const data = d.data() as Talep;
                            return { ...data, id: d.id };
                        });
                        mergeAndSend();
                    }, (err: Error) => console.log("New docs error", err));
                    unsubscribes.push(unsub3);
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

export const deleteTalep = async (talepId: string): Promise<ServiceResponse<void>> => {
    try {
        await deleteDoc(doc(db, "talepler", talepId));
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};
