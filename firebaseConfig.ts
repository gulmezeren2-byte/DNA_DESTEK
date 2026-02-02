import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, initializeApp } from "firebase/app";
import {
  Auth,
  getAuth,
  // @ts-ignore
  getReactNativePersistence,
  initializeAuth
} from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore
} from "firebase/firestore";
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "missing-api-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (firebaseConfig.apiKey === "missing-api-key") {
  console.error("❌ CRITICAL: Firebase API Key is MISSING! App will likely crash or fail to connect.");
  console.error("Make sure EXPO_PUBLIC_FIREBASE_API_KEY is defined.");
}

// 1. Initialize App
let app: FirebaseApp;
try {
  app = getApp();
} catch {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("❌ Firebase Init Failed:", e);
    // Dummy app to prevent immediate crash, though subsequent calls will likely fail
    app = { name: '[DEFAULT]', options: firebaseConfig } as FirebaseApp;
  }
}

// 2. Initialize Auth
let auth: Auth;
// Helper to avoid duplicate logic
const initializeNativeAuth = () => {
  try {
    if (typeof getReactNativePersistence === 'function') {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
      });
    } else {
      console.warn("⚠️ getReactNativePersistence is not a function.");
      return getAuth(app);
    }
  } catch (e: any) {
    if (e.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw e;
  }
}

if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // NATIVE
  try {
    console.log("🔥 Initializing Auth with Native Persistence...");
    auth = initializeNativeAuth();
    console.log("✅ Auth initialized successfully.");
  } catch (e: any) {
    console.error("❌ Native Auth Init Failed:", e);
    // Fallback to memory auth (standard getAuth)
    try {
      auth = getAuth(app);
    } catch {
      // Last resort
      auth = {} as Auth;
    }
  }
}

// 3. Initialize Firestore
let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (e) {
  try {
    db = getFirestore(app);
  } catch {
    console.error("❌ Firestore Init Failed");
    db = {} as Firestore;
  }
}

export { auth, db };

