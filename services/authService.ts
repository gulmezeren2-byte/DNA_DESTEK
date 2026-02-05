import { initializeApp } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    User as FirebaseUser,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";
import {
    collection,
    doc,
    DocumentSnapshot,
    getDoc,
    getDocFromServer,
    getDocs,
    getDocsFromServer,
    setDoc,
    updateDoc
} from "firebase/firestore";
import { APP_CONFIG } from "../constants";
import { db, firebaseConfig, getAuthInstance } from "../firebaseConfig";
import { DNAUser, ServiceResponse, UserRole } from "../types";
import { AuditLog } from "./auditService";

// SEC-005 FIX: Strict role normalization - only accept exact matches
const normalizeRole = (role: string | undefined): UserRole => {
    if (!role) return 'musteri';
    const r = role.toLowerCase().trim();
    // Accept only exact canonical role values
    if (r === 'yonetim') return 'yonetim';
    if (r === 'yonetim_kurulu') return 'yonetim_kurulu';
    if (r === 'teknisyen') return 'teknisyen';
    if (r === 'musteri') return 'musteri';
    // Unknown roles default to musteri (least privileged)
    console.warn(`SEC-005: Unknown role "${role}" defaulted to musteri`);
    return 'musteri';
};

// Helper: Try to get doc from server, fallback to cache
const getUserDocSafe = async (uid: string): Promise<DocumentSnapshot> => {
    try {
        // First try server to get latest role/data
        return await getDocFromServer(doc(db, "users", uid));
    } catch (e) {
        console.warn("Server read failed, falling back to cache:", e);
        return await getDoc(doc(db, "users", uid));
    }
};

// --- REST API FALLBACK UTILITIES ---
const writeUserToFirestoreViaRest = async (userDocData: any, token: string): Promise<boolean> => {
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
const checkAndRestoreAdminProfile = async (user: FirebaseUser): Promise<any | null> => {
    if (!user.email) return null;

    if (APP_CONFIG.ADMIN_EMAILS.includes(user.email)) {
        console.log(`Admin Whitelist Match: Checking if profile exists for ${user.email}...`);

        try {
            // SEC-012: Ensure App Check is ready before Firestore read
            const { isAppCheckReady } = await import("../firebaseConfig");
            await isAppCheckReady;

            // Optional: Small delay to ensure auth token is fully hydrated on web
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check if doc exists with TIMEOUT
            const docPromise = getDoc(doc(db, "users", user.uid));
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Admin Check Timed Out")), 5000));

            const userDoc: any = await Promise.race([docPromise, timeoutPromise]);

            if (!userDoc.exists()) {
                console.warn("⚠️ Admin Whitelisted User found WITHOUT Firestore Profile! Attempting auto-restore...");

                const adminData: Partial<DNAUser> = {
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
        } catch (err) {
            console.warn("⚠️ Admin check skipped due to timeout/error:", err);
            // Return null to allow app to open even if check fails
            return null;
        }
    }
    return null;
};

export const onAuthChange = (callback: (user: DNAUser | null) => void) => {
    let unsubscribe: (() => void) | undefined;

    // Initialize auth lazily, then set up listener
    getAuthInstance().then((auth) => {
        if (auth) {
            try {
                unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
                    if (user) {
                        if (!user.email) return;

                        console.log(`Auth state change: ${user.email} (${user.uid})`);

                        // --- ADMIN RECOVERY CHECK ---
                        await checkAndRestoreAdminProfile(user);
                        // ----------------------------

                        // Ensure App Check is ready before Firestore calls in this callback
                        const { isAppCheckReady } = await import("../firebaseConfig");
                        await isAppCheckReady;

                        // Firestore'dan veri çekmeyi dene (Önce sunucu)
                        const userDocPromise = getUserDocSafe(user.uid);
                        // 5 saniye bekle (Sunucu yanıt vermezse)
                        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 5000));

                        let firestoreData: any = {};
                        let hasProfile = false;
                        try {
                            const result: any = await Promise.race([userDocPromise, timeoutPromise]);
                            if (result && result.exists()) {
                                firestoreData = result.data();
                                hasProfile = true;
                            } else {
                                console.log("Firestore profile read timed out or empty, using basic auth info.");
                            }
                        } catch (e) {
                            console.warn("Firestore profile fetch failed:", e);
                        }

                        let userData: any = { uid: user.uid, email: user.email, rol: 'musteri', hasProfile, ...firestoreData };

                        // Normalize role
                        const rawRole = userData.rol || userData.role;
                        const effectiveRole = normalizeRole(rawRole);
                        userData.rol = effectiveRole;

                        // SEC-002 FIX: Role is now ONLY determined by Firestore data.
                        // Admin whitelist (isAdminEmail) is enforced in Firestore rules, NOT here.
                        // Client-side override was a security risk (privilege escalation).

                        callback(userData as DNAUser);

                    } else {
                        callback(null);
                    }
                });
            } catch (err) {
                console.error("Critical: onAuthStateChanged failed.", err);
                callback(null);
            }
        } else {
            console.warn("Auth object is missing after initialization.");
            callback(null);
        }
    }).catch((err) => {
        console.error("Auth initialization failed in onAuthChange:", err);
        callback(null);
    });

    return () => {
        if (unsubscribe) unsubscribe();
    };
};

export const loginUser = async (email: string, password: string): Promise<ServiceResponse<{ user: DNAUser }>> => {
    try {
        const auth = await getAuthInstance();
        if (!auth) {
            return { success: false, message: "Kimlik doğrulama servisi başlatılamadı." };
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // --- ADMIN RECOVERY CHECK BEFORE FETCHING DOC ---
        // This ensures the doc exists before we try to read it
        await checkAndRestoreAdminProfile(user);
        // ------------------------------------------------

        if (!user.email) {
            return { success: false, message: "E-posta adresi bulunamadı." };
        }

        // Force server read on login to get fresh role
        const userDoc = await getUserDocSafe(user.uid);

        if (userDoc.exists()) {
            const data = userDoc.data();

            // CHECK: Is Account Active?
            if (data?.aktif === false) {
                await signOut(auth); // Immediately sign out
                return { success: false, message: "Hesabınız pasif durumdadır. Yönetici ile iletişime geçin." };
            }

            // @ts-ignore
            const effectiveRole = normalizeRole(data?.rol || data?.role);

            // SEC-010: Audit log for successful login
            AuditLog.loginSuccess(user.uid, user.email);

            return {
                success: true,
                data: {
                    user: {
                        id: user.uid,
                        uid: user.uid,
                        email: user.email,
                        ...data,
                        rol: effectiveRole,
                        hasProfile: true
                    } as DNAUser
                }
            };
        } else {
            // Should not happen for Admins now due to restore logic
            return { success: false, message: "Kullanıcı bilgileri bulunamadı." };
        }
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const logoutUser = async (): Promise<ServiceResponse<void>> => {
    try {
        const auth = await getAuthInstance();
        if (auth) {
            await signOut(auth);
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const getCurrentUser = async (): Promise<DNAUser | null> => {
    const auth = await getAuthInstance();
    if (!auth) return null;

    const user = auth.currentUser;
    if (user) {
        const userDoc = await getUserDocSafe(user.uid);
        if (userDoc.exists()) {
            const data = userDoc.data();
            // @ts-ignore
            const effectiveRole = normalizeRole(data?.rol || data?.role);
            return { id: user.uid, uid: user.uid, email: user.email!, ...data, rol: effectiveRole } as DNAUser;
        }
    }
    return null;
};

export const createUser = async (userData: any, creatorEmail?: string, adminAuthPassword?: string): Promise<ServiceResponse<void>> => {
    let secondaryApp: any = null;
    try {
        console.log("Creating new user...");

        const mainAuth = await getAuthInstance();
        if (!mainAuth || !mainAuth.currentUser) {
            throw new Error("Admin oturumu kapalı görünüyor.");
        }

        // --- ADMIN RE-AUTHENTICATION (Security Check) ---
        if (adminAuthPassword) {
            try {
                const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
                const credential = EmailAuthProvider.credential(mainAuth.currentUser.email!, adminAuthPassword);
                await reauthenticateWithCredential(mainAuth.currentUser, credential);
                console.log("Admin verified via re-auth.");
            } catch (authErr: any) {
                console.error("Admin re-auth failed:", authErr);
                return { success: false, message: "Yönetici şifresi hatalı. Doğrulama başarısız." };
            }
        }

        // Create secondary app to create user without logging out admin
        const secondaryAppName = "SecondaryApp-" + new Date().getTime();
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.sifre);
        const newUser = userCredential.user;

        await signOut(secondaryAuth);
        console.log("Secondary Auth signed out.");

        // Normalize and log role
        const normalizedRole = normalizeRole(userData.rol);

        const userDocData: DNAUser = {
            id: newUser.uid,
            uid: newUser.uid,
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

        // Check if admin is logged in
        if (!mainAuth || !mainAuth.currentUser) {
            console.error("CRITICAL: Admin user appears to be logged out! Cannot write to DB.");
            throw new Error("Admin oturumu kapalı görünüyor.");
        }

        console.log("Writing to DB as Admin:", mainAuth.currentUser.uid);

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
            // SEC-010: Audit log for user creation
            AuditLog.userCreated(
                mainAuth.currentUser!.uid,
                mainAuth.currentUser!.email!,
                userDocData.id,
                userData.email,
                normalizedRole
            );
            return { success: true };
        }

        // FALLBACK TO REST API
        console.warn("Falling back to REST API for user profile creation...");
        try {
            const token = await mainAuth.currentUser!.getIdToken();
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

export const updateUser = async (userId: string, data: any): Promise<ServiceResponse<void>> => {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, data);
        return { success: true };
    } catch (error: any) {
        console.error("Kullanıcı güncelleme hatası:", error);
        return { success: false, message: error.message };
    }
};

export const getAllUsers = async (): Promise<ServiceResponse<DNAUser[]>> => {
    try {
        // Force server read to ensure list is up to date
        let querySnapshot;
        try {
            querySnapshot = await getDocsFromServer(collection(db, "users"));
        } catch (e) {
            console.warn("Server list read failed, using cache:", e);
            querySnapshot = await getDocs(collection(db, "users"));
        }

        const users = querySnapshot.docs.map((doc: any) => {
            const data = doc.data();
            // @ts-ignore
            const effectiveRole = normalizeRole(data.rol || data.role);
            return {
                id: doc.id,
                uid: doc.id,
                email: data.email || '',
                ad: data.ad || '',
                soyad: data.soyad || '',
                aktif: data.aktif ?? true,
                olusturmaTarihi: data.olusturmaTarihi?.toDate ? data.olusturmaTarihi.toDate() : new Date(),
                ...data,
                rol: effectiveRole
            } as DNAUser;
        });
        return { success: true, data: users };
    } catch (error: any) {
        console.error("Kullanıcıları getirme hatası:", error);
        return { success: false, message: error.message };
    }
};
