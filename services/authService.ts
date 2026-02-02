import {
    initializeApp
} from "firebase/app";
import {
    User as FirebaseUser,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocFromServer,
    getDocs,
    getDocsFromServer,
    setDoc,
    updateDoc
} from "firebase/firestore";
import { APP_CONFIG } from "../constants";
import { auth, db } from "../firebaseConfig";

// Re-create config for secondary app usage (createUser) AND REST API access
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

// Helper: Try to get doc from server, fallback to cache
const getUserDocSafe = async (uid: string) => {
    try {
        // First try server to get latest role/data
        return await getDocFromServer(doc(db, "users", uid));
    } catch (e) {
        console.warn("Server read failed, falling back to cache:", e);
        return await getDoc(doc(db, "users", uid));
    }
};

// --- REST API FALLBACK UTILITIES ---
const writeUserToFirestoreViaRest = async (userDocData: any, token: string) => {
    const projectId = firebaseConfig.projectId;
    if (!projectId) {
        console.error("Missing Project ID in config, cannot use REST API.");
        return false;
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userDocData.id}`;

    // Convert to Firestore JSON format
    const fields: any = {};
    for (const [key, value] of Object.entries(userDocData)) {
        if (value instanceof Date) {
            fields[key] = { timestampValue: value.toISOString() };
        } else if (typeof value === 'boolean') {
            fields[key] = { booleanValue: value };
        } else if (typeof value === 'number') {
            fields[key] = { integerValue: String(value) };
        } else if (value === null || value === undefined) {
            fields[key] = { nullValue: null };
        } else {
            fields[key] = { stringValue: String(value) };
        }
    }

    try {
        console.log("Attempting REST API Patch to bypass SDK block/Restore Admin...");
        const response = await fetch(url + "?updateMask.fieldPaths=id&updateMask.fieldPaths=ad&updateMask.fieldPaths=soyad&updateMask.fieldPaths=email&updateMask.fieldPaths=telefon&updateMask.fieldPaths=rol&updateMask.fieldPaths=kategori&updateMask.fieldPaths=aktif&updateMask.fieldPaths=olusturmaTarihi&updateMask.fieldPaths=olusturan", {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`REST Write Failed: ${response.status} ${errText}`);
            return false;
        }

        console.log("REST API Write Successful!");
        return true;
    } catch (e) {
        console.error("REST API Fetch Error:", e);
        return false;
    }
};

// AUTO-PROVISIONING FOR MISSING ADMINS (Recovery Feature)
const checkAndRestoreAdminProfile = async (user: FirebaseUser) => {
    if (!user.email) return null;

    if (APP_CONFIG.ADMIN_EMAILS.includes(user.email)) {
        console.log("Admin Whitelist Match: Checking if profile exists...");
        // Check if doc exists
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            console.warn("⚠️ Admin Whitelisted User found WITHOUT Firestore Profile! Attempting auto-restore...");

            const adminData = {
                id: user.uid,
                ad: "Admin",
                soyad: "User",
                email: user.email,
                telefon: "",
                rol: "yonetim", // FORCE YONETIM ROLE
                kategori: "",
                aktif: true,
                olusturmaTarihi: new Date(),
                olusturan: "sistem_recovery"
            };

            // Try SDK Write first
            try {
                await setDoc(doc(db, "users", user.uid), adminData);
                console.log("✅ Admin Profile Auto-Restored via SDK.");
                return adminData;
            } catch (e) {
                console.warn("SDK Restore failed, trying REST...", e);
                // Try REST Write
                try {
                    const token = await user.getIdToken();
                    const success = await writeUserToFirestoreViaRest(adminData, token);
                    if (success) {
                        console.log("✅ Admin Profile Auto-Restored via REST.");
                        return adminData;
                    }
                } catch (restErr) {
                    console.error("REST Restore failed:", restErr);
                }
            }
        }
    }
    return null;
};

export const onAuthChange = (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
        if (user) {
            if (!user.email) return;

            // --- ADMIN RECOVERY CHECK ---
            await checkAndRestoreAdminProfile(user);
            // ----------------------------

            // Firestore'dan veri çekmeyi dene (Önce sunucu)
            const userDocPromise = getUserDocSafe(user.uid);
            // 5 saniye bekle (Sunucu yanıt vermezse)
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 5000));

            let firestoreData = {};
            try {
                const result: any = await Promise.race([userDocPromise, timeoutPromise]);
                if (result && result.exists()) {
                    firestoreData = result.data();
                } else {
                    console.log("Firestore profile read timed out or empty, using basic auth info.");
                }
            } catch (e) {
                console.warn("Firestore profile fetch failed:", e);
            }

            let userData: any = { uid: user.uid, email: user.email, rol: 'musteri', ...firestoreData };

            // Normalize role
            const rawRole = userData.rol || userData.role;
            const effectiveRole = normalizeRole(rawRole);
            userData.rol = effectiveRole;

            // --- KESİN YETKİ TANIMLAMASI (WHITELIST) ---
            if (APP_CONFIG.ADMIN_EMAILS.includes(user.email)) {
                // Just in case checkAndRestore failed but we want to grant session access
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

        // --- ADMIN RECOVERY CHECK BEFORE FETCHING DOC ---
        // This ensures the doc exists before we try to read it
        await checkAndRestoreAdminProfile(user);
        // ------------------------------------------------

        // Force server read on login to get fresh role
        const userDoc = await getUserDocSafe(user.uid);

        if (userDoc.exists()) {
            const data = userDoc.data();
            const effectiveRole = normalizeRole(data.rol || data.role);
            return { success: true, user: { uid: user.uid, email: user.email, ...data, rol: effectiveRole } };
        } else {
            // Should not happen for Admins now due to restore logic
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
        const userDoc = await getUserDocSafe(user.uid);
        if (userDoc.exists()) {
            const data = userDoc.data();
            const effectiveRole = normalizeRole(data.rol || data.role);
            return { uid: user.uid, email: user.email, ...data, rol: effectiveRole };
        }
    }
    return null;
};

export const createUser = async (userData: any, creatorEmail?: string, adminAuthPassword?: string) => {
    let secondaryApp: any = null;
    try {
        console.log("Creating new user (v4 - Hybrid REST Fallback) with data:", JSON.stringify(userData));

        // Create secondary app to create user without logging out admin
        const secondaryAppName = "SecondaryApp-" + new Date().getTime();
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.sifre);
        const newUser = userCredential.user;
        console.log("User created in Auth:", newUser.uid);

        // IMMEDIATE SIGN OUT from secondary to prevent potential interference
        await signOut(secondaryAuth);
        console.log("Secondary Auth signed out.");

        // Normalize and log role
        const normalizedRole = normalizeRole(userData.rol);
        const userDocData = {
            id: newUser.uid,
            ad: userData.ad,
            soyad: userData.soyad,
            email: userData.email,
            telefon: userData.telefon || "",
            rol: normalizedRole,
            kategori: userData.kategori || '',
            aktif: true,
            olusturmaTarihi: new Date(),
            olusturan: creatorEmail || 'admin'
        };

        console.log(`Role raw: ${userData.rol} -> normalized: ${normalizedRole}`);

        if (!auth.currentUser) {
            console.error("CRITICAL: Admin user appears to be logged out! Cannot write to DB.");
            throw new Error("Admin oturumu kapalı görünüyor.");
        }

        console.log("Writing to DB as Admin:", auth.currentUser.uid);

        // HYBRID WRITE STRATEGY
        // 1. Try SDK (Main DB) with short timeout
        // 2. If fails, try REST API immediately

        let sdkWriteSuccess = false;
        try {
            console.log("Attempting SDK setDoc...");
            const writePromise = setDoc(doc(db, "users", newUser.uid), userDocData).then(() => "success");
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000)); // 3s timeout

            const result = await Promise.race([writePromise, timeoutPromise]);
            if (result === "success") {
                sdkWriteSuccess = true;
                console.log("SDK Write Success");
            } else {
                console.warn("SDK Write Timed Out (3s).");
            }
        } catch (e) {
            console.warn("SDK Write Error:", e);
        }

        if (sdkWriteSuccess) {
            return { success: true };
        }

        // FALLBACK TO REST API
        console.warn("Falling back to REST API for user profile creation...");
        try {
            const token = await auth.currentUser.getIdToken();
            const restSuccess = await writeUserToFirestoreViaRest(userDocData, token);

            if (restSuccess) {
                return { success: true };
            } else {
                throw new Error("Hem SDK hem REST API ile yazma başarısız oldu. İnternet bağlantınızı kontrol edin.");
            }
        } catch (restError: any) {
            console.error("Fallback failed:", restError);
            throw new Error("Kullanıcı profili oluşturulamadı (Bağlantı Hatası): " + restError.message);
        }

    } catch (error: any) {
        console.error("Kullanıcı oluşturma hatası:", error);
        return { success: false, message: error.message };
    } finally {
        // Cleanup if possible
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
        // Force server read to ensure list is up to date
        let querySnapshot;
        try {
            querySnapshot = await getDocsFromServer(collection(db, "users"));
        } catch (e) {
            console.warn("Server list read failed, using cache:", e);
            querySnapshot = await getDocs(collection(db, "users"));
        }

        const users = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const effectiveRole = normalizeRole(data.rol || data.role);
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
