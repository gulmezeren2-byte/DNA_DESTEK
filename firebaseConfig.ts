import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App
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

// Initialize Auth
let auth: any;
try {
  auth = getAuth(app);
  console.log("✅ Auth initialized");
} catch (e) {
  console.error("❌ Auth Init Failed:", e);
  auth = {} as any;
}

// Helper getter
export const getAuthInstance = async () => auth;
export const getAuthSync = () => auth;

export { app, auth, db, firebaseConfig };

