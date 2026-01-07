import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { UserProfile } from '../app/AuthContext';
import { db } from '../firebase/config';

const DEBUG_LOGS = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGS === '1';

// Şimdilik web ile aynı mock mantığını kopyalamıyoruz, doğrudan gerçek Firestore yolunu kullanıyoruz.
// İstersen daha sonra useMock bayrağı ekleyip offline test yapabiliriz.

export type LikeType = 'like' | 'superlike';

export type LikeProfileSnapshot = {
  name?: string;
  city?: string;
  country?: string;
  photos?: string[];
  genres?: string[];
  verified?: boolean;
};

const getWeekKey = (d: Date) => {
  // UTC week key, Monday-based (ISO-ish) to avoid timezone quirks
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // 1..7 (Mon..Sun)
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
};

export const fetchSwipeCandidates = async (currentUser: UserProfile): Promise<UserProfile[]> => {
  const usersRef = collection(db, 'users');
  const constraints: any[] = [];

  // Keep constraints minimal to avoid empty results when optional fields don't exist.
  // Apply optional filters only when the current user has that field.
  if (currentUser.country) {
    constraints.push(where('country', '==', currentUser.country));
  }

  if (currentUser.premium) {
    if (currentUser.city) {
      constraints.push(where('city', '==', currentUser.city));
    }
    if (typeof currentUser.age === 'number') {
      const minAge = currentUser.age - 3;
      const maxAge = currentUser.age + 3;
      constraints.push(where('age', '>=', minAge));
      constraints.push(where('age', '<=', maxAge));
    }
  }

  let snap;
  try {
    const q = query(usersRef, ...constraints, limit(50));
    snap = await getDocs(q);
  } catch {
    // If composite indexes/filters fail, fall back to a broad query.
    snap = await getDocs(query(usersRef, limit(50)));
  }
  const candidates: UserProfile[] = [];

  snap.forEach((d) => {
    const data = d.data() as UserProfile;
    if (data.uid !== currentUser.uid) {
      candidates.push(data);
    }
  });

  // Prefer boosted profiles first if the field exists.
  candidates.sort((a: any, b: any) => {
    const aBoost = Number(a?.boostUntil ?? 0);
    const bBoost = Number(b?.boostUntil ?? 0);
    return bBoost - aBoost;
  });

  return candidates;
};

export const sendLike = async (
  fromUid: string,
  toUid: string,
  type: LikeType,
  toProfile?: LikeProfileSnapshot,
): Promise<boolean> => {
  const userRef = doc(db, 'users', fromUid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('USER_NOT_FOUND');
  }

  const user = userSnap.data() as UserProfile & {
    dailySwipeCount?: number;
    lastSwipeDate?: string;
    maxDailySwipes?: number;
    premium?: boolean;
    weeklySuperlikeCount?: number;
    weeklySuperlikeWeekKey?: string;
  };
  const today = new Date().toISOString().slice(0, 10);

  let dailySwipeCount = user.dailySwipeCount ?? 0;
  let lastSwipeDate = user.lastSwipeDate ?? today;
  const maxDailySwipes = user.maxDailySwipes ?? 15;
  const premium = user.premium ?? false;

  // Superlike: premium-only + weekly limit
  if (type === 'superlike') {
    if (!premium) {
      throw new Error('SUPERLIKE_PREMIUM_ONLY');
    }
    const weekKey = getWeekKey(new Date());
    const prevWeekKey = user.weeklySuperlikeWeekKey;
    const prevCount = user.weeklySuperlikeCount ?? 0;
    const count = prevWeekKey === weekKey ? prevCount : 0;

    if (count >= 5) {
      throw new Error('SUPERLIKE_LIMIT_REACHED');
    }

    await updateDoc(userRef, {
      weeklySuperlikeWeekKey: weekKey,
      weeklySuperlikeCount: count + 1,
    });
  }

  if (lastSwipeDate !== today) {
    dailySwipeCount = 0;
    lastSwipeDate = today;
  }

  if (!premium && dailySwipeCount >= maxDailySwipes) {
    throw new Error('SWIPE_LIMIT_REACHED');
  }

  await updateDoc(userRef, {
    dailySwipeCount: dailySwipeCount + 1,
    lastSwipeDate,
  });

  const likeId = `${fromUid}_${toUid}`;
  const likeRef = doc(db, 'likes', likeId);

  const fromProfile: LikeProfileSnapshot = {
    name: user.name,
    city: user.city,
    country: user.country,
    photos: Array.isArray(user.photos) ? user.photos : [],
    genres: Array.isArray(user.genres) ? user.genres : [],
    verified: !!(user as any).verified,
  };

  // Like dokümanı daha önce oluşmuş olabilir; merge ile idempotent yaz.
  // (Rules tarafında update izni yoksa permission-denied olur; rules'u da buna göre güncelleyeceğiz.)
  await setDoc(
    likeRef,
    {
      from: fromUid,
      to: toUid,
      type,
      fromProfile,
      toProfile: toProfile ?? null,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  // Mutual-like => create match immediately.
  // If user B likes user A and A already liked B, we create matches/{sortedUidA_sortedUidB}.
  const reverseLikeId = `${toUid}_${fromUid}`;
  const reverseLikeRef = doc(db, 'likes', reverseLikeId);
  const reverseSnap = await getDoc(reverseLikeRef);
  if (reverseSnap.exists()) {
    const matchId = [fromUid, toUid].sort().join('_');
    const matchRef = doc(db, 'matches', matchId);

    let otherName = toProfile?.name ?? toUid;
    try {
      const otherSnap = await getDoc(doc(db, 'users', toUid));
      if (otherSnap.exists()) {
        const otherUser = otherSnap.data() as Partial<UserProfile>;
        if (otherUser?.name) otherName = String(otherUser.name);
      }
    } catch {
      // ignore
    }

    const batch = writeBatch(db);
    batch.set(
      matchRef,
      {
        userA: fromUid,
        userB: toUid,
        users: [fromUid, toUid],
        userIds: [fromUid, toUid],
        userNames: {
          [fromUid]: String(fromProfile?.name ?? 'You'),
          [toUid]: String(otherName),
        },
        createdAt: serverTimestamp(),
        lastMessageAt: Date.now(),
        lastMessageFrom: fromUid,
      },
      { merge: true },
    );
    await batch.commit();
    return true;
  }

  // Match dokümanı ilk mesaj gönderilince oluşturuluyor (Swipe overlay akışı).
  return false;
};

export const listenMatches = (uid: string, cb: (matchUserIds: string[]) => void) => {
  const matchesRef = collection(db, 'matches');
  const q = query(matchesRef, where('users', 'array-contains', uid));
  let warned = false;
  return onSnapshot(
    q,
    (snap) => {
      const ids: string[] = [];
      snap.forEach((d) => {
        const data = d.data() as { users: string[] };
        if (Array.isArray(data.users)) {
          const otherId = data.users.find((u) => u !== uid);
          if (otherId) ids.push(otherId);
        }
      });
      cb(ids);
    },
    (err) => {
      if (DEBUG_LOGS && !warned) {
        warned = true;
        console.warn('listenMatches failed', {
          code: (err as any)?.code,
          message: (err as any)?.message,
          uid,
        });
      }
    },
  );
};

export const fetchUsersByIds = async (ids: string[]): Promise<UserProfile[]> => {
  if (!ids.length) return [];

  const users: UserProfile[] = [];

  await Promise.all(
    ids.map(async (id) => {
      const ref = doc(db, 'users', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        users.push(snap.data() as UserProfile);
      }
    }),
  );

  return users;
};

export const fetchWhoLikedYou = async (uid: string): Promise<UserProfile[]> => {
  const likesRef = collection(db, 'likes');
  const q = query(likesRef, where('to', '==', uid));
  const snap = await getDocs(q);

  const likerIds = new Set<string>();
  snap.forEach((d) => {
    const data = d.data() as { from?: string };
    if (data.from) likerIds.add(data.from);
  });

  return fetchUsersByIds(Array.from(likerIds));
};
