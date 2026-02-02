import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, initializeApp } from "firebase/app";
// @ts-ignore
import * as FirebaseAuth from "firebase/auth";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth
} from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
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

let app: FirebaseApp;
try {
  app = getApp();
} catch {
  app = initializeApp(firebaseConfig);
}

// Auth kurulumu
let auth: FirebaseAuth.Auth;

if (Platform.OS === 'web') {
  try {
    auth = getAuth(app);
  } catch {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  }
} else {
  try {
    console.log("🔥 Initializing Auth with Native Persistence...");
    auth = initializeAuth(app, {
      persistence: (FirebaseAuth as any).getReactNativePersistence(ReactNativeAsyncStorage)
    });
    console.log("✅ Auth initialized successfully.");
  } catch (e: any) {
    if (e.code === 'auth/already-initialized') {
      console.warn("⚠️ Auth already initialized, retrieving instance...");
      auth = getAuth(app);
    } else {
      console.error("❌ Native Auth Init Failed:", e);
      console.warn("⚠️ Falling back to memory-only auth (no persistence)...");
      try {
        auth = getAuth(app);
      } catch (fallbackError) {
        console.error("❌ CRITICAL: Fallback Auth Init also failed!", fallbackError);
        // Prevent crash by assigning a dummy object if absolutely necessary, 
        // but normally getAuth should work if app is valid.
        throw fallbackError;
      }
    }
  }
}

// Firestore kurulumu
// Web'de WebSockets yerine Long Polling kullan (Firewall/Proxy sorunlarını çözer)
let db: Firestore;

try {
  // force long polling for stability
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
  console.log("Firestore initialized with Long Polling");
} catch (e) {
  // Zaten başlatılmışsa mevcut instance'ı al
  console.warn("Firestore already initialized, retrieving instance:", e);
  db = getFirestore(app);
}

// PERSISTENCE ENABLED
if (Platform.OS === 'web') {
  try {
    const { enableIndexedDbPersistence } = require("firebase/firestore");
    enableIndexedDbPersistence(db).catch((err: any) => {
      console.warn("Persistence failed:", err.code);
    });
  } catch (err) {
    // Zaten aktif olabilir veya import hatası
    console.warn("Persistence setup error:", err);
  }
}

function extractAuth(app: FirebaseApp): FirebaseAuth.Auth {
  return (FirebaseAuth as any).getAuth(app);
}

const storage = getStorage(app);

export { auth, db, storage };

