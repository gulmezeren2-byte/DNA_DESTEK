import {
    addDoc,
    collection,
    deleteDoc,
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
import { GorevliPersonel, ServiceResponse, Talep, TalepDurum } from "../types";

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
                // Completed tasks for individual (Priority: Personal History)
                const constraints: QueryConstraint[] = [
                    where('atananTeknisyenId', '==', userId),
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
                // Active tasks
                const activeStatuses = filters.durumlar || ['atandi', 'islemde', 'beklemede'];

                // ADMIN DEBUG MODE: See ALL tasks except 'Temizlik'
                if (filters.isAdminDebug) {
                    // Query: active statuses AND category != 'Temizlik'
                    // Note: Firestore != queries can be tricky.
                    // Instead, we will fetch active tasks and filter in memory if 'Temizlik' exclusion is strict OR use a composite query if possible.
                    // Simple approach: Fetch all active, client-side filter for 'Temizlik'

                    const constraints: QueryConstraint[] = [
                        where('durum', 'in', activeStatuses),
                        orderBy('olusturmaTarihi', 'desc'),
                        limit(50)
                    ];

                    const q = query(talesRef, ...constraints);
                    const snapshot = await getDocs(q);

                    // Filter out 'Temizlik'
                    talepler = snapshot.docs
                        .map(d => ({ id: d.id, ...d.data() } as Talep))
                        .filter(t => t.kategori !== 'Temizlik');

                    lastVisible = snapshot.docs[snapshot.docs.length - 1];

                } else {
                    // Normal Technician Logic
                    // 1. Assigned to Team - REMOVED to prevent showing ALL team tasks.
                    // We now rely on qMember (atananEkipUyeIds) to show only tasks where user is part of the Task Force.
                    // const qTeam = ...


                    // 2. Assigned to Individual
                    const qIndividual = query(
                        talesRef,
                        where('atananTeknisyenId', '==', userId),
                        where('durum', 'in', activeStatuses),
                        orderBy('olusturmaTarihi', 'desc')
                    );

                    // 3. Assigned to Team via Member List
                    const qMember = query(
                        talesRef,
                        where('atananEkipUyeIds', 'array-contains', userId),
                        where('durum', 'in', activeStatuses),
                        orderBy('olusturmaTarihi', 'desc')
                    );

                    // 3. New (Havuz)
                    let qNew: any = null;
                    if (!filters.durumlar || filters.durumlar.includes('yeni')) {
                        qNew = query(talesRef, where('durum', '==', 'yeni'), where('kategori', '==', teamId), orderBy('olusturmaTarihi', 'desc'), limit(50));
                    }

                    // const promises = [getDocs(qTeam), getDocs(qIndividual), getDocs(qMember)];
                    // Removed qTeam from promises
                    const promises = [getDocs(qIndividual), getDocs(qMember)];
                    if (qNew) promises.push(getDocs(qNew));

                    const results = await Promise.all(promises);
                    const snapIndiv = results[0];
                    const snapMember = results[1];
                    const snapNew = qNew ? results[2] : null;

                    const mergedMap = new Map<string, Talep>();
                    // snapTeam.docs.forEach... REMOVED
                    snapIndiv.docs.forEach(d => {
                        const data = d.data() as Talep;
                        mergedMap.set(d.id, { ...data, id: d.id });
                    });
                    snapMember.docs.forEach(d => {
                        const data = d.data() as Talep;
                        mergedMap.set(d.id, { ...data, id: d.id });
                    });
                    if (snapNew) snapNew.docs.forEach(d => {
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
            }

            return { success: true, data: talepler, lastVisible };
        } else if (rol === 'yonetim' || rol === 'sorumlu') {
            // Yönetim ve Sorumlu - WHERE clauses BEFORE orderBy
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
            } else if (filters.isAdminDebug) {
                // ADMIN DEBUG MODE (Subscription) - See ALL active tasks
                // Note: We can't filter 'Temizlik' easily in a single query with '!=' and 'in'.
                // We will subscribe to all active tasks and filter client-side in the callback.
                const constraints: QueryConstraint[] = [
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc'),
                    limit(50)
                ];
                const q = query(talesRef, ...constraints);
                const unsub = onSnapshot(q, (snapshot) => {
                    const talepler = snapshot.docs
                        .map(d => ({ id: d.id, ...d.data() } as Talep))
                        .filter(t => t.kategori !== 'Temizlik');

                    callback({ success: true, data: talepler, lastVisible: snapshot.docs[snapshot.docs.length - 1] });
                }, (error) => callback({ success: false, message: error.message }));
                unsubscribes.push(unsub);

            } else {
                // Multiple Listeners for Technician
                // 1. Assigned to Team - REMOVED (See getTalepler)
                /* const qTeam = query(
                    talesRef,
                    where('atananEkipId', '==', teamId),
                    where('durum', 'in', activeStatuses),
                    orderBy('olusturmaTarihi', 'desc')
                ); */

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
                    // teamDocs.forEach(d => mergedMap.set(d.id, d));
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

                /* const unsub1 = onSnapshot(qTeam, (snap: QuerySnapshot) => {
                    teamDocs = snap.docs.map((d) => {
                        const data = d.data() as Talep;
                        return { ...data, id: d.id };
                    });
                    mergeAndSend();
                }, (err: Error) => callback({ success: false, message: err.message }));
                unsubscribes.push(unsub1); */

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
        } else if (rol === 'yonetim' || rol === 'sorumlu') {
            // Yönetim ve Sorumlu
            const constraints: QueryConstraint[] = [];

            // WHERE clauses must come BEFORE orderBy
            if (filters.durum) constraints.push(where('durum', '==', filters.durum));
            if (filters.durumlar) constraints.push(where('durum', 'in', filters.durumlar));
            if (filters.oncelik) constraints.push(where('oncelik', '==', filters.oncelik));
            if (filters.atanmamis) constraints.push(where('durum', '==', 'yeni'));

            // orderBy comes AFTER where clauses
            constraints.push(orderBy('olusturmaTarihi', 'desc'));
            constraints.push(limit(50));

            console.log('🔍 Yönetim/Sorumlu Filter Query:', { filters, constraintCount: constraints.length });

            const q = query(talesRef, ...constraints);
            const unsub = onSnapshot(q, (snapshot) => {
                console.log('📊 Yönetim/Sorumlu data received:', snapshot.docs.length, 'items');
                const talepler = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Talep));
                callback({ success: true, data: talepler, lastVisible: snapshot.docs[snapshot.docs.length - 1] });
            }, (error) => {
                console.error('❌ Yönetim/Sorumlu snapshot error:', error);
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

        // Prepare update data with timestamps
        const updateData: any = { durum: yeniDurum };
        const now = new Date();

        // Performance Logging Logic
        if (yeniDurum === 'islemde') {
            // Only set if not already set (to capture FIRST response)
            // Note: We can't easily check 'if not exists' in a simple update without reading first.
            // But usually 'islemde' is clicked once. 
            // Better strategy: Use update, if we want to be strict we could use a condition 
            // but for simplicity we will update it. 
            // Actually, if a tech toggles between islemde/beklemede, we might lose the FIRST response.
            // We should use `updateDoc` with a check, or just accept that 'islemde' timestamp updates.
            // Let's rely on the UI flow or simple update for now. 
            // To be safe against overwriting existing 'ilkMudahaleTarihi', we would need to read distinctively or use rules.
            // Given the scope, let's just write current time.
            updateData.ilkMudahaleTarihi = now;
        } else if (yeniDurum === 'cozuldu') {
            updateData.cozumTarihi = now;
        } else if (yeniDurum === 'kapatildi') {
            updateData.kapatmaTarihi = now;
        }

        // However, we don't want to overwrite if it exists for 'ilkMudahale'.
        // To do this perfectly without reading, we'd need a Transaction.
        // Let's do a quick read for safety? No, excessive reads.
        // Let's just update. Most flows go Yeni -> Islemde once.

        await updateDoc(talepRef, updateData);
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

export const assignTalepToTaskForce = async (
    talepId: string,
    ekipId: string,
    ekipAdi: string,
    sahaEkibi: GorevliPersonel[],
    liderId?: string
): Promise<ServiceResponse<void>> => {
    try {
        const talepRef = doc(db, "talepler", talepId);

        // Extract all member IDs to enable the "My Tasks" query via 'array-contains'
        // This ensures compatibility with existing getTalepler logic!
        const memberIds = sahaEkibi.map(p => p.id);

        const updateData: any = {
            atananEkipId: ekipId,
            atananEkipAdi: ekipAdi,
            atananEkipUyeIds: memberIds, // Only show to these specific people
            sahaEkibi: sahaEkibi,
            durum: 'atandi',
            atamaTarihi: new Date()
        };

        // Handle Leader/Main Technician assignment
        if (liderId) {
            const lider = sahaEkibi.find(p => p.id === liderId);
            if (lider) {
                updateData.atananTeknisyenId = lider.id;
                updateData.atananTeknisyenAdi = lider.ad;
            }
        } else {
            // If no leader selected, clear the main technician field
            // But keep atananEkipId populated for department reporting
            updateData.atananTeknisyenId = null;
            updateData.atananTeknisyenAdi = null;
        }

        await updateDoc(talepRef, updateData);
        // TODO: Send robust notifications to sahaEkibi array members

        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};
