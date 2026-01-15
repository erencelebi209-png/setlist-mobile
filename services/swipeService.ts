import firestore, { type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { UserProfile } from '../app/AuthContext';

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
  let q: FirebaseFirestoreTypes.Query<FirebaseFirestoreTypes.DocumentData> = firestore().collection('users');

  if (currentUser.country) {
    q = q.where('country', '==', currentUser.country);
  }

  if (currentUser.premium) {
    if (currentUser.city) {
      q = q.where('city', '==', currentUser.city);
    }
    if (typeof currentUser.age === 'number') {
      const minAge = currentUser.age - 3;
      const maxAge = currentUser.age + 3;
      q = q.where('age', '>=', minAge).where('age', '<=', maxAge);
    }
  }

  let snap: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>;
  try {
    snap = await q.limit(50).get();
  } catch {
    snap = await firestore().collection('users').limit(50).get();
  }

  const candidates: UserProfile[] = snap.docs
    .map((d) => d.data() as UserProfile)
    .filter((u) => u.uid !== currentUser.uid);

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
  const userRef = firestore().collection('users').doc(fromUid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
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

    await userRef.set(
      {
      weeklySuperlikeWeekKey: weekKey,
      weeklySuperlikeCount: count + 1,
      },
      { merge: true },
    );
  }

  if (lastSwipeDate !== today) {
    dailySwipeCount = 0;
    lastSwipeDate = today;
  }

  if (!premium && dailySwipeCount >= maxDailySwipes) {
    throw new Error('SWIPE_LIMIT_REACHED');
  }

  await userRef.set(
    {
    dailySwipeCount: dailySwipeCount + 1,
    lastSwipeDate,
    },
    { merge: true },
  );

  const likeId = `${fromUid}_${toUid}`;
  const likeRef = firestore().collection('likes').doc(likeId);

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
  await likeRef.set(
    {
      from: fromUid,
      to: toUid,
      type,
      fromProfile,
      toProfile: toProfile ?? null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Mutual-like => create match immediately.
  // If user B likes user A and A already liked B, we create matches/{sortedUidA_sortedUidB}.
  const reverseLikeId = `${toUid}_${fromUid}`;
  const reverseLikeRef = firestore().collection('likes').doc(reverseLikeId);
  const reverseSnap = await reverseLikeRef.get();
  if (reverseSnap.exists) {
    const matchId = [fromUid, toUid].sort().join('_');
    const matchRef = firestore().collection('matches').doc(matchId);

    let otherName = toProfile?.name ?? toUid;
    try {
      const otherSnap = await firestore().collection('users').doc(toUid).get();
      if (otherSnap.exists) {
        const otherUser = otherSnap.data() as Partial<UserProfile>;
        if (otherUser?.name) otherName = String(otherUser.name);
      }
    } catch {
      // ignore
    }

    await matchRef.set(
      {
        userA: fromUid,
        userB: toUid,
        users: [fromUid, toUid],
        userIds: [fromUid, toUid],
        userNames: {
          [fromUid]: String(fromProfile?.name ?? 'You'),
          [toUid]: String(otherName),
        },
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastMessageAt: Date.now(),
        lastMessageFrom: fromUid,
      },
      { merge: true },
    );
    return true;
  }

  // Match dokümanı ilk mesaj gönderilince oluşturuluyor (Swipe overlay akışı).
  return false;
};

export const listenMatches = (uid: string, cb: (matchUserIds: string[]) => void) => {
  let warned = false;
  return firestore()
    .collection('matches')
    .where('users', 'array-contains', uid)
    .onSnapshot(
      (snap) => {
        const ids: string[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as { users?: string[] };
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
      const snap = await firestore().collection('users').doc(id).get();
      if (snap.exists) {
        users.push(snap.data() as UserProfile);
      }
    }),
  );

  return users;
};

export const fetchWhoLikedYou = async (uid: string): Promise<UserProfile[]> => {
  const snap = await firestore().collection('likes').where('to', '==', uid).get();

  const likerIds = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data() as { from?: string };
    if (data.from) likerIds.add(data.from);
  });

  return fetchUsersByIds(Array.from(likerIds));
};
