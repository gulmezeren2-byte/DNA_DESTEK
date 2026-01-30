import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, initializeApp } from "firebase/app";
// @ts-ignore
import * as FirebaseAuth from "firebase/auth";
import {
  Auth,
  browserSessionPersistence,
  User as FirebaseUser,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key is missing! Check .env file.");
}

const app: FirebaseApp = initializeApp(firebaseConfig);

let auth: Auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
  setPersistence(auth, browserSessionPersistence);
} else {
  auth = initializeAuth(app, {
    persistence: (FirebaseAuth as any).getReactNativePersistence(ReactNativeAsyncStorage)
  });
}

// Web'de WebSockets yerine Long Polling kullan (Firewall/Proxy sorunlarını çözer)
const db: Firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// if (Platform.OS === 'web') {
//   enableIndexedDbPersistence(db).catch((err: any) => {
//     if (err.code == 'failed-precondition') {
//       console.warn("Persistence failed: Multiple tabs open.");
//     } else if (err.code == 'unimplemented') {
//       console.warn("Persistence failed: Browser not supported.");
//     }
//   });
// }


const storage = getStorage(app);

// --- Helper Functions ---

// 1. createTalep
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

// 2. getTalepler
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


// 2b. subscribeToTalepler (Realtime)
export const subscribeToTalepler = (userId: string, rol: string, filters: any = {}, callback: (data: { success: boolean, talepler?: any[], message?: string }) => void) => {
  try {
    const talesRef = collection(db, "talepler");
    const { onSnapshot } = require("firebase/firestore"); // Import dynamically if needed or move to top

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

// 3. updateTalepDurum
export const updateTalepDurum = async (talepId: string, yeniDurum: string) => {
  try {
    const talepRef = doc(db, "talepler", talepId);
    await updateDoc(talepRef, { durum: yeniDurum });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// 4. puanlaTalep
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

// 5. uploadImage
export const uploadImage = async (uri: string, path: string) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    return { success: true, downloadURL };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, message: error.message };
  }
};

// 6. getProjeler
export const getProjeler = async () => {
  try {
    const snap = await getDocs(collection(db, "projeler"));
    const projeler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, projeler };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
};

// 7 & 8. getActiveEkipler / getAllEkipler
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

// 9. assignTalepToEkip
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

// 10. getAllUsers (With Robust Role Check)
export const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const users = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const effectiveRole = data.rol || data.role || 'musteri';
      return {
        id: doc.id,
        ...data,
        rol: effectiveRole
      };
    });
    return { success: true, users };
  } catch (error: any) {
    console.error("Kullanıcıları getirme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11. saveEkip
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

// 11b. createEkip
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

// 11c. updateEkip
export const updateEkip = async (ekipId: string, data: any) => {
  try {
    await updateDoc(doc(db, "ekipler", ekipId), data);
    return { success: true };
  } catch (error: any) {
    console.error("Ekip güncelleme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11d. deleteEkip
export const deleteEkip = async (ekipId: string) => {
  try {
    const { deleteDoc } = require("firebase/firestore");
    await deleteDoc(doc(db, "ekipler", ekipId));
    return { success: true };
  } catch (error: any) {
    console.error("Ekip silme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11e. addUserToEkip
export const addUserToEkip = async (ekipId: string, userId: string) => {
  try {
    const { arrayUnion } = require("firebase/firestore");
    await updateDoc(doc(db, "ekipler", ekipId), {
      uyeler: arrayUnion(userId)
    });
    return { success: true };
  } catch (error: any) {
    console.error("Kullanıcı ekleme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11f. removeUserFromEkip
export const removeUserFromEkip = async (ekipId: string, userId: string) => {
  try {
    const { arrayRemove } = require("firebase/firestore");
    await updateDoc(doc(db, "ekipler", ekipId), {
      uyeler: arrayRemove(userId)
    });
    return { success: true };
  } catch (error: any) {
    console.error("Kullanıcı çıkarma hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11g. createDefaultEkipler
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

// 12. createUser (Corrected)
export const createUser = async (userData: any, creatorEmail?: string, adminAuthPassword?: string) => {
  try {
    // Requires firebase/app imports for secondary app instance
    const { initializeApp: initApp } = require("firebase/app");
    const { getAuth: getAuth2, createUserWithEmailAndPassword: createAuth2, signOut: signOut2 } = require("firebase/auth");

    // Create secondary app to create user without logging out admin
    const secondaryAppName = "SecondaryApp-" + new Date().getTime();
    const secondaryApp = initApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth2(secondaryApp);

    const userCredential = await createAuth2(secondaryAuth, userData.email, userData.sifre);
    const newUser = userCredential.user;

    // Save to Firestore using MAIN db instance
    await setDoc(doc(db, "users", newUser.uid), {
      ad: userData.ad,
      soyad: userData.soyad,
      email: userData.email,
      telefon: userData.telefon || "",
      rol: userData.rol,
      kategori: userData.kategori || '',
      aktif: true,
      olusturmaTarihi: new Date()
    });

    await signOut2(secondaryAuth);
    // await deleteApp(secondaryApp); // Can be problematic on web, safe to leave for GC

    return { success: true };
  } catch (error: any) {
    console.error("Kullanıcı oluşturma hatası:", error);
    return { success: false, message: error.message };
  }
};

// 13. updateUser
export const updateUser = async (userId: string, data: any) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, data);
    return { success: true };
  } catch (error: any) {
    console.error("Kullanıcı güncelleme hatası:", error);
    return { success: false, message: error.message };
  }
};

// --- Auth Helpers ---

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
      const data = userDoc.data();
      const effectiveRole = data.rol || data.role || 'musteri';
      return { success: true, user: { uid: user.uid, email: user.email, ...data, rol: effectiveRole } };
    } else {
      return { success: false, message: "Kullanıcı bilgileri bulunamadı." };
    }
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const getCurrentUser = async () => {
  const user = auth.currentUser;
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const effectiveRole = data.rol || data.role || 'musteri';
      return { uid: user.uid, email: user.email, ...data, rol: effectiveRole };
    }
  }
  return null;
};

const normalizeRole = (role: string) => {
  if (!role) return 'musteri';
  const r = role.toLowerCase().trim();
  if (r === 'yonetici' || r === 'admin' || r === 'yonetim' || r === 'manager') return 'yonetim';
  if (r === 'teknisyen' || r === 'teknik' || r === 'technician') return 'teknisyen';
  return 'musteri';
};

const ADMIN_EMAILS = ['admin@dnadestek.com', 'eren.gulmez@dnadestek.com'];

export const onAuthChange = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (!user.email) return; // Should not happen usually

      try {
        console.log(`Auth check for: ${user.email} (${user.uid})`);
        const userDoc = await getDoc(doc(db, "users", user.uid));

        let userData: any = { uid: user.uid, email: user.email, rol: 'musteri' };

        if (userDoc.exists()) {
          const data = userDoc.data();
          // console.log("Firestore User Data:", JSON.stringify(data));

          const rawRole = data.rol || data.role;
          const effectiveRole = normalizeRole(rawRole);

          if (rawRole !== effectiveRole) {
            console.warn(`Role normalized: ${rawRole} -> ${effectiveRole}`);
          }

          userData = { ...userData, ...data, rol: effectiveRole };
        } else {
          console.warn("User document not found in 'users' collection for UID:", user.uid);
          // Fallback logic could go here if using a different collection
        }

        // --- KESİN YETKİ TANIMLAMASI (WHITELIST) ---
        // Veritabanından ne gelirse gelsin, bu mailler YÖNETİCİDİR.
        if (ADMIN_EMAILS.includes(user.email)) {
          console.log("Admin whitelist match. Forcing 'yonetim'.");
          userData.rol = 'yonetim';
        }

        callback(userData);

      } catch (error) {
        console.error("Auth fetch error:", error);

        // Hata durumunda (offline vs) whitelist kontrolü
        if (ADMIN_EMAILS.includes(user.email)) {
          callback({ uid: user.uid, email: user.email, rol: 'yonetim' });
        } else {
          // Fallback to musteri only if we really can't determine
          callback({ uid: user.uid, email: user.email, rol: 'musteri' });
        }
      }
    } else {
      callback(null);
    }
  });
};

export { auth, db, storage };

