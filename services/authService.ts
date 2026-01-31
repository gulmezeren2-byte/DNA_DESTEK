import {
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc
} from "firebase/firestore";
import { APP_CONFIG } from "../constants";
import { auth, db } from "../firebaseConfig";

// Re-create config for secondary app usage (createUser)
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const normalizeRole = (role: string) => {
    if (!role) return 'musteri';
    const r = role.toLowerCase().trim();
    if (r === 'yonetici' || r === 'admin' || r === 'yonetim' || r === 'manager') return 'yonetim';
    if (r === 'teknisyen' || r === 'teknik' || r === 'technician') return 'teknisyen';
    return 'musteri';
};


// ...

export const onAuthChange = (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
        if (user) {
            if (!user.email) return; // Should not happen usually

            // Firestore'dan veri çekmeyi dene (Maksimum 3 saniye bekle)
            const userDocPromise = getDoc(doc(db, "users", user.uid));
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));

            let firestoreData = {};
            try {
                const result: any = await Promise.race([userDocPromise, timeoutPromise]);
                if (result && result.exists()) {
                    firestoreData = result.data();
                } else {
                    console.log("Firestore cached profile read timed out or empty, using basic auth info.");
                }
            } catch (e) {
                console.warn("Firestore profile fetch failed:", e);
            }

            let userData: any = { uid: user.uid, email: user.email, rol: 'musteri', ...firestoreData };

            const rawRole = userData.rol || userData.role;
            const effectiveRole = normalizeRole(rawRole);
            userData.rol = effectiveRole;

            // --- KESİN YETKİ TANIMLAMASI (WHITELIST) ---
            if (APP_CONFIG.ADMIN_EMAILS.includes(user.email)) {
                console.log("Admin whitelist match. Forcing 'yonetim'.");
                userData.rol = 'yonetim';
            }

            callback(userData);

        } else {
            callback(null);
        }
    });
};

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
