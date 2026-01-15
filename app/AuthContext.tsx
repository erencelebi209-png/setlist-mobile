import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const DEBUG_LOGS = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGS === '1';

// Web tarafındaki UserProfile’ın sadeleştirilmiş mobil kopyası
// Web tarafındaki UserProfile'ın sadeleştirilmiş mobil kopyası
export interface UserProfile {
  uid: string;
  name: string;
  age: number;
  gender: string;
  country: string;
  city: string;
  photos: string[];
  genres: string[];
  bpmPreference: string;
  afterParty: boolean;
  premium: boolean;
  weeklySuperlikeCount?: number;
  weeklySuperlikeWeekKey?: string;
  bio?: string;
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  preferredGender?: 'female' | 'male' | 'both';
  dailySwipeCount: number;
  lastSwipeDate: string;
  maxDailySwipes: number;
  verified?: boolean;
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  verificationUpdatedAt?: number;
}

interface AuthContextValue {
  firebaseUser: FirebaseAuthTypes.User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = async (email: string, password: string) => {
    await auth().signInWithEmailAndPassword(email.trim(), password);
  };

  const signUp = async (email: string, password: string) => {
    await auth().createUserWithEmailAndPassword(email.trim(), password);
  };

  const signOut = async () => {
    await auth().signOut();
  };

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(async (user: FirebaseAuthTypes.User | null) => {
      try {
        if (DEBUG_LOGS) {
          // eslint-disable-next-line no-console
          console.log('[auth] onAuthStateChanged', {
            uid: user?.uid ?? null,
            isAnonymous: (user as any)?.isAnonymous ?? null,
          });
        }

        if (!user) {
          setFirebaseUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Firestore istekleri başlamadan önce token'ın hazır olduğundan emin ol.
        // Bazı cihazlarda auth state geliyor ama token henüz hazır değilken yapılan ilk istekler
        // permission-denied (request.auth == null) ile dönebiliyor.
        await user.getIdToken();

        // Token hazır olmadan firebaseUser set etmiyoruz; böylece ekranlardaki listener'lar
        // auth hazır olmadan çalışmaya başlamaz.
        setFirebaseUser(user);

        if (DEBUG_LOGS) {
          // eslint-disable-next-line no-console
          console.log('[auth] active user', {
            uid: user.uid,
            isAnonymous: (user as any)?.isAnonymous ?? null,
          });
        }

        const ref = firestore().collection('users').doc(user.uid);
        const snap = await ref.get();
        if (snap.exists) {
          const data = snap.data() as UserProfile;

          // Mobil uygulamada premium alanlarını normalize ediyoruz.
          // (Premium test edilebilsin diye premium'u artık zorla kapatmıyoruz.)
          if (data.premium === true) {
            const desiredMax = 9999;
            if (data.maxDailySwipes !== desiredMax) {
              await ref.set(
                {
                  maxDailySwipes: desiredMax,
                },
                { merge: true },
              );
              data.maxDailySwipes = desiredMax;
            }
          }

          setProfile(data);
        } else {
          // Eğer profil yoksa basit bir mock profil oluştur
          const today = new Date().toISOString().slice(0, 10);
          const now = new Date();
          const weekKey = `${now.getUTCFullYear()}-W00`;
          const initialProfile: UserProfile = {
            uid: user.uid,
            name: 'Mobile Raver',
            age: 25,
            gender: 'N/A',
            country: 'TR',
            city: 'Istanbul',
            photos: [],
            genres: [],
            bpmPreference: '130-140',
            afterParty: false,
            premium: false,
            weeklySuperlikeCount: 0,
            weeklySuperlikeWeekKey: weekKey,
            dailySwipeCount: 0,
            lastSwipeDate: today,
            maxDailySwipes: 20,
            verified: false,
            verificationStatus: 'none',
            verificationUpdatedAt: Date.now(),
          };
          await ref.set(initialProfile, { merge: true });
          setProfile(initialProfile);
        }
      } catch (e) {
        if (DEBUG_LOGS) {
          console.warn('Failed to init auth/profile', e);
        }
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default function AuthContextRoute() {
  return null;
}
