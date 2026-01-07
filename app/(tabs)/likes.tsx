import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../firebase/config';
import { sendLike } from '../../services/swipeService';
import { useAuth } from '../AuthContext';
import { useNotifications } from '../NotificationsContext';
import { ScreenContainer } from '../ScreenContainer';

const DEBUG_LOGS = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGS === '1';

type MockLiker = {
  uid: string;
  name: string;
  city: string;
  country: string;
  photos: string[];
  genres: string[];
  verified?: boolean;
};

type LikeDoc = {
  from?: string;
  to?: string;
  type?: string;
  createdAt?: any;
  toProfile?: {
    name?: string;
    city?: string;
    country?: string;
    photos?: string[];
    genres?: string[];
    verified?: boolean;
  } | null;
};

export default function LikesScreen() {
  const router = useRouter();
  const [likedMe, setLikedMe] = useState<MockLiker[]>([]);
  const [myLikes, setMyLikes] = useState<MockLiker[]>([]);
  const [mode, setMode] = useState<'likedMe' | 'myLikes'>('likedMe');
  const [showPremium, setShowPremium] = useState(false);
  const [selected, setSelected] = useState<MockLiker | null>(null);
  const [selectedMode, setSelectedMode] = useState<'likedMe' | 'myLikes'>('likedMe');
  const [sendingAction, setSendingAction] = useState(false);
  const { setUnreadLikes } = useNotifications();
  const { firebaseUser, profile } = useAuth();
  const isPremium = profile?.premium === true;

  useEffect(() => {
    if (!firebaseUser) {
      setLikedMe([]);
      setMyLikes([]);
      setUnreadLikes(0);
      return;
    }

    const likesRef = collection(db, 'likes');

    const qIncoming = query(likesRef, where('to', '==', firebaseUser.uid), orderBy('createdAt', 'desc'));
    const qOutgoing = query(likesRef, where('from', '==', firebaseUser.uid), orderBy('createdAt', 'desc'));

    const unsubIncoming = onSnapshot(
      qIncoming,
      (snap) => {
        const items: MockLiker[] = [];
        snap.forEach((d) => {
          const data = d.data() as LikeDoc;
          const p = (data as any).fromProfile ?? null;
          const fromUid = String(data.from ?? '');
          if (!fromUid) return;
          items.push({
            uid: fromUid,
            name: String(p?.name ?? fromUid),
            city: String(p?.city ?? ''),
            country: String(p?.country ?? ''),
            photos: Array.isArray(p?.photos) ? p!.photos! : [],
            genres: Array.isArray(p?.genres) ? p!.genres! : [],
            verified: !!p?.verified,
          });
        });
        setLikedMe(items);
        setUnreadLikes(items.length);
      },
      () => {
        setLikedMe([]);
        setUnreadLikes(0);
      },
    );

    const unsubOutgoing = onSnapshot(
      qOutgoing,
      (snap) => {
        const items: MockLiker[] = [];
        snap.forEach((d) => {
          const data = d.data() as LikeDoc;
          const p = data.toProfile ?? null;
          const toUid = String(data.to ?? '');
          if (!toUid) return;
          items.push({
            uid: toUid,
            name: String(p?.name ?? toUid),
            city: String(p?.city ?? ''),
            country: String(p?.country ?? ''),
            photos: Array.isArray(p?.photos) ? p!.photos! : [],
            genres: Array.isArray(p?.genres) ? p!.genres! : [],
            verified: !!p?.verified,
          });
        });
        setMyLikes(items);
      },
      () => {
        setMyLikes([]);
      },
    );

    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  }, [firebaseUser, setUnreadLikes]);

  useFocusEffect(
    React.useCallback(() => {
      // Likes sekmesine girildiğinde unreadLikes'i sıfırla
      setUnreadLikes(0);
      return () => {};
    }, [setUnreadLikes]),
  );


  return (
    <ScreenContainer>
      <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{mode === 'likedMe' ? 'Seni kim beğendi?' : 'Sen kimi beğendin?'}</Text>
        <Text style={styles.headerCount}>
          {mode === 'likedMe' ? likedMe.length : myLikes.length} kişi
        </Text>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'likedMe' && styles.modeBtnActive]}
          onPress={() => setMode('likedMe')}
        >
          <Text style={[styles.modeText, mode === 'likedMe' && styles.modeTextActive]}>Seni beğenenler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'myLikes' && styles.modeBtnActive]}
          onPress={() => setMode('myLikes')}
        >
          <Text style={[styles.modeText, mode === 'myLikes' && styles.modeTextActive]}>Senin beğendiklerin</Text>
        </TouchableOpacity>
      </View>

      {(() => {
        const data = mode === 'likedMe' ? likedMe : myLikes;
        if (data.length === 0) {
          return (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {mode === 'likedMe'
                  ? 'Şu an seni beğenen kimse yok. Swipe' + "'" + 'lamaya devam et.'
                  : 'Henüz kimseyi beğenmedin. Swipe ile like at.'}
              </Text>
            </View>
          );
        }

        const isIncoming = mode === 'likedMe';
        const shouldBlur = isIncoming && !isPremium;
        return (
          <FlatList
            data={data}
            keyExtractor={(item) => item.uid}
            numColumns={3}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  if (isIncoming && !isPremium) {
                    setShowPremium(true);
                    return;
                  }
                  setSelected(item);
                  setSelectedMode(mode);
                }}
                activeOpacity={0.8}
              >
                {item.photos[0] && (
                  <Image
                    source={{ uri: item.photos[0] }}
                    style={styles.cardPhoto}
                    blurRadius={shouldBlur ? 18 : 0}
                  />
                )}
                {shouldBlur && <View style={styles.cardDimOverlay} />}
              </TouchableOpacity>
            )}
          />
        );
      })()}

      {/* Premium paywall modalı (şu an tüm kullanıcılar için) */}
      <Modal visible={showPremium} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Premium ile aç</Text>
              <Pressable onPress={() => setShowPremium(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.modalInfoBox}>
              <Text style={styles.modalName}>Seni beğenenleri gör</Text>
              <Text style={styles.modalSub}>
                Blur’lu profillerin arkasında seni beğenen gerçek ravers’lar var.
                Premium’a geçerek hepsini net görebilir ve anında karşılık
                verebilirsin.
              </Text>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalSkipBtn}
                onPress={() => setShowPremium(false)}
              >
                <Text style={styles.modalSkipText}>Sonra</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalLikeBtn}
                onPress={() => {
                  if (DEBUG_LOGS) console.log('Premium upgrade flow stub (likes)');
                  setShowPremium(false);
                }}
              >
                <Text style={styles.modalLikeText}>Premium'a geç</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selected?.name ?? ''}</Text>
              <Pressable
                onPress={() => {
                  if (sendingAction) return;
                  setSelected(null);
                }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            {!!selected?.photos?.[0] && (
              <Image source={{ uri: selected.photos[0] }} style={styles.detailPhoto} />
            )}

            <Text style={styles.detailSub}>
              {selected?.city || selected?.country ? `${selected?.city ?? ''}${selected?.city && selected?.country ? ', ' : ''}${selected?.country ?? ''}` : ''}
            </Text>

            {!!selected?.genres?.length && (
              <View style={styles.detailGenresRow}>
                {selected.genres.slice(0, 6).map((g) => (
                  <View key={g} style={styles.detailGenrePill}>
                    <Text style={styles.detailGenreText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {selectedMode === 'likedMe' && isPremium && (
              <View style={styles.detailActionsRow}>
                <TouchableOpacity
                  style={[styles.detailActionBtn, styles.detailDislikeBtn]}
                  disabled={sendingAction}
                  onPress={() => {
                    const sel = selected;
                    if (!sel) return;
                    setLikedMe((prev) => prev.filter((x) => x.uid !== sel.uid));
                    setSelected(null);
                  }}
                >
                  <Text style={styles.detailActionText}>✖</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.detailActionBtn, styles.detailLikeBtn]}
                  disabled={sendingAction || !firebaseUser}
                  onPress={async () => {
                    if (!firebaseUser) return;
                    const sel = selected;
                    if (!sel) return;
                    setSendingAction(true);
                    try {
                      const matched = await sendLike(firebaseUser.uid, sel.uid, 'like', {
                        name: sel.name,
                        city: sel.city,
                        country: sel.country,
                        photos: sel.photos,
                        genres: sel.genres,
                        verified: sel.verified,
                      });
                      setSelected(null);
                      if (matched) {
                        router.push('/(tabs)/messages');
                      }
                    } finally {
                      setSendingAction(false);
                    }
                  }}
                >
                  <Text style={styles.detailActionText}>❤</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: 'rgba(34,211,238,0.8)',
    backgroundColor: 'rgba(34,211,238,0.08)',
  },
  modeText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#22d3ee',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    color: '#22d3ee',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerCount: {
    color: '#9ca3af',
    fontSize: 11,
  },
  emptyBox: {
    marginTop: 16,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  gridContent: {
    paddingBottom: 16,
  },
  gridRow: {
    gap: 8,
  },
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.6)',
  },
  cardPhoto: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  } as any,
  cardDimOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  detailCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#090016',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.4)',
    padding: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '700',
  },
  detailPhoto: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  detailSub: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
  },
  detailGenresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  detailGenrePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.8)',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  detailGenreText: {
    color: '#22d3ee',
    fontSize: 11,
    fontWeight: '600',
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  detailDislikeBtn: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.8)',
  },
  detailLikeBtn: {
    backgroundColor: '#ec4899',
  },
  detailActionText: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '700',
  },
  cardInfo: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
  },
  cardName: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '600',
  },
  cardSub: {
    color: '#9ca3af',
    fontSize: 9,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#090016',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.4)',
    padding: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    color: '#22d3ee',
    fontSize: 14,
    fontWeight: '600',
  },
  modalClose: {
    color: '#9ca3af',
    fontSize: 16,
  },
  modalPhotoBox: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.6)',
    aspectRatio: 3 / 4,
    marginBottom: 8,
  },
  modalPhoto: {
    width: '100%',
    height: '100%',
  },
  modalLeftTap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  modalRightTap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  modalDotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  modalDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  modalDotActive: {
    backgroundColor: '#ffffff',
  },
  modalPhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(88,28,135,0.6)',
  },
  modalPhotoPlaceholderText: {
    color: '#e5e7eb',
    fontSize: 36,
    fontWeight: '700',
  },
  modalInfoBox: {
    marginBottom: 8,
  },
  modalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  modalName: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.8)',
  },
  modalBadgeText: {
    color: '#e0f2fe',
    fontSize: 10,
  },
  modalSub: {
    color: '#9ca3af',
    fontSize: 11,
  },
  modalGenresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  modalGenrePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.8)',
  },
  modalGenreText: {
    color: '#22d3ee',
    fontSize: 10,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalSkipBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.8)',
    alignItems: 'center',
  },
  modalSkipText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  modalLikeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ec4899',
    alignItems: 'center',
  },
  modalLikeText: {
    color: '#020617',
    fontSize: 12,
    fontWeight: '600',
  },
});
