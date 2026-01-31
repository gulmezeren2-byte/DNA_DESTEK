import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
// @ts-ignore
import * as FirebaseAuth from "firebase/auth";
import {
  browserLocalPersistence,
  initializeAuth
} from "firebase/auth";
import {
  Firestore,
  enableIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
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

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth kurulumu
let auth: FirebaseAuth.Auth;

if (Platform.OS === 'web') {
  try {
    auth = extractAuth(app);
  } catch {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence
    });
  }
} else {
  try {
    auth = extractAuth(app);
  } catch {
    auth = initializeAuth(app, {
      persistence: (FirebaseAuth as any).getReactNativePersistence(ReactNativeAsyncStorage)
    });
  }
}

// Firestore kurulumu
// Web'de WebSockets yerine Long Polling kullan (Firewall/Proxy sorunlarını çözer)
let db: Firestore;

try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (e) {
  // Zaten başlatılmışsa mevcut instance'ı al
  db = getFirestore(app);
}

if (Platform.OS === 'web') {
  // Persistence sadece web için manuel başlatılır (React Native için initializeAuth içinde hallediliyor olabilir veya varsayılan)
  // Not: initializeFirestore zaten cache ayarlarını alabilir ama eski yöntem enableIndexedDbPersistence kullanıyorduk.
  // Hata almamak için tekrar enableIndexedDbPersistence deneyelim.
  try {
    enableIndexedDbPersistence(db).then(() => {
      console.log("Persistence enabled successfully");
    }).catch((err: any) => {
      if (err.code == 'failed-precondition') {
        console.warn("Persistence failed: Multiple tabs open.");
      } else if (err.code == 'unimplemented') {
        console.warn("Persistence failed: Browser not supported.");
      }
    });
  } catch (err) {
    // Zaten aktif olabilir
  }
}

function extractAuth(app: FirebaseApp): FirebaseAuth.Auth {
  return (FirebaseAuth as any).getAuth(app);
}

const storage = getStorage(app);

export { auth, db, storage };

