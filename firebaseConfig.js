import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  getReactNativePersistence,
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
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
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

const app = initializeApp(firebaseConfig);

let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
  setPersistence(auth, browserSessionPersistence);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
}

/** @type {import("firebase/firestore").Firestore} */
const db = getFirestore(app);

const storage = getStorage(app);

// --- Helper Functions ---

// 1. createTalep
export const createTalep = async (talepData) => {
  try {
    const docRef = await addDoc(collection(db, "talepler"), {
      ...talepData,
      olusturmaTarihi: new Date(),
      durum: 'yeni',
      oncelik: talepData.oncelik || 'normal'
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Talep oluşturma hatası:", error);
    return { success: false, message: error.message };
  }
};

// 2. getTalepler
export const getTalepler = async (userId, rol) => {
  try {
    let talepler = [];
    const talesRef = collection(db, "talepler");

    if (rol === 'musteri') {
      const q = query(talesRef, where('olusturanId', '==', userId), orderBy('olusturmaTarihi', 'desc'));
      const snapshot = await getDocs(q);
      talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    } else if (rol === 'teknisyen') {
      // Teknisyen: Atananlar VEYA Yeni (Boşta) olanlar
      const qAssigned = query(talesRef, where('atananTeknisyenId', '==', userId), orderBy('olusturmaTarihi', 'desc'));
      const qNew = query(talesRef, where('durum', '==', 'yeni'), orderBy('olusturmaTarihi', 'desc'));

      const [snapAssigned, snapNew] = await Promise.all([getDocs(qAssigned), getDocs(qNew)]);

      const mergedMap = new Map();
      [...snapAssigned.docs, ...snapNew.docs].forEach(d => {
        mergedMap.set(d.id, { id: d.id, ...d.data() });
      });

      talepler = Array.from(mergedMap.values()).sort((a, b) => {
        // Timestamp kontrolü ve sıralama
        const dateA = a.olusturmaTarihi?.seconds || 0;
        const dateB = b.olusturmaTarihi?.seconds || 0;
        return dateB - dateA;
      });

    } else {
      // Yönetim: Hepsi
      const q = query(talesRef, orderBy("olusturmaTarihi", "desc"));
      const snapshot = await getDocs(q);
      talepler = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    return { success: true, talepler };
  } catch (error) {
    console.error("Talepleri getirme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 3. updateTalepDurum
export const updateTalepDurum = async (talepId, yeniDurum) => {
  try {
    const talepRef = doc(db, "talepler", talepId);
    await updateDoc(talepRef, { durum: yeniDurum });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// 4. puanlaTalep
export const puanlaTalep = async (talepId, puan, yorum) => {
  try {
    const talepRef = doc(db, "talepler", talepId);
    await updateDoc(talepRef, {
      puan: puan,
      degerlendirme: yorum,
      degerlendirmeTarihi: new Date()
    });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// 5. uploadImage
export const uploadImage = async (uri, path) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    return { success: true, downloadURL };
  } catch (error) {
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
  } catch (e) {
    return { success: false, message: e.message };
  }
};

// 7 & 8. getActiveEkipler / getAllEkipler
export const getAllEkipler = async () => {
  try {
    const snap = await getDocs(collection(db, "ekipler"));
    const ekipler = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, ekipler };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
export const getActiveEkipler = getAllEkipler;

// 9. assignTalepToEkip
export const assignTalepToEkip = async (talepId, ekipId, ekipAdi) => {
  try {
    const talepRef = doc(db, "talepler", talepId);
    await updateDoc(talepRef, {
      atananEkipId: ekipId,
      atananEkipAdi: ekipAdi,
      durum: 'atandi',
      atamaTarihi: new Date()
    });
    return { success: true };
  } catch (e) {
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
  } catch (error) {
    console.error("Kullanıcıları getirme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11. saveEkip
export const saveEkip = async (ekipData) => {
  try {
    if (ekipData.id) {
      await updateDoc(doc(db, "ekipler", ekipData.id), ekipData);
    } else {
      await addDoc(collection(db, "ekipler"), ekipData);
    }
    return { success: true };
  } catch (error) {
    console.error("Ekip kaydetme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11b. createEkip
export const createEkip = async (ekipData) => {
  try {
    const docRef = await addDoc(collection(db, "ekipler"), {
      ...ekipData,
      uyeler: ekipData.uyeler || [],
      aktif: true,
      olusturmaTarihi: new Date()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Ekip oluşturma hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11c. updateEkip
export const updateEkip = async (ekipId, data) => {
  try {
    await updateDoc(doc(db, "ekipler", ekipId), data);
    return { success: true };
  } catch (error) {
    console.error("Ekip güncelleme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11d. deleteEkip
export const deleteEkip = async (ekipId) => {
  try {
    const { deleteDoc } = require("firebase/firestore");
    await deleteDoc(doc(db, "ekipler", ekipId));
    return { success: true };
  } catch (error) {
    console.error("Ekip silme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11e. addUserToEkip
export const addUserToEkip = async (ekipId, userId) => {
  try {
    const { arrayUnion } = require("firebase/firestore");
    await updateDoc(doc(db, "ekipler", ekipId), {
      uyeler: arrayUnion(userId)
    });
    return { success: true };
  } catch (error) {
    console.error("Kullanıcı ekleme hatası:", error);
    return { success: false, message: error.message };
  }
};

// 11f. removeUserFromEkip
export const removeUserFromEkip = async (ekipId, userId) => {
  try {
    const { arrayRemove } = require("firebase/firestore");
    await updateDoc(doc(db, "ekipler", ekipId), {
      uyeler: arrayRemove(userId)
    });
    return { success: true };
  } catch (error) {
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
  } catch (error) {
    console.error("Varsayılan ekipler oluşturma hatası:", error);
    return { success: false, message: error.message };
  }
};

// 12. createUser (Corrected)
export const createUser = async (userData, creatorEmail, adminAuthPassword) => {
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
  } catch (error) {
    console.error("Kullanıcı oluşturma hatası:", error);
    return { success: false, message: error.message };
  }
};

// 13. updateUser
export const updateUser = async (userId, data) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, data);
    return { success: true };
  } catch (error) {
    console.error("Kullanıcı güncelleme hatası:", error);
    return { success: false, message: error.message };
  }
};

// --- Auth Helpers ---

export const loginUser = async (email, password) => {
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
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
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

const normalizeRole = (role) => {
  if (!role) return 'musteri';
  const r = role.toLowerCase().trim();
  if (r === 'yonetici' || r === 'admin' || r === 'yonetim' || r === 'manager') return 'yonetim';
  if (r === 'teknisyen' || r === 'teknik' || r === 'technician') return 'teknisyen';
  return 'musteri';
};

const ADMIN_EMAILS = ['admin@dnadestek.com', 'eren.gulmez@dnadestek.com'];

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        console.log(`Auth check for: ${user.email} (${user.uid})`);
        const userDoc = await getDoc(doc(db, "users", user.uid));

        let userData = { uid: user.uid, email: user.email, rol: 'musteri' };

        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log("Firestore User Data:", JSON.stringify(data)); // DEBUG LOG

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

