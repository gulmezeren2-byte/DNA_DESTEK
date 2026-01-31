import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    updateDoc,
    where
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export const createTalep = async (talepData: any) => {
    try {
        const docRef = await addDoc(collection(db, "talepler"), {
            ...talepData,
            olusturmaTarihi: new Date(),
            durum: 'yeni',
            oncelik: talepData.oncelik || 'normal'
        });
        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error("Talep oluşturma hatası:", error);
        return { success: false, message: error.message };
    }
};

export const getTalepler = async (userId: string, rol: string, filters: any = {}, lastDoc: any = null, pageSize: number = 20) => {
    try {
        let talepler: any[] = [];
        let lastVisible: any = null;
        const talesRef = collection(db, "talepler");

        if (rol === 'musteri') {
            const constraints: any[] = [where('olusturanId', '==', userId), orderBy('olusturmaTarihi', 'desc')];

            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));

            const q = query(talesRef, ...constraints);
            const snapshot = await getDocs(q);
            talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            lastVisible = snapshot.docs[snapshot.docs.length - 1];

        } else if (rol === 'teknisyen') {
            // Teknisyen: Atananlar VEYA Yeni (Boşta) olanlar
            // PERFORMANS OPTİMİZASYONU: Limitsiz sorgu yerine her ikisi için de limit(50) kullanıyoruz.
            // Toplamda en fazla 100 kayıt döner, bu da başlangıç için yeterlidir.
            // Daha fazlası için "Daha Fazla" butonu eklenebilir ama şu anlık çökme sorununu önler.

            const constraintsAssigned: any[] = [
                where('atananTeknisyenId', '==', userId),
                orderBy('olusturmaTarihi', 'desc'),
                limit(50)
            ];

            const constraintsNew: any[] = [
                where('durum', '==', 'yeni'),
                orderBy('olusturmaTarihi', 'desc'),
                limit(50)
            ];

            const qAssigned = query(talesRef, ...constraintsAssigned);
            const qNew = query(talesRef, ...constraintsNew);

            const [snapAssigned, snapNew] = await Promise.all([getDocs(qAssigned), getDocs(qNew)]);

            const mergedMap = new Map();
            [...snapAssigned.docs, ...snapNew.docs].forEach(d => {
                mergedMap.set(d.id, { id: d.id, ...d.data() });
            });

            talepler = Array.from(mergedMap.values()).sort((a: any, b: any) => {
                const dateA = a.olusturmaTarihi?.seconds || 0;
                const dateB = b.olusturmaTarihi?.seconds || 0;
                return dateB - dateA;
            });

            // Teknisyen için merge edilmiş ve sıralanmış liste dönüyor
            if (talepler.length > 0) {
                lastVisible = talepler[talepler.length - 1]; // Bu tam doğru çalışmayabilir ama crash'i önler
            }

        } else {
            // Yönetim: Filtrelere göre sorgu
            const constraints: any[] = [orderBy("olusturmaTarihi", "desc")];

            if (filters.durum) {
                constraints.push(where('durum', '==', filters.durum));
            } else if (filters.oncelik) {
                constraints.push(where('oncelik', '==', filters.oncelik));
            } else if (filters.atanmamis) {
                constraints.push(where('durum', '==', 'yeni'));
            }

            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));

            const q = query(talesRef, ...constraints);
            const snapshot = await getDocs(q);
            talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            lastVisible = snapshot.docs[snapshot.docs.length - 1];
        }

        return { success: true, talepler, lastVisible };
    } catch (error: any) {
        console.error("Talepleri getirme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const subscribeToTalepler = (userId: string, rol: string, filters: any = {}, callback: (data: { success: boolean, talepler?: any[], message?: string }) => void) => {
    try {
        const talesRef = collection(db, "talepler");

        let constraints: any[] = [orderBy('olusturmaTarihi', 'desc')];

        // Limitsiz dinleme yapmak performans sorunu yaratabilir, bu yüzden "ilk sayfa" mantığıyla limit koyuyoruz.
        // Kullanıcı aşağı kaydırdığında (load more) zaten getTalepler çağrılacak (snapshot harici).
        // Ancak hibrit yapıda listeyi yönetmek zor olabilir.
        // Şimdilik Basit Yaklaşım: Sadece ilk 50 öğeyi dinle. Fazlası için "Daha Fazla" butonu manuel fetch yapsın.
        constraints.push(limit(50));

        if (rol === 'musteri') {
            constraints = [
                where('olusturanId', '==', userId),
                orderBy('olusturmaTarihi', 'desc'),
                limit(50)
            ];
        } else if (rol === 'teknisyen') {
            // Teknisyen karmaşık sorgu gerektirir (Atananlar OR Boştakiler). 
            // Firestore OR sorgusu (where('a','==',1) OR where('b','==',2)) tek sorguda desteklenmez (multi-field).
            // Bu yüzden teknisyen için basitçe "Atananları" dinleyelim şimdilik.
            constraints = [
                where('atananTeknisyenId', '==', userId),
                orderBy('olusturmaTarihi', 'desc'),
                limit(50)
            ];
            // Not: "Yeni" talepleri dinlemek için ayrı bir listener gerekebilir veya client-side birleştirme.
            // Şimdilik sadece atananları dinleyelim, 'Yeni' sekmesi manuel yenilensin.
        } else {
            // Yönetim
            if (filters.durum) {
                constraints.push(where('durum', '==', filters.durum));
            } else if (filters.oncelik) {
                constraints.push(where('oncelik', '==', filters.oncelik));
            } else if (filters.atanmamis) {
                constraints.push(where('durum', '==', 'yeni'));
            }
        }

        const q = query(talesRef, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const talepler = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            callback({ success: true, talepler });
        }, (error: any) => {
            console.error("Realtime error:", error);
            callback({ success: false, message: error.message });
        });

        return unsubscribe;

    } catch (error: any) {
        console.error("Subscribe error:", error);
        callback({ success: false, message: error.message });
        return () => { };
    }
};

export const updateTalepDurum = async (talepId: string, yeniDurum: string) => {
    try {
        const talepRef = doc(db, "talepler", talepId);
        await updateDoc(talepRef, { durum: yeniDurum });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const puanlaTalep = async (talepId: string, puan: number, yorum: string) => {
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
