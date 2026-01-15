import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';

type PreferredGender = 'female' | 'male' | 'both';

const ALL_GENRES = ['Techno', 'Hard Techno', 'House', 'Minimal', 'Psy', 'Trance', 'Acid'];

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, firebaseUser, loading, signOut } = useAuth();
  const [name, setName] = useState('Setlist User');
  const [genres, setGenres] = useState<string[]>(['Techno']);
  const [photos, setPhotos] = useState<string[]>([
    'https://images.pexels.com/photos/761963/pexels-photo-761963.jpeg?auto=compress&w=600',
    'https://images.pexels.com/photos/167169/pexels-photo-167169.jpeg?auto=compress&w=600',
  ]);
  const [bio, setBio] = useState('Kısa rave bio...');
  const [afterParty, setAfterParty] = useState(false);
  const [preferredGender, setPreferredGender] = useState<PreferredGender>('both');
  const [premium, setPremium] = useState(false);
  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('35');
  const [maxDistanceKm, setMaxDistanceKm] = useState('25');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const verificationStatus = profile?.verificationStatus ?? 'none';
  const isVerified = profile?.verified === true;

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const handleAddPhoto = () => {
    if (photos.length >= 6) return;
    const placeholders = [
      'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/819530/pexels-photo-819530.jpeg?auto=compress&w=600',
      'https://images.pexels.com/photos/3186654/pexels-photo-3186654.jpeg?auto=compress&w=600',
    ];
    const next = placeholders[photos.length % placeholders.length];
    setPhotos((prev) => [...prev, next]);
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const newArr = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newArr.length) return prev;
      const tmp = newArr[index];
      newArr[index] = newArr[targetIndex];
      newArr[targetIndex] = tmp;
      return newArr;
    });
  };

  // Profil verisi geldiğinde local form state'ini doldur
  useEffect(() => {
    if (!profile) return;
    if (profile.name) setName(profile.name);
    if (Array.isArray((profile as any).genres)) setGenres((profile as any).genres as string[]);
    if (Array.isArray((profile as any).photos)) setPhotos((profile as any).photos as string[]);
    if (profile.bio !== undefined) setBio(profile.bio);
    if (profile.afterParty !== undefined) setAfterParty(profile.afterParty);
    if (profile.premium !== undefined) setPremium(profile.premium);
    if (profile.preferredGender) setPreferredGender(profile.preferredGender as PreferredGender);
    if (profile.minAge !== undefined) setMinAge(String(profile.minAge));
    if (profile.maxAge !== undefined) setMaxAge(String(profile.maxAge));
    if (profile.maxDistanceKm !== undefined) setMaxDistanceKm(String(profile.maxDistanceKm));
  }, [profile]);

  const handleSave = async () => {
    if (loading) {
      Alert.alert('Bekle', 'Oturum hazırlanıyor. 2-3 saniye sonra tekrar dene.');
      return;
    }
    if (!firebaseUser) {
      Alert.alert('Hata', 'Oturum bulunamadı. Lütfen tekrar deneyin.');
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      await firestore().collection('users').doc(firebaseUser.uid).set(
        {
          name,
          photos,
          genres,
          bio,
          afterParty,
          premium,
          preferredGender,
          minAge: Number(minAge) || undefined,
          maxAge: Number(maxAge) || undefined,
          maxDistanceKm: Number(maxDistanceKm) || undefined,
        },
        { merge: true },
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } catch (e) {
      console.warn('Failed to save mobile profile', e);
      Alert.alert('Kaydedilemedi', 'Profil bilgilerin kaydedilirken bir sorun oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePremium = () => {
    if (loading) return;
    if (!firebaseUser) return;

    const next = !premium;
    setPremium(next);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    firestore()
      .collection('users')
      .doc(firebaseUser.uid)
      .set(
        {
          premium: next,
          maxDailySwipes: next ? 9999 : 20,
        },
        { merge: true },
      )
      .catch(() => undefined);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Üst bilgi satırı */}
        <View style={styles.topRow}>
          <View style={styles.avatarBox}>
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={styles.avatarPhoto} />
            ) : (
              <Text style={styles.avatarInitial}>{name.charAt(0) || '?'}</Text>
            )}
          </View>
          <View style={styles.topTextCol}>
            <View style={styles.nameRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="İsim"
                placeholderTextColor="#6b7280"
              />
              {isVerified && (
                <View style={styles.verifiedPill}>
                  <Text style={styles.verifiedPillText}>✓</Text>
                </View>
              )}
              {premium && (
                <View style={styles.premiumPill}>
                  <Text style={styles.premiumPillText}>Premium</Text>
                </View>
              )}
            </View>
            {/* Konum bilgisini artık kullanıcıdan manuel almıyoruz; 
                ileride konum izni ile otomatik doldurulacak. */}
          </View>
        </View>

        {/* Bio - üst blokta, isimden hemen sonra */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            multiline
            numberOfLines={3}
            value={bio}
            onChangeText={setBio}
            placeholder="Kendini kısaca anlat..."
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Genres */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Genres</Text>
          <View style={styles.genresRow}>
            {ALL_GENRES.map((g) => {
              const active = genres.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.genrePill, active && styles.genrePillActive]}
                  onPress={() => toggleGenre(g)}
                >
                  <Text style={[styles.genreText, active && styles.genreTextActive]}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Fotoğraflar & düzenleme */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fotoğraflar</Text>
          <View style={styles.photosRow}>
            {photos.map((url, index) => (
              <View key={url} style={styles.photoBox}>
                <Image source={{ uri: url }} style={styles.photoImg} />
                <View style={styles.photoTopRow}>
                  <TouchableOpacity
                    style={[styles.photoReorderBtn, index === 0 && styles.photoReorderDisabled]}
                    disabled={index === 0}
                    onPress={() => movePhoto(index, -1)}
                  >
                    <Text style={styles.photoReorderText}>◀</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.photoReorderBtn,
                      index === photos.length - 1 && styles.photoReorderDisabled,
                    ]}
                    disabled={index === photos.length - 1}
                    onPress={() => movePhoto(index, 1)}
                  >
                    <Text style={styles.photoReorderText}>▶</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => setPhotos((prev) => prev.filter((p) => p !== url))}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.addPhotoBtn, photos.length >= 6 && styles.addPhotoDisabled]}
            onPress={handleAddPhoto}
            disabled={photos.length >= 6}
          >
            <Text style={styles.addPhotoText}>
              {photos.length >= 6 ? 'En fazla 6 foto' : 'Mock fotoğraf ekle'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Afterparty & kimleri görmek istersin? */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Afterparty</Text>
            <Switch
              value={afterParty}
              onValueChange={setAfterParty}
              trackColor={{ false: '#4b5563', true: '#22d3ee' }}
              thumbColor={afterParty ? '#0f172a' : '#020617'}
            />
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Kimleri görmek istersin?</Text>
            <View style={styles.genderPillsRow}>
              {(
                [
                  { key: 'both', label: 'Her ikisi' },
                  { key: 'female', label: 'Kadınlar' },
                  { key: 'male', label: 'Erkekler' },
                ] as { key: PreferredGender; label: string }[]
              ).map((opt) => {
                const active = preferredGender === opt.key;
                const disabled = !premium;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.genderPill,
                      active && styles.genderPillActive,
                      disabled && styles.genderPillDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => setPreferredGender(opt.key)}
                  >
                    <Text
                      style={[
                        styles.genderPillText,
                        active && styles.genderPillTextActive,
                        disabled && styles.genderPillTextDisabled,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Yaş ve konum aralığı (filtreler) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Yaş & Konum aralığı</Text>
          <View style={styles.filterRow}>
            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>Yaş aralığı</Text>
              <View style={styles.filterInlineRow}>
                <TextInput
                  style={styles.filterInput}
                  keyboardType="number-pad"
                  value={minAge}
                  onChangeText={setMinAge}
                  placeholder="min"
                  placeholderTextColor="#6b7280"
                />
                <Text style={styles.filterDash}>-</Text>
                <TextInput
                  style={styles.filterInput}
                  keyboardType="number-pad"
                  value={maxAge}
                  onChangeText={setMaxAge}
                  placeholder="max"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>
            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>Maks. mesafe</Text>
              <View style={styles.filterInlineRow}>
                <TextInput
                  style={styles.filterInput}
                  keyboardType="number-pad"
                  value={maxDistanceKm}
                  onChangeText={setMaxDistanceKm}
                  placeholder="km"
                  placeholderTextColor="#6b7280"
                />
                <Text style={styles.filterUnit}>km</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Doğrulanmış hesap (mavi tik) - kamera ile doğrulama akışına yönlendirme */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Doğrulanmış hesap</Text>
          {verificationStatus === 'verified' ? (
            <Text style={styles.verifiedStatusText}>Hesabın doğrulandı ✓</Text>
          ) : verificationStatus === 'pending' ? (
            <Text style={styles.verifiedStatusText}>
              Selfien inceleniyor. Doğrulama isteğin 1-2 saat içinde sonuçlanacak.
            </Text>
          ) : (
            <>
              {verificationStatus === 'rejected' && (
                <Text style={styles.verifyItem}>
                  Selfien profil fotoğraflarınla eşleşmedi. Tekrar deneyebilirsin.
                </Text>
              )}
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={() => {
                  router.push('/verify-selfie');
                }}
              >
                <Text style={styles.verifyButtonText}>Hesabını doğrula</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Premium - Afterparty ile aynı stil, switch */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>Premium mod</Text>
            <Switch
              value={premium}
              onValueChange={handleTogglePremium}
              trackColor={{ false: '#4b5563', true: '#f97316' }}
              thumbColor={premium ? '#0f172a' : '#020617'}
            />
          </View>
        </View>

        {/* Kaydet butonu */}
        <View style={styles.saveRow}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving || loading || !firebaseUser}
          >
            <Text style={styles.saveText}>
              {loading ? 'Oturum hazırlanıyor...' : saving ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}
            </Text>
          </TouchableOpacity>
          {saved && <Text style={styles.savedBadge}>Kaydedildi</Text>}
        </View>

        <View style={styles.saveRow}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              signOut();
            }}
            disabled={loading}
          >
            <Text style={styles.logoutText}>{loading ? '...' : 'Çıkış yap'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050016',
    paddingTop: 24,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#e5e7eb',
    fontSize: 22,
    fontWeight: '600',
  },
  topTextCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.8)',
    color: '#e5e7eb',
    fontSize: 14,
  },
  premiumPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(236,72,153,0.2)',
  },
  premiumPillText: {
    color: '#ec4899',
    fontSize: 11,
    fontWeight: '600',
  },
  verifiedPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  verifiedPillText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  locationInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.8)',
    color: '#e5e7eb',
    fontSize: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genrePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.9)',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  genrePillActive: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(34,211,238,0.18)',
  },
  genreText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  genreTextActive: {
    color: '#22d3ee',
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(75,85,99,0.9)',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoTopRow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  photoReorderBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.8)',
  },
  photoReorderDisabled: {
    opacity: 0.3,
  },
  photoReorderText: {
    color: '#e5e7eb',
    fontSize: 10,
  },
  photoRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  photoRemoveText: {
    color: '#fecaca',
    fontSize: 10,
  },
  addPhotoBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#22d3ee',
  },
  addPhotoDisabled: {
    backgroundColor: 'rgba(55,65,81,0.9)',
  },
  addPhotoText: {
    color: '#020617',
    fontSize: 11,
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowLabel: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  genderPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  genderPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(75,85,99,0.9)',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  genderPillActive: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(34,211,238,0.18)',
  },
  genderPillDisabled: {
    opacity: 0.4,
  },
  genderPillText: {
    color: '#9ca3af',
    fontSize: 10,
  },
  genderPillTextActive: {
    color: '#22d3ee',
  },
  genderPillTextDisabled: {
    color: '#6b7280',
  },
  bioInput: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.8)',
    color: '#e5e7eb',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterBlock: {
    flex: 1,
  },
  filterLabel: {
    color: '#e5e7eb',
    fontSize: 12,
    marginBottom: 4,
  },
  filterInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.8)',
    color: '#e5e7eb',
    fontSize: 12,
  },
  filterDash: {
    color: '#9ca3af',
    fontSize: 12,
  },
  filterUnit: {
    color: '#9ca3af',
    fontSize: 12,
  },
  verifyBox: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.7)',
  },
  verifyTitle: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  verifyItem: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 2,
  },
  verifiedStatusText: {
    color: '#22c55e',
    fontSize: 12,
  },
  verifyButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#38bdf8',
  },
  verifyButtonText: {
    color: '#020617',
    fontSize: 12,
    fontWeight: '600',
  },
  premiumStatusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(236,72,153,0.2)',
    borderWidth: 1,
    borderColor: '#ec4899',
  },
  premiumStatusText: {
    color: '#ec4899',
    fontSize: 11,
    fontWeight: '600',
  },
  premiumCtaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ec4899',
  },
  premiumCtaText: {
    color: '#020617',
    fontSize: 11,
    fontWeight: '600',
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    backgroundColor: '#22d3ee',
    alignItems: 'center',
  },
  saveText: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '600',
  },
  savedBadge: {
    color: '#22d3ee',
    fontSize: 11,
  },
  logoutBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.9)',
    alignItems: 'center',
  },
  logoutText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
});
