import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, setLogLevel, type FirebaseOptions } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Expo'da .env üzerinden okunacak config
// Bu değerleri app.config.(js|ts) veya .env içinde EXPO_PUBLIC_* olarak tanımlaman gerekiyor.
// Örn: EXPO_PUBLIC_FIREBASE_API_KEY=... vb.

export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAUWN0T_QM8SE9JaWaH1POKFVEqYo_KEus',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'setlist-87cd0.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'setlist-87cd0',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'setlist-87cd0.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '126366775722',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:126366775722:web:0b72bbd773ce6d06dc93d3',
};

declare global {
  // eslint-disable-next-line no-var
  var __setlistFirebaseApp: ReturnType<typeof initializeApp> | undefined;
  // eslint-disable-next-line no-var
  var __setlistFirebaseAuth: ReturnType<typeof initializeAuth> | undefined;
}

const app = globalThis.__setlistFirebaseApp ?? initializeApp(firebaseConfig);
globalThis.__setlistFirebaseApp = app;

setLogLevel('error');

const DEBUG_LOGS = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGS === '1';

if (DEBUG_LOGS) {
  // eslint-disable-next-line no-console
  console.log('[firebase]', {
    projectId: app.options.projectId,
    appId: app.options.appId,
    authDomain: app.options.authDomain,
  });
}

export const auth = (() => {
  if (globalThis.__setlistFirebaseAuth) return globalThis.__setlistFirebaseAuth;

  // Web: normal auth
  if (Platform.OS === 'web') {
    globalThis.__setlistFirebaseAuth = getAuth(app);
    return globalThis.__setlistFirebaseAuth;
  }

  try {
    globalThis.__setlistFirebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    return globalThis.__setlistFirebaseAuth;
  } catch {
    globalThis.__setlistFirebaseAuth = getAuth(app);
    return globalThis.__setlistFirebaseAuth;
  }
})();
export const db = getFirestore(app);
export const storage = getStorage(app);
