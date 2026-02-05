import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from 'react-native';

// SEC-001 & APK Fix: Platform-aware configuration
// Android values are taken from the local google-services.json
const firebaseConfig: any = Platform.select({
  android: {
    apiKey: "AIzaSyD7JkFY98yQRzSrQGeUSoKDXNJptT1_SGA",
    authDomain: "dna-destek-8d312.firebaseapp.com",
    projectId: "dna-destek-8d312",
    storageBucket: "dna-destek-8d312.firebasestorage.app",
    messagingSenderId: "1076418517678",
    appId: "1:1076418517678:android:cb153aa35de1ce7dbeab3f",
  },
  default: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  }
});

// Initialize Firebase App
let app: any;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig!);
    console.log("✅ Firebase App initialized");
  } else {
    app = getApp();
  }
} catch (e) {
  console.error("❌ Firebase App Init Failed:", e);
}

// Initialize Firestore
let db: any;
try {
  if (app) {
    db = getFirestore(app);
    console.log("✅ Firestore initialized");
  }
} catch (e) {
  console.error("❌ Firestore Init Failed:", e);
}

// Initialize Auth
let auth: any;
try {
  if (app) {
    auth = getAuth(app);
    console.log("✅ Auth initialized");
  }
} catch (e) {
  console.error("❌ Auth Init Failed:", e);
}

// SEC-004: Initialize Firebase App Check
// Modified: Only running on WEB for now to prevent native crashes (settings of undefined)
let resolveAppCheck: (value: boolean) => void;
export const isAppCheckReady = new Promise<boolean>((resolve) => {
  resolveAppCheck = resolve;
});

const initializeAppCheck = async () => {
  if (Platform.OS !== 'web' || !app) {
    resolveAppCheck(true);
    return;
  }

  try {
    const { initializeAppCheck: initAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
    const RECAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;

    if (RECAPTCHA_SITE_KEY) {
      initAppCheck(app, {
        provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
      console.log("✅ App Check initialized (Web)");
      resolveAppCheck(true);
    } else {
      console.warn("⚠️ App Check: RECAPTCHA_SITE_KEY missing");
      resolveAppCheck(true);
    }
  } catch (e) {
    console.warn("⚠️ App Check init failed:", e);
    resolveAppCheck(true);
  }
};

// Initialize App Check (async)
initializeAppCheck();

// Helper getter
export const getAuthInstance = async () => {
  if (!auth && app) {
    try {
      auth = getAuth(app);
    } catch (e) { }
  }
  return auth;
};

export { app, auth, db, firebaseConfig };

