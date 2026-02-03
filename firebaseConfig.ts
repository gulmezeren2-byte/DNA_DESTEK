import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App (handle hot reload)
let app: any;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase App initialized");
  } else {
    app = getApp();
    console.log("✅ Firebase App already exists, reusing");
  }
} catch (e) {
  console.error("❌ Firebase App Init Failed:", e);
  app = {} as any;
}

// Initialize Firestore
let db: any;
try {
  db = getFirestore(app);
  console.log("✅ Firestore initialized");
} catch (e) {
  console.error("❌ Firestore Init Failed:", e);
  db = {};
}

// AUTH IS INITIALIZED LAZILY to avoid "Component auth has not been registered yet" error
// The auth module will be loaded on-demand when getAuthInstance() is first called
let authInstance: any = null;
let authInitPromise: Promise<any> | null = null;

export const getAuthInstance = async () => {
  if (authInstance) return authInstance;

  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = (async () => {
    try {
      // Dynamic import to ensure auth module is fully loaded
      const { getAuth } = await import("firebase/auth");
      authInstance = getAuth(app);
      console.log("✅ Auth initialized (lazy)");
      return authInstance;
    } catch (e) {
      console.error("❌ Auth Init Failed:", e);
      return null;
    }
  })();

  return authInitPromise;
};

// Also provide synchronous access for cases where auth might already be initialized
export const getAuthSync = () => authInstance;

export { app, db, firebaseConfig };

