import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { db } from '../../firebase/config';
import { fetchSwipeCandidates, sendLike, type LikeType } from '../../services/swipeService';
import { useAuth } from '../AuthContext';
import { ScreenContainer } from '../ScreenContainer';

const DEBUG_LOGS = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGS === '1';

type MockCandidate = {
  uid: string;
  name: string;
  age: number;
  city: string;
  country: string;
  photos: string[];
  genres: string[];
  verified?: boolean;
};

const mockCandidates: MockCandidate[] = [
  {
    uid: 'mock-1',
    name: 'Luna',
    age: 24,
    city: 'Istanbul',
    country: 'TR',
    photos: [
      'https://images.pexels.com/photos/3186654/pexels-photo-3186654.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/1697123/pexels-photo-1697123.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/764979/pexels-photo-764979.jpeg?auto=compress&w=600',
    ],
    genres: ['Techno'],
  },
  {
    uid: 'mock-2',
    name: 'Rian',
    age: 27,
    city: 'Ankara',
    country: 'TR',
    photos: [
      'https://images.pexels.com/photos/819530/pexels-photo-819530.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&w=600',
    ],
    genres: ['Hard Techno', 'Trance'],
    verified: true,
  },
  {
    uid: 'mock-3',
    name: 'Maya',
    age: 23,
    city: 'Izmir',
    country: 'TR',
    photos: [
      'https://images.pexels.com/photos/154147/pexels-photo-154147.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&w=600',
    ],
    genres: ['House', 'Minimal'],
  },
  {
    uid: 'mock-4',
    name: 'Alex',
    age: 28,
    city: 'Bursa',
    country: 'TR',
    photos: [
      'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&w=600',
    ],
    genres: ['Techno', 'Acid'],
  },
  {
    uid: 'mock-5',
    name: 'Elif',
    age: 26,
    city: 'Istanbul',
    country: 'TR',
    photos: [],
    genres: ['Hard Techno', 'Psy'],
    verified: true,
  },
];

export default function SwipeScreen() {
  const { profile, loading: authLoading } = useAuth();
  const [candidates, setCandidates] = useState<MockCandidate[]>(mockCandidates);
  const [index, setIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState('');
  const [overlayMatchName, setOverlayMatchName] = useState('');
  const [overlayMatchId, setOverlayMatchId] = useState<string | null>(null);
  const [overlayOtherUid, setOverlayOtherUid] = useState<string | null>(null);

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumModalFeature, setPremiumModalFeature] = useState<'boost' | 'rewind' | 'superlike' | null>(null);

  const [loadingCandidates] = useState(false);
  const [loadError] = useState<string | null>(null);

  const maxDailySwipes = profile?.maxDailySwipes ?? 15;

  const current = candidates[index] ?? null;

  useEffect(() => {
    setPhotoIndex(0);
  }, [current?.uid]);

  useEffect(() => {
    let cancelled = false;
    // Prefer real users from Firestore (multi-device scenario). Fallback to mock if none.
    (async () => {
      if (!profile) {
        setCandidates(mockCandidates);
        setIndex(0);
        return;
      }
      try {
        const real = await fetchSwipeCandidates(profile);
        if (cancelled) return;
        if (real.length) {
          const mapped: MockCandidate[] = real.map((u) => ({
            uid: u.uid,
            name: u.name,
            age: u.age,
            city: u.city,
            country: u.country,
            photos: Array.isArray(u.photos) ? u.photos : [],
            genres: Array.isArray(u.genres) ? u.genres : [],
            verified: !!u.verified,
          }));
          setCandidates(mapped);
          setIndex(0);
          return;
        }
      } catch (e) {
        if (DEBUG_LOGS) console.warn('fetchSwipeCandidates failed', e);
      }
      if (!cancelled) {
        setCandidates(mockCandidates);
        setIndex(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const photos = current?.photos?.length ? current.photos : null;

  const handlePrevPhoto = () => {
    if (!photos || photos.length <= 1) return;
    setPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextPhoto = () => {
    if (!photos || photos.length <= 1) return;
    setPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const goNextCandidate = () => {
    setIndex((prev) => {
      if (!candidates.length) return 0;
      const next = prev + 1;
      return next < candidates.length ? next : 0;
    });
  };

  const handleRewind = () => {
    if (!profile?.premium) {
      setPremiumModalFeature('rewind');
      setShowPremiumModal(true);
      return;
    }
    setIndex((prev) => (prev > 0 ? prev - 1 : 0));
  };

  const handleBoost = () => {
    if (!profile?.premium) {
      setPremiumModalFeature('boost');
      setShowPremiumModal(true);
      return;
    }
    if (boostActive) return;
    setBoostActive(true);
    setTimeout(() => {
      setBoostActive(false);
    }, 5 * 60 * 1000); // 5 dakikalık mock boost
  };

  const applySwipe = async (type: 'dislike' | LikeType) => {
    if (!current) return;

    if (type === 'dislike') {
      goNextCandidate();
      return;
    }

    // Auth/profile hazır olmadan like/superlike akışına girme
    if (authLoading || !profile) {
      Alert.alert('Giriş hazır değil', 'Lütfen 1-2 saniye bekleyip tekrar dene.');
      return;
    }

    if (hasReachedLimit) return;

    const matchId = [profile.uid, current.uid].sort().join('_');

    const openMatchOverlay = () => {
      setOverlayMatchId(matchId);
      setOverlayOtherUid(current.uid);
      setOverlayMatchName(current.name);
      setShowMatchOverlay(true);
    };

    // Superlike limitleri UI tarafında da hissedilsin (haftalık 5)
    if (type === 'superlike') {
      try {
        const matched = await sendLike(profile.uid, current.uid, type, {
          name: current.name,
          city: current.city,
          country: current.country,
          photos: current.photos,
          genres: current.genres,
          verified: current.verified,
        });

        if (matched) {
          // Mutual-like: show match overlay (message optional).
          openMatchOverlay();
          return;
        }
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes('SUPERLIKE_LIMIT_REACHED')) {
          Alert.alert('Limit doldu', 'Bu hafta 5 Superlike hakkını kullandın. Haftaya yenilenecek.');
          return;
        }
        if (msg.includes('SUPERLIKE_PREMIUM_ONLY')) {
          setPremiumModalFeature('superlike');
          setShowPremiumModal(true);
          return;
        }
        if (DEBUG_LOGS) console.warn('sendLike failed (superlike)', e);
        Alert.alert('Gönderilemedi', 'Superlike gönderilirken bir sorun oluştu.');
        return;
      }
    } else {
      // Backend'e fire-and-forget şekilde gönder, swipe akışını bloklama
      {
        try {
          const matched = await sendLike(profile.uid, current.uid, type, {
            name: current.name,
            city: current.city,
            country: current.country,
            photos: current.photos,
            genres: current.genres,
            verified: current.verified,
          });

          if (matched) {
            openMatchOverlay();
            return;
          }
        } catch (e) {
          if (DEBUG_LOGS) console.warn('sendLike failed (ignored for UI)', e);
        }
      }
    }

    // Not a match => continue swipe flow.

    // Lokal swipe sayacı ve limit kontrolü (mock)
    setSwipeCount((prev) => {
      const next = prev + 1;
      if (!profile?.premium && maxDailySwipes && next >= maxDailySwipes) {
        setHasReachedLimit(true);
      }
    });

    goNextCandidate();
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
      {/* Üst bar: Setlist + Premium etiketi */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Setlist</Text>
        {profile?.premium === true && (
          <View style={styles.premiumChip}>
            <Text style={styles.premiumChipText}>Premium</Text>
          </View>
        )}
      </View>

      <Modal visible={showPremiumModal} transparent animationType="fade">
        <View style={styles.premiumModalBackdrop}>
          <View style={styles.premiumModalCard}>
            <View style={styles.premiumModalHeader}>
              <Text style={styles.premiumModalTitle}>Premium Özellikler</Text>
              <Pressable
                onPress={() => {
                  setShowPremiumModal(false);
                  setPremiumModalFeature(null);
                }}
              >
                <Text style={styles.premiumModalClose}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.premiumModalList}>
              <View style={styles.premiumModalListItem}>
                <Text style={styles.premiumModalListTitle}>Sınırsız Swipe</Text>
                <Text style={styles.premiumModalListSub}>Günlük limit yok.</Text>
              </View>
              <View style={styles.premiumModalListItem}>
                <Text style={styles.premiumModalListTitle}>Mesafe Ayarlama</Text>
                <Text style={styles.premiumModalListSub}>Maksimum mesafe filtresiyle eşleşmelerini özelleştir.</Text>
              </View>
              <View style={styles.premiumModalListItem}>
                <Text style={styles.premiumModalListTitle}>Cinsiyet Seçimi</Text>
                <Text style={styles.premiumModalListSub}>Kimleri görmek istediğini seç.</Text>
              </View>
              <View style={styles.premiumModalListItem}>
                <Text style={styles.premiumModalListTitle}>Yaş Aralığı</Text>
                <Text style={styles.premiumModalListSub}>Yaş filtresiyle daha doğru eşleşmeler bul.</Text>
              </View>
              <View style={styles.premiumModalListItem}>
                <Text style={styles.premiumModalListTitle}>Geri Alma (Rewind)</Text>
                <Text style={styles.premiumModalListSub}>Son swipe’ını geri al.</Text>
              </View>
              <View style={styles.premiumModalListItem}>
                <Text style={styles.premiumModalListTitle}>Boost</Text>
                <Text style={styles.premiumModalListSub}>Profilini öne çıkar.</Text>
              </View>
              <View style={styles.premiumModalListItem}>
                <Text style={styles.premiumModalListTitle}>Superlike</Text>
                <Text style={styles.premiumModalListSub}>Haftada 5 Superlike (her hafta yenilenir).</Text>
              </View>
            </View>

            <View style={styles.premiumModalButtonsRow}>
              <Pressable
                style={styles.premiumModalLaterBtn}
                onPress={() => {
                  setShowPremiumModal(false);
                  setPremiumModalFeature(null);
                }}
              >
                <Text style={styles.premiumModalLaterText}>Sonra</Text>
              </Pressable>
              <Pressable
                style={styles.premiumModalUpgradeBtn}
                onPress={() => {
                  if (DEBUG_LOGS) console.log('Premium upgrade flow stub (swipe)');
                  setShowPremiumModal(false);
                  setPremiumModalFeature(null);
                }}
              >
                <Text style={styles.premiumModalUpgradeText}>Premium'a geç</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {hasReachedLimit && (
        <View style={styles.limitCard}>
          <Text style={styles.limitTitle}>Günlük swipe limitine ulaştın</Text>
          <View style={styles.limitList}>
            <Text style={styles.limitItem}>Günde 15 ücretsiz swipe hakkın var.</Text>
            <Text style={styles.limitItem}>Yarın ücretsiz hakkın yenilenecek.</Text>
            <Text style={styles.limitItem}>
              Premium'da sınırsız swipe ve gelişmiş filtreler seni bekliyor.
            </Text>
          </View>
          <Pressable
            style={styles.limitCtaButton}
            onPress={() => {
              if (DEBUG_LOGS) console.log('Premium upgrade flow stub (mobile)');
            }}
          >
            <Text style={styles.limitCtaText}>Premium'a geç</Text>
          </Pressable>
        </View>
      )}

      {boostActive && (
        <View style={styles.boostBanner}>
          <Text style={styles.boostBannerText}>BOOST AKTİF – Profilin şu an daha görünür (mock).</Text>
        </View>
      )}
      <View style={styles.cardWrapper}>
        {authLoading || loadingCandidates ? (
          <ActivityIndicator color="#a855f7" size="large" />
        ) : !current ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{loadError || 'Şu an gösterilecek profil yok.'}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {photos ? (
              <Image source={{ uri: photos[photoIndex] }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder} />
            )}

          {/* foto üstü gradient */}
          <View style={styles.overlay} pointerEvents="none" />

          {/* sol / sağ tıklanabilir alanlar */}
          <Pressable style={styles.leftTapZone} onPress={handlePrevPhoto} />
          <Pressable style={styles.rightTapZone} onPress={handleNextPhoto} />

          {/* dot indicator */}
          {photos && photos.length > 1 && (
            <View style={styles.dotsRow}>
              {photos.map((_photo: string, i: number) => (
                <View
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  style={[styles.dot, i === photoIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

            {/* bilgi alanı */}
            <View style={styles.infoBox}>
              <View style={styles.cardNameRow}>
                <Text style={styles.nameText}>
                  {current?.name}, {current?.age}
                </Text>
                {current?.verified && (
                  <View style={styles.cardVerifiedBadge}>
                    <Text style={styles.cardVerifiedText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.locationText}>
                {current?.city}, {current?.country}
              </Text>
              <View style={styles.genresRow}>
                {current?.genres?.map((g: any) => (
                  <View key={String(g)} style={styles.genrePill}>
                    <Text style={styles.genreText}>{String(g)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* alt aksiyon butonları */}
      <View style={styles.actionsRow}>
        <Pressable style={[styles.circleButton, styles.boostButton]} onPress={handleBoost}>
          <Text style={styles.circleText}>🚀</Text>
        </Pressable>
        <Pressable style={[styles.circleButton, styles.rewindButton]} onPress={handleRewind}>
          <Text style={styles.circleText}>🔁</Text>
        </Pressable>
        <Pressable
          style={[styles.circleButton, styles.dislikeButton]}
          onPress={() => void applySwipe('dislike')}
        >
          <Text style={styles.circleText}>✖</Text>
        </Pressable>
        <Pressable
          style={[styles.circleButton, styles.superlikeButton]}
          onPress={() => {
            if (!profile?.premium) {
              setPremiumModalFeature('superlike');
              setShowPremiumModal(true);
              return;
            }
            void applySwipe('superlike');
          }}
          disabled={hasReachedLimit}
        >
          <Text
            style={[
              styles.circleText,
              hasReachedLimit && styles.circleTextDisabled,
            ]}
          >
            ✨
          </Text>
        </Pressable>
        <Pressable
          style={[styles.circleButton, styles.likeButton]}
          onPress={() => void applySwipe('like')}
          disabled={hasReachedLimit}
        >
          <Text
            style={[
              styles.circleText,
              hasReachedLimit && styles.circleTextDisabled,
            ]}
          >
            💜
          </Text>
        </Pressable>
      </View>

      {/* Match overlay (mock) */}
      {showMatchOverlay && (
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchTitle}>Rave arkadaşını buldun</Text>
            <Text style={styles.matchSubtitle}>
              {overlayMatchName ? `${overlayMatchName}'e ilk mesajını yazabilirsin.` : 'İlk mesajını yazabilirsin.'}
            </Text>
            <TextInput
              style={styles.matchInput}
              placeholder="İlk mesajını yaz..."
              placeholderTextColor="#6b7280"
              value={overlayMessage}
              onChangeText={setOverlayMessage}
              multiline
            />
            <View style={styles.matchButtonsRow}>
              <Pressable
                style={[styles.matchButton, styles.matchSkipButton]}
                onPress={async () => {
                  if (authLoading || !profile) {
                    setShowMatchOverlay(false);
                    setOverlayMessage('');
                    goNextCandidate();
                    return;
                  }

                  const myUid = profile.uid;
                  const derivedOtherUid =
                    overlayOtherUid ??
                    overlayMatchId?.split('_').find((uid) => uid && uid !== myUid) ??
                    null;

                  if (derivedOtherUid) {
                    const matchId = [myUid, derivedOtherUid].sort().join('_');
                    try {
                      const matchRef = doc(db, 'matches', matchId);
                      const batch = writeBatch(db);
                      batch.set(
                        matchRef,
                        {
                          userA: myUid,
                          userB: derivedOtherUid,
                          users: [myUid, derivedOtherUid],
                          userIds: [myUid, derivedOtherUid],
                          userNames: {
                            [myUid]: String(profile?.name ?? 'You'),
                            [derivedOtherUid]: String(overlayMatchName || 'Match'),
                          },
                          createdAt: serverTimestamp(),
                          // No message yet, but we want it visible in the matches list.
                          lastMessageAt: Date.now(),
                          lastMessageFrom: myUid,
                        },
                        { merge: true },
                      );
                      await batch.commit();
                    } catch (e) {
                      // Intentionally keep silent in production; UX should continue.
                      if (DEBUG_LOGS) console.warn('Failed to create match on skip', e);
                    }
                  }

                  setShowMatchOverlay(false);
                  setOverlayMessage('');
                  setOverlayMatchId(null);
                  setOverlayOtherUid(null);
                  // Overlay Sonra ile kapatıldığında sonrakine geç
                  goNextCandidate();
                }}
              >
                <Text style={styles.matchSkipText}>Sonra</Text>
              </Pressable>
              <Pressable
                style={[styles.matchButton, styles.matchSendButton, !overlayMessage.trim() && styles.matchSendDisabled]}
                disabled={!overlayMessage.trim()}
                onPress={async () => {
                  if (authLoading || !profile) {
                    Alert.alert('Giriş hazır değil', 'Lütfen 1-2 saniye bekleyip tekrar dene.');
                    return;
                  }

                  if (overlayMatchId) {
                    const text = overlayMessage.trim();
                    const myUid = profile.uid;
                    const derivedOtherUid =
                      overlayOtherUid ??
                      overlayMatchId.split('_').find((uid) => uid && uid !== myUid) ??
                      null;
                    if (!derivedOtherUid) {
                      Alert.alert('Hata', 'Eşleşme bilgisi bulunamadı.');
                      return;
                    }
                    const matchId = [myUid, derivedOtherUid].sort().join('_');

                    try {
                      const matchRef = doc(db, 'matches', matchId);
                      const msgRef = doc(collection(db, 'matches', matchId, 'messages'));
                      const batch = writeBatch(db);
                      if (DEBUG_LOGS) {
                        // eslint-disable-next-line no-console
                        console.log('[overlay] sending first message', {
                          myUid,
                          otherUid: derivedOtherUid,
                          matchId,
                          candidateUid: current.uid,
                          candidateName: current.name,
                        });
                      }
                      batch.set(
                        matchRef,
                        {
                          userA: myUid,
                          userB: derivedOtherUid,
                          users: [myUid, derivedOtherUid],
                          userIds: [myUid, derivedOtherUid],
                          userNames: {
                            [myUid]: String(profile?.name ?? 'You'),
                            [derivedOtherUid]: String(overlayMatchName || 'Match'),
                          },
                          createdAt: serverTimestamp(),
                          lastMessageAt: Date.now(),
                          lastMessageFrom: myUid,
                        },
                        { merge: true },
                      );
                      batch.set(msgRef, {
                        from: myUid,
                        text,
                        users: [myUid, derivedOtherUid],
                        userIds: [myUid, derivedOtherUid],
                        createdAt: serverTimestamp(),
                      });
                      await batch.commit();

                      if (DEBUG_LOGS) {
                        // eslint-disable-next-line no-console
                        console.log('[overlay] batch committed', { matchId });
                      }

                      // Başarılıysa overlay'i kapat
                      setShowMatchOverlay(false);
                      setOverlayMessage('');
                      setOverlayMatchId(null);
                      setOverlayOtherUid(null);
                      goNextCandidate();
                      return;
                    } catch (e) {
                      if (DEBUG_LOGS) {
                        console.warn('Failed to send overlay message', {
                          code: (e as any)?.code,
                          message: (e as any)?.message,
                          matchId,
                          uid: myUid,
                        });
                      }
                      Alert.alert('Mesaj gönderilemedi', String((e as any)?.message ?? e));
                      return;
                    }
                  }
                }}
              >
                <Text style={styles.matchSendText}>Mesajı gönder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  topTitle: {
    color: '#f472b6',
    fontSize: 18,
    fontWeight: '600',
  },
  premiumChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(236,72,153,0.18)',
    borderWidth: 1,
    borderColor: '#ec4899',
  },
  premiumChipText: {
    color: '#ec4899',
    fontSize: 11,
    fontWeight: '600',
  },
  boostBanner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    // Banner doğrudan kartın üstünde dursun
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.6)',
  },
  boostBannerText: {
    color: '#22d3ee',
    fontSize: 11,
    textAlign: 'center',
  },
  cardWrapper: {
    flex: 1,
    alignItems: 'center',
    // Kartı alta yaklaştır
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    aspectRatio: 0.78,
    marginTop: 0,
    // Kartı boost'a bir tık yaklaştırmak için alt boşluğu biraz artır
    marginBottom: 20,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#0b0618',
    shadowColor: '#a855f7',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(148,163,184,0.3)',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  leftTapZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  rightTapZone: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
  infoBox: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  cardVerifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.9)',
  },
  cardVerifiedText: {
    color: '#020617',
    fontSize: 11,
    fontWeight: '700',
  },
  locationText: {
    marginTop: 4,
    color: '#e5e5e5',
    fontSize: 13,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  genrePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  genreText: {
    color: '#22d3ee',
    fontSize: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  limitCard: {
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  limitTitle: {
    color: '#f472b6',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  limitList: {
    gap: 2,
    marginBottom: 8,
  },
  limitItem: {
    color: '#e5e7eb',
    fontSize: 11,
  },
  limitCtaButton: {
    marginTop: 2,
    alignSelf: 'stretch',
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitCtaText: {
    color: '#020617',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
  },
  matchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  matchCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#050016',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.6)',
    padding: 16,
  },
  matchTitle: {
    color: '#f472b6',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  matchSubtitle: {
    color: '#e5e7eb',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  matchInput: {
    minHeight: 70,
    maxHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(88,28,135,0.8)',
    backgroundColor: 'rgba(15,23,42,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#e5e7eb',
    fontSize: 13,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  matchButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  matchButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchSkipButton: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.9)',
  },
  matchSendButton: {
    backgroundColor: '#ec4899',
  },
  matchSendDisabled: {
    backgroundColor: 'rgba(148,163,184,0.8)',
  },
  matchSkipText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
  matchSendText: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '600',
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  circleText: {
    fontSize: 20,
  },
  circleTextDisabled: {
    opacity: 0.4,
  },
  premiumModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  premiumModalCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#090016',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.4)',
    padding: 12,
  },
  premiumModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  premiumModalTitle: {
    color: '#22d3ee',
    fontSize: 14,
    fontWeight: '600',
  },
  premiumModalClose: {
    color: '#9ca3af',
    fontSize: 16,
  },
  premiumModalBodyText: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 10,
  },
  premiumModalList: {
    marginBottom: 12,
    gap: 10,
  },
  premiumModalListItem: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.22)',
  },
  premiumModalListTitle: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '700',
  },
  premiumModalListSub: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  premiumModalButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  premiumModalLaterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.8)',
    alignItems: 'center',
  },
  premiumModalLaterText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  premiumModalUpgradeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ec4899',
    alignItems: 'center',
  },
  premiumModalUpgradeText: {
    color: '#020617',
    fontSize: 12,
    fontWeight: '600',
  },
  boostButton: {
    backgroundColor: '#7c3aed',
  },
  rewindButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.8)',
  },
  dislikeButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.9)',
  },
  superlikeButton: {
    backgroundColor: '#22d3ee',
  },
  likeButton: {
    backgroundColor: '#ec4899',
  },
});
